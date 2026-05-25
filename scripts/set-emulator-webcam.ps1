# Point the Pixel 6 AVD front camera at the PC webcam (fixes blocky Virtual Scene preview).
# Cold-boot the emulator after running this script.

$avdNames = @('Pixel_6.avd', 'Pixel_6_2.avd')
$avdRoot = Join-Path $env:USERPROFILE '.android\avd'

foreach ($name in $avdNames) {
  $dir = Join-Path $avdRoot $name
  if (-not (Test-Path $dir)) {
    Write-Host "Skip missing AVD: $dir"
    continue
  }

  $configIni = Join-Path $dir 'config.ini'
  if (Test-Path $configIni) {
    (Get-Content $configIni) `
      -replace 'hw\.camera\.front\s*=\s*emulated', 'hw.camera.front = webcam0' `
      | Set-Content $configIni
    Write-Host "Updated $configIni -> hw.camera.front = webcam0"
  }

  $qemuIni = Join-Path $dir 'hardware-qemu.ini'
  if (Test-Path $qemuIni) {
    (Get-Content $qemuIni) `
      -replace 'hw\.camera\.front\s*=\s*emulated', 'hw.camera.front = webcam0' `
      | Set-Content $qemuIni
    Write-Host "Updated $qemuIni -> hw.camera.front = webcam0"
  }
}

Write-Host ""
Write-Host "Done. Close the emulator completely, then start it again (Cold Boot)."
