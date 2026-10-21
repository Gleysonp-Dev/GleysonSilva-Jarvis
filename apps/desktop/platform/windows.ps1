param([ValidateSet('OpenApp','DictateNotes','ListApps','LaunchInstalledApp')][string]$Action,[string]$Payload)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Get-LocalExecutable([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 4096) { return $null }
  $candidate = $Value.Trim()
  if ($candidate -match '^"([^"\r\n]+)"$') { $candidate = $Matches[1] }
  if ($candidate -notmatch '^[A-Za-z]:[\\/]' -or $candidate.Substring(2).Contains(':') -or $candidate -match '[\x00-\x1f\x7f<>"|?*]') { return $null }
  try {
    $full = [IO.Path]::GetFullPath($candidate)
    if ([IO.Path]::GetExtension($full) -ine '.exe' -or -not (Test-Path -LiteralPath $full -PathType Leaf)) { return $null }
    return $full
  } catch { return $null }
}

function Get-InstalledApps {
  $rows = [System.Collections.Generic.List[object]]::new()
  $seen = @{}
  # Names and AUMIDs come from the OS, never from a command supplied by the model.
  try {
    foreach ($installed in @(Get-StartApps -ErrorAction Stop)) {
      $name = [string]$installed.Name
      $aumid = [string]$installed.AppID
      if ([string]::IsNullOrWhiteSpace($name) -or $name.Length -gt 160) { continue }
      $exe = Get-LocalExecutable $aumid
      if ($exe) {
        $key = 'exe:' + $exe
        if (-not $seen.ContainsKey($key)) { $seen[$key] = $true; $rows.Add(@{kind='exe';label=$name;path=$exe}) }
      } elseif ($aumid -cmatch '^[A-Za-z0-9][A-Za-z0-9_.!{}-]{0,255}$') {
        $key = 'aumid:' + $aumid
        if (-not $seen.ContainsKey($key)) { $seen[$key] = $true; $rows.Add(@{kind='aumid';label=$name;aumid=$aumid}) }
      }
      if ($rows.Count -ge 1900) { break }
    }
  } catch { # App Paths and explicitly configured applications remain discoverable.
  }
  $locations = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths'
  )
  foreach ($location in $locations) {
    foreach ($registration in @(Get-ChildItem -LiteralPath $location -ErrorAction SilentlyContinue)) {
      if ($rows.Count -ge 2000) { break }
      try {
        $value = [string]$registration.GetValue('')
        $exe = Get-LocalExecutable ([Environment]::ExpandEnvironmentVariables($value))
        if (-not $exe -or $seen.ContainsKey('exe:' + $exe)) { continue }
        $file = Get-Item -LiteralPath $exe -ErrorAction Stop
        $name = [string]$file.VersionInfo.ProductName
        if ([string]::IsNullOrWhiteSpace($name)) { $name = $file.BaseName }
        $seen['exe:' + $exe] = $true
        $rows.Add(@{kind='exe';label=$name.Substring(0,[Math]::Min(160,$name.Length));path=$exe})
      } catch { # A missing/inaccessible registration is not an executable capability.
      }
    }
  }
  return $rows.ToArray()
}

function Find-AppProcess([string]$TargetPath, [bool]$WindowOnly) {
  foreach ($candidate in @(Get-Process -ErrorAction SilentlyContinue)) {
    try {
      if ($candidate.Path -ieq $TargetPath -and (-not $WindowOnly -or $candidate.MainWindowHandle -ne 0)) { return $candidate }
    } catch { # Protected system processes do not supply evidence for this app.
    }
  }
  return $null
}

try {
  if ([string]::IsNullOrWhiteSpace($Payload) -or $Payload.Length -gt 200000) { throw 'Pedido inválido.' }
  $request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
  if ($null -eq $request -or $request -is [Array] -or $request -is [string]) { throw 'Pedido inválido.' }
  if ($Action -eq 'ListApps') {
    if (@($request.PSObject.Properties.Name).Count -ne 0) { throw 'O inventário não recebe comandos ou filtros executáveis.' }
    @{apps=@(Get-InstalledApps);observedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 5 -Compress
    exit 0
  }
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class JarvisWindows {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
  if ($Action -eq 'OpenApp') {
    $targetPath = [IO.Path]::GetFullPath([string]$request.path)
    if ([IO.Path]::GetExtension($targetPath) -ne '.exe' -or -not (Test-Path -LiteralPath $targetPath -PathType Leaf)) { throw 'Aplicativo inválido.' }
    $existing = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -eq $targetPath } | Select-Object -First 1
    if (-not $existing) { $launched = Start-Process -FilePath $targetPath -PassThru -WindowStyle Hidden }
    $deadline = [DateTime]::UtcNow.AddSeconds(12)
    do {
      $windowProcess = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -eq $targetPath } | Select-Object -First 1
      if (-not $windowProcess) { Start-Sleep -Milliseconds 120 }
    } while (-not $windowProcess -and [DateTime]::UtcNow -lt $deadline)
    if (-not $windowProcess) { throw 'O aplicativo foi iniciado, mas nenhuma janela pôde ser confirmada.' }
    [void][JarvisWindows]::ShowWindow($windowProcess.MainWindowHandle,9)
    $focused = [JarvisWindows]::SetForegroundWindow($windowProcess.MainWindowHandle)
    @{verified=$true;summary='Processo e janela confirmados.';pid=$windowProcess.Id;windowTitle=$windowProcess.MainWindowTitle;focused=$focused} | ConvertTo-Json -Compress
  } elseif ($Action -eq 'LaunchInstalledApp') {
    if ($request.kind -ceq 'exe') {
      if (@($request.PSObject.Properties.Name | Where-Object { $_ -notin @('kind','path') }).Count -ne 0) { throw 'Argumentos de aplicativo não permitidos.' }
      $targetPath = Get-LocalExecutable ([string]$request.path)
      if (-not $targetPath) { throw 'Executável local inválido.' }
      $windowProcess = Find-AppProcess $targetPath $true
      if (-not $windowProcess) { $launched = Start-Process -FilePath $targetPath -PassThru }
      $deadline = [DateTime]::UtcNow.AddSeconds(10)
      do {
        $windowProcess = Find-AppProcess $targetPath $true
        if (-not $windowProcess) { Start-Sleep -Milliseconds 120 }
      } while (-not $windowProcess -and [DateTime]::UtcNow -lt $deadline)
      if ($windowProcess) {
        [void][JarvisWindows]::ShowWindow($windowProcess.MainWindowHandle,9)
        $focused = [JarvisWindows]::SetForegroundWindow($windowProcess.MainWindowHandle)
        @{verified=$true;dispatched=$true;observed='window';summary='Processo e janela do aplicativo observados.';pid=$windowProcess.Id;focused=$focused} | ConvertTo-Json -Compress
      } else {
        $running = Find-AppProcess $targetPath $false
        if ($running) { @{verified=$true;dispatched=$true;observed='process';summary='Processo do aplicativo observado. Nenhuma janela foi confirmada.';pid=$running.Id} | ConvertTo-Json -Compress }
        else { @{verified=$false;dispatched=$true;summary='O pedido foi encaminhado ao Windows. Nenhum processo ou janela do aplicativo foi confirmado.'} | ConvertTo-Json -Compress }
      }
    } elseif ($request.kind -ceq 'aumid') {
      if (@($request.PSObject.Properties.Name | Where-Object { $_ -notin @('kind','aumid') }).Count -ne 0) { throw 'Argumentos de aplicativo não permitidos.' }
      $aumid = [string]$request.aumid
      if ($aumid -cnotmatch '^[A-Za-z0-9][A-Za-z0-9_.!{}-]{0,255}$') { throw 'Identificador de aplicativo inválido.' }
      $known = Get-StartApps -ErrorAction Stop | Where-Object { $_.AppID -ceq $aumid } | Select-Object -First 1
      if (-not $known) { throw 'O aplicativo não consta mais no inventário Windows.' }
      $shell = New-Object -ComObject Shell.Application
      $folder = $shell.Namespace('shell:AppsFolder')
      $item = if ($folder) { $folder.ParseName($aumid) } else { $null }
      if (-not $item) { throw 'O Windows não encontrou o aplicativo no menu de aplicativos.' }
      $item.InvokeVerb('open')
      @{verified=$false;dispatched=$true;summary='O pedido foi encaminhado ao aplicativo registrado no Windows. Sua janela ainda não foi confirmada.'} | ConvertTo-Json -Compress
    } else { throw 'Tipo de aplicativo inválido.' }
  } else {
    $text = [string]$request.text
    if ($text.Length -gt 12000) { throw 'Texto muito longo para ditado.' }
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $notepadPath = Join-Path $env:SystemRoot 'System32\notepad.exe'
    $launched = Start-Process -FilePath $notepadPath -PassThru -WindowStyle Hidden
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    $windowProcess = $null
    do {
      $windowProcess = Get-Process -Name notepad -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.StartTime -ge $launched.StartTime.AddSeconds(-2) } | Sort-Object StartTime -Descending | Select-Object -First 1
      if (-not $windowProcess) { Start-Sleep -Milliseconds 120 }
    } while (-not $windowProcess -and [DateTime]::UtcNow -lt $deadline)
    if (-not $windowProcess) { throw 'Não foi possível identificar uma nova janela de notas com segurança.' }
    [void][JarvisWindows]::ShowWindow($windowProcess.MainWindowHandle,9)
    $element = [System.Windows.Automation.AutomationElement]::FromHandle($windowProcess.MainWindowHandle)
    $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
    $edit = $element.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
    if (-not $edit) { throw 'O editor desta versão do Bloco de Notas não oferece o controle esperado.' }
    $pattern = $null
    if (-not $edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)) { throw 'Ditado não suportado nesta versão. Use o arquivo de notas verificado.' }
    if ($pattern.Current.IsReadOnly -or $pattern.Current.Value.Length -gt 0) { throw 'A janela não está vazia; o texto não foi alterado.' }
    $pattern.SetValue($text)
    if ($pattern.Current.Value -ne $text) { throw 'O texto não pôde ser confirmado no editor.' }
    @{verified=$true;summary='Texto confirmado em uma nova janela do Bloco de Notas.';pid=$windowProcess.Id} | ConvertTo-Json -Compress
  }
} catch {
  $summary = if ($Action -in @('ListApps','LaunchInstalledApp')) { 'O Windows não concluiu a descoberta ou abertura do aplicativo. Faça uma nova busca e tente novamente.' } else { $_.Exception.Message }
  @{verified=$false;summary=$summary} | ConvertTo-Json -Compress
  exit 1
}
