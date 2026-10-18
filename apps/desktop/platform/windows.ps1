param([ValidateSet('OpenApp','DictateNotes')][string]$Action,[string]$Payload)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
  $request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
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
  @{verified=$false;summary=$_.Exception.Message} | ConvertTo-Json -Compress
  exit 1
}
