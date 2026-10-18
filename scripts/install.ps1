[CmdletBinding()]
param(
    [string]$Destination = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'GleysonSilva-Jarvis'),
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,120}$')][string]$Ref = 'main',
    [switch]$Start
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Este instalador exige Windows.' }
foreach ($tool in @('git','node','npm.cmd')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Instale $tool pela fonte oficial e execute novamente. Consulte AI_INSTALL.md." }
}
$nodeVersion = (& node -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 24) { throw 'Instale Node.js 24 ou superior (nodejs.org).' }
$target = [System.IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $target) { throw "O destino já existe: $target. Escolha outra pasta; nenhum arquivo foi alterado." }
$parent = Split-Path -Parent $target
if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
Write-Host "Obtendo o código de Gleysonp-Dev/GleysonSilva-Jarvis ($Ref)..."
& git clone --depth 1 --branch $Ref -- 'https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis.git' $target
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível obter o projeto. A pasta parcial foi preservada para diagnóstico.' }
Push-Location -LiteralPath $target
try {
    Write-Host 'Instalando dependências públicas. Esta etapa não pede chaves nem acessa microfone/câmera.'
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'A instalação falhou. O código permanece na pasta escolhida.' }
    & npm.cmd run verify
    if ($LASTEXITCODE -ne 0) { throw 'A verificação falhou. Consulte a saída antes de iniciar.' }
    Write-Host "Instalado em $target. Execute npm start nessa pasta para abrir o Jarvis."
    if ($Start) { & npm.cmd start; if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar o aplicativo.' } }
} finally { Pop-Location }
