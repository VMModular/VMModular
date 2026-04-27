<#
.SYNOPSIS
    VM CRM — One-Shot Setup Script for Windows (PowerShell)
.DESCRIPTION
    Initializes environment, starts Docker services, runs migrations, and seeds data.
.PARAMETER Reset
    Drop all data, re-migrate and re-seed.
#>

Param(
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────
function Info { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Success { Write-Host "[OK]    $args" -ForegroundColor Green }
function Warn { Write-Host "[WARN]  $args" -ForegroundColor Yellow }
function Error { Write-Host "[ERROR] $args" -ForegroundColor Red; exit 1 }

# ── 0. Prerequisites ─────────────────────────────────────────
Info "Checking prerequisites …"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Error "docker not found — please install Docker Desktop" }
if (-not (docker compose version 2>$null)) { Error "docker compose (v2) not found" }

# ── 1. Copy .env if missing ───────────────────────────────────
$backendEnv = "backend/.env"
$backendEnvExample = "backend/.env.example"

if (-not (Test-Path $backendEnv)) {
    Info "Creating backend/.env from .env.example …"
    Copy-Item $backendEnvExample $backendEnv
}

# Ensure JWT_SECRET is present and at least 32 chars
$envContent = Get-Content $backendEnv -Raw
if ($envContent -match "JWT_SECRET=(.*)") {
    $currentSecret = $Matches[1].Trim()
    if ($currentSecret.Length -lt 32 -or $currentSecret -eq "your-jwt-secret-change-this-in-production" -or [string]::IsNullOrWhiteSpace($currentSecret)) {
        Warn "JWT_SECRET is too short, default, or empty. Generating a new 32-char secret …"
        $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        $randomSecret = -join (1..32 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
        
        $newEnvContent = $envContent -replace "JWT_SECRET=.*", "JWT_SECRET=$randomSecret"
        Set-Content -Path $backendEnv -Value $newEnvContent -NoNewline
        Success "JWT_SECRET updated in backend/.env"
    }
}

# ── 2. Reset (optional) ───────────────────────────────────────
if ($Reset) {
    Warn "RESET flag detected — removing all volumes (this deletes the database) …"
    docker compose down -v --remove-orphans
    if (Test-Path "backend/data/") {
        Remove-Item "backend/data/*.db*" -Force -ErrorAction SilentlyContinue
    }
    Info "Data cleared."
}

# ── 3. Start Infrastructure ──────────────────────────────────
Info "Starting Docker services …"
docker compose up -d --build

# ── 4. Wait for Backend ──────────────────────────────────────
Info "Waiting for backend to be healthy …"
$attempts = 0
$maxAttempts = 30
$healthy = $false

while (-not $healthy -and $attempts -lt $maxAttempts) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -ErrorAction SilentlyContinue
        $healthy = $true
    } catch {
        Write-Host "." -NoNewline
        $attempts++
        Start-Sleep -Seconds 2
    }
}

if (-not $healthy) {
    Error "Backend failed to start in time."
}
Write-Host ""
Success "Backend is UP"

# ── 5. Run Migrations & Seeds ─────────────────────────────────
Info "Running database migrations …"
docker compose exec backend npm run migrate
Success "Migrations completed"

Info "Running database seeds …"
docker compose exec backend npm run seed
Success "Seeding completed"

# ── 6. Summary ───────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "        VM CRM — Setup Complete!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Frontend UI  → http://localhost" -ForegroundColor Cyan
Write-Host "  GraphQL API  → http://localhost/graphql" -ForegroundColor Cyan
Write-Host "  Health Check → http://localhost/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Default Login Credentials:" -ForegroundColor Yellow
Write-Host "  Owner:   owner@moducraft.com"
Write-Host "  Manager: sm1@moducraft.com"
Write-Host ""
Write-Host "  Logs: docker compose logs -f" -ForegroundColor Cyan
Write-Host "  Stop: docker compose down" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
