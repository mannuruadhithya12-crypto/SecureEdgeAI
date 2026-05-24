Environment setup

1) Create and install into the short-path venv (recommended on Windows to avoid long-path errors):

PowerShell:

    powershell -ExecutionPolicy Bypass -File .\scripts\setup_venv.ps1

This creates `C:\se_venv` and installs packages from `requirements.txt`.

2) Activate the venv:

PowerShell:

    & C:\se_venv\Scripts\Activate.ps1

3) Run the model test:

    python .\test_model.py

Notes:
- If you prefer a project-local venv, replace `C:\se_venv` with `.venv` in the script and run from an elevated PowerShell if needed.
- `requirements.txt` lists the required packages.
