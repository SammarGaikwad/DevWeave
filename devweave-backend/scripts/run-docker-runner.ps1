<#
.SYNOPSIS
    DevWeave Windows Docker Desktop Runner Launcher
.DESCRIPTION
    Runs the outbound-only read-only telemetry runner for Windows Docker Desktop.
    Transmits Docker stats (version, container count, image count) to DevWeave backend over HTTPS.
    Never exposes Docker daemon sockets or accepts remote commands.
#>

param(
    [string]$Token = $env:DOCKER_RUNNER_TOKEN,
    [string]$BackendUrl = $env:DEVWEAVE_BACKEND_URL,
    [string]$RunnerId = $env:DOCKER_RUNNER_ID
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir

Set-Location $backendDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       DevWeave Windows Docker Desktop Runner              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Docker status
try {
    $dockerVer = & docker --version 2>$null
    if ($dockerVer) {
        Write-Host "[OK] Docker CLI detected: $dockerVer" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Docker CLI not found in PATH. Telemetry will report Docker OFFLINE." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Could not check Docker CLI: $_" -ForegroundColor Yellow
}

# 2. Check Runner Token
if ($Token) {
    $env:DOCKER_RUNNER_TOKEN = $Token.Trim()
}

# Fallback: check .env file if token is not yet in environment
if (-not $env:DOCKER_RUNNER_TOKEN) {
    $dotEnvPath = Join-Path $backendDir ".env"
    if (Test-Path $dotEnvPath) {
        $envMatch = Get-Content $dotEnvPath -ErrorAction SilentlyContinue |
            Where-Object { $_ -match '^\s*DOCKER_RUNNER_TOKEN\s*=\s*(.+?)\s*$' } |
            Select-Object -First 1
        if ($envMatch -and ($envMatch -match '^\s*DOCKER_RUNNER_TOKEN\s*=\s*(.+?)\s*$')) {
            $candidate = $Matches[1].Trim("'`"")
            if ($candidate.Length -ge 32) {
                $env:DOCKER_RUNNER_TOKEN = $candidate
                Write-Host "[INFO] Loaded DOCKER_RUNNER_TOKEN from .env" -ForegroundColor Cyan
            }
        }
    }
}

# Prompt interactively if still missing
if (-not $env:DOCKER_RUNNER_TOKEN) {
    Write-Host "Enter DevWeave Docker Runner Token (Right-click to paste in PowerShell console):" -ForegroundColor Yellow
    $secureToken = Read-Host -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

    try {
        $env:DOCKER_RUNNER_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        $secureToken.Dispose()
    }
}

if (-not $env:DOCKER_RUNNER_TOKEN -or $env:DOCKER_RUNNER_TOKEN.Length -lt 32) {
    Write-Error "DOCKER_RUNNER_TOKEN must be at least 32 characters long."
    exit 1
}


# 3. Configure Runner ID and Backend URL
if ($RunnerId) {
    $env:DOCKER_RUNNER_ID = $RunnerId
} elseif (-not $env:DOCKER_RUNNER_ID) {
    $env:DOCKER_RUNNER_ID = "windows-docker-runner"
}

if ($BackendUrl) {
    $env:DEVWEAVE_BACKEND_URL = $BackendUrl
} elseif (-not $env:DEVWEAVE_BACKEND_URL) {
    $env:DEVWEAVE_BACKEND_URL = "https://devweave.onrender.com"
}

Write-Host "[INFO] Runner ID: $env:DOCKER_RUNNER_ID" -ForegroundColor Cyan
Write-Host "[INFO] Backend URL: $env:DEVWEAVE_BACKEND_URL" -ForegroundColor Cyan
Write-Host "[INFO] Heartbeat interval: 10s (Outbound-only HTTPS, Read-only)" -ForegroundColor Cyan
Write-Host "[INFO] Starting runner process..." -ForegroundColor Green

& npm run runner:docker
