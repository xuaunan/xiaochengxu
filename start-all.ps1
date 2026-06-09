$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AdminDir = Join-Path $RootDir 'sunshine-admin'
$WebDir = Join-Path $RootDir 'html'
$BackendDir = Join-Path $RootDir 'sunshine-travel'
$BackendJar = Join-Path $BackendDir 'target\sunshine-travel-1.0.0.jar'
$LogDir = Join-Path $RootDir 'logs'
$FrontendUrl = 'http://127.0.0.1:5173/'
$WebUrl = 'http://127.0.0.1:5174/'
$BackendUrl = 'http://127.0.0.1:8080/'

function Test-ListenPort {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$connections
}

function Start-HiddenCommand {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command,
        [string]$LogFile
    )

    $logPath = Join-Path $LogDir $LogFile
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = "/d /s /c `"title $Title && cd /d `"$WorkingDirectory`" && $Command >> `"$logPath`" 2>&1`""
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

function Open-Url {
    param([string]$Url)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Url
    $psi.UseShellExecute = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}

if (-not (Test-Path $AdminDir)) {
    throw "Admin frontend directory not found: $AdminDir"
}

if (-not (Test-Path $WebDir)) {
    throw "Website directory not found: $WebDir"
}

if (-not (Test-Path $BackendJar)) {
    throw "Backend jar not found: $BackendJar"
}

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$JavaExe = 'C:\Program Files\Java\jdk-17\bin\java.exe'
if (-not (Test-Path $JavaExe)) {
    $JavaExe = 'java.exe'
}

Write-Host 'Starting Sunshine Travel...'

if (Test-ListenPort 8080) {
    Write-Host 'Backend is already running on port 8080.'
} else {
    $backendCommand = "`"$JavaExe`" -jar `"$BackendJar`""
    Start-HiddenCommand -Title 'Sunshine Backend' -WorkingDirectory $BackendDir -Command $backendCommand -LogFile 'backend.log'
    Write-Host 'Backend start command sent.'
}

if (Test-ListenPort 5173) {
    Write-Host 'Admin frontend is already running on port 5173.'
} else {
    Start-HiddenCommand -Title 'Sunshine Admin' -WorkingDirectory $AdminDir -Command 'npm run dev' -LogFile 'admin.log'
    Write-Host 'Admin frontend start command sent.'
}

if (Test-ListenPort 5174) {
    Write-Host 'Website is already running on port 5174.'
} else {
    Start-HiddenCommand -Title 'Sunshine Website' -WorkingDirectory $WebDir -Command 'npm run dev -- --port 5174 --strictPort' -LogFile 'website.log'
    Write-Host 'Website start command sent.'
}

Write-Host 'Waiting for services...'
$frontendReady = Wait-HttpOk -Url $FrontendUrl -TimeoutSeconds 40
$webReady = Wait-HttpOk -Url $WebUrl -TimeoutSeconds 40
$backendReady = Wait-HttpOk -Url $BackendUrl -TimeoutSeconds 40

if ($frontendReady) {
    Write-Host "Admin frontend ready: $FrontendUrl"
} else {
    Write-Warning "Admin frontend did not respond in time: $FrontendUrl"
}

if ($webReady) {
    Write-Host "Website ready: $WebUrl"
    Open-Url $WebUrl
} else {
    Write-Warning "Website did not respond in time: $WebUrl"
}

if ($backendReady) {
    Write-Host "Backend ready: $BackendUrl"
} else {
    Write-Warning "Backend did not respond in time: $BackendUrl"
}

Write-Host 'Done.'
