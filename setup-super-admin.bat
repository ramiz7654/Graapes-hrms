@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-super-admin.ps1"
if errorlevel 1 (
  echo.
  echo Super Admin setup did not complete. Read the message above.
) else (
  echo.
  echo Super Admin setup finished. Open http://localhost:5173/login and sign in.
)
echo.
pause
