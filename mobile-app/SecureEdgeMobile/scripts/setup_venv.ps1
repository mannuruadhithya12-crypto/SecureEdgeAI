# Creates C:\se_venv and installs dependencies from requirements.txt
$ErrorActionPreference = "Stop"

$VenvPath = "C:\se_venv"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Requirements = Join-Path $RepoRoot "requirements.txt"

if (-not (Test-Path $Requirements)) {
    throw "requirements.txt not found at: $Requirements"
}

if (-not (Test-Path $VenvPath)) {
    Write-Host "Creating virtual environment at $VenvPath ..."
    python -m venv $VenvPath
}

$Python = Join-Path $VenvPath "Scripts\python.exe"
$Pip = Join-Path $VenvPath "Scripts\pip.exe"

Write-Host "Upgrading pip ..."
& $Python -m pip install --upgrade pip

Write-Host "Installing packages from requirements.txt ..."
& $Pip install -r $Requirements

Write-Host "Done. Activate with: & $VenvPath\Scripts\Activate.ps1"
