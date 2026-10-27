<#
.SYNOPSIS
    DevWeave Windows Kubernetes Desktop Runner Launcher
.DESCRIPTION
    Runs the outbound-only telemetry and management runner for local Kubernetes (Docker Desktop, Minikube, Kind).
    Transmits cluster telemetry and inventory to DevWeave backend over HTTPS.
    Executes structured kubectl commands through authenticated job polling.
#>

param(
    [string]$Token = $env:KUBERNETES_RUNNER_TOKEN,
    [string]$BackendUrl = $env:DEVWEAVE_BACKEND_URL,
    [string]$RunnerId = $env:KUBERNETES_RUNNER_ID
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir

Set-Location $backendDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       DevWeave Windows Kubernetes Runner                  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check kubectl status
try {
    $k8sVer = & kubectl version --client 2>$null
    if ($k8sVer) {
        Write-Host "[OK] kubectl CLI detected: $k8sVer" -ForegroundColor Green
    } else {
        Write-Host "[WARN] kubectl CLI not found in PATH. Telemetry will report CLI_NOT_FOUND." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Could not check kubectl CLI: $_" -ForegroundColor Yellow
}

# 2. Check Runner Token
if ($Token) {
    $env:KUBERNETES_RUNNER_TOKEN = $Token.Trim()
}

# Fallback: check .env file if token is not yet in environment
if (-not $env:KUBERNETES_RUNNER_TOKEN) {
    $dotEnvPath = Join-Path $backendDir ".env"
    if (Test-Path $dotEnvPath) {
        $envMatch = Get-Content $dotEnvPath -ErrorAction SilentlyContinue |
            Where-Object { $_ -match '^\s*KUBERNETES_RUNNER_TOKEN\s*=\s*(.+?)\s*$' } |
            Select-Object -First 1
        if ($envMatch -and ($envMatch -match '^\s*KUBERNETES_RUNNER_TOKEN\s*=\s*(.+?)\s*$')) {
            $candidate = $Matches[1].Trim("'`"")
            if ($candidate.Length -ge 32) {
                $env:KUBERNETES_RUNNER_TOKEN = $candidate
                Write-Host "[INFO] Loaded KUBERNETES_RUNNER_TOKEN from .env" -ForegroundColor Cyan
            }
        } elseif (-not $env:KUBERNETES_RUNNER_TOKEN) {
            # Secondary fallback: try DOCKER_RUNNER_TOKEN from .env
            $dockerMatch = Get-Content $dotEnvPath -ErrorAction SilentlyContinue |
                Where-Object { $_ -match '^\s*DOCKER_RUNNER_TOKEN\s*=\s*(.+?)\s*$' } |
                Select-Object -First 1
            if ($dockerMatch -and ($dockerMatch -match '^\s*DOCKER_RUNNER_TOKEN\s*=\s*(.+?)\s*$')) {
                $candidate = $Matches[1].Trim("'`"")
                if ($candidate.Length -ge 32) {
                    $env:KUBERNETES_RUNNER_TOKEN = $candidate
                    Write-Host "[INFO] Reusing DOCKER_RUNNER_TOKEN from .env as runner token" -ForegroundColor Cyan
                }
            }
        }
    }
}

if (-not $env:KUBERNETES_RUNNER_TOKEN) {
    Write-Host "[ERROR] KUBERNETES_RUNNER_TOKEN is required. Please set it in .env or pass -Token parameter." -ForegroundColor Red
    exit 1
}

# 3. Check Backend URL
if ($BackendUrl) {
    $env:DEVWEAVE_BACKEND_URL = $BackendUrl.Trim()
}
if (-not $env:DEVWEAVE_BACKEND_URL) {
    $env:DEVWEAVE_BACKEND_URL = "http://localhost:5000"
}
Write-Host "[INFO] Backend URL: $env:DEVWEAVE_BACKEND_URL" -ForegroundColor Cyan

# 4. Check Runner ID
if ($RunnerId) {
    $env:KUBERNETES_RUNNER_ID = $RunnerId.Trim()
}
if (-not $env:KUBERNETES_RUNNER_ID) {
    $env:KUBERNETES_RUNNER_ID = "windows-k8s-runner"
}
Write-Host "[INFO] Runner ID: $env:KUBERNETES_RUNNER_ID" -ForegroundColor Cyan

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting runner daemon via tsx..." -ForegroundColor Green

npm run runner:k8s
