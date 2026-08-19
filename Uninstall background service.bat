@echo off
REM ---------------------------------------------------------------------------
REM  Community Kanban - stop running in the background (Windows)
REM
REM  Your data is untouched. Start the app again any time with
REM  "Start Community Kanban.bat".
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
title Community Kanban - uninstall background service
echo.
echo    Stopping Community Kanban...

set APPPORT=8080
for /f "tokens=2 delims==" %%A in ('findstr /b "PORT=" .env 2^>nul') do set APPPORT=%%A

set "AGENT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Community Kanban.vbs"

REM  Remove the startup script FIRST, and stop the supervisor, so it can't
REM  restart the app the moment we stop it.
if exist "%AGENT%" del /f /q "%AGENT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "Get-CimInstance Win32_Process -Filter \"Name='wscript.exe'\" | Where-Object { $_.CommandLine -like '*Community Kanban.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

REM  Then the app itself - only the process holding this app's port, not every
REM  node.exe, since this PC may run other Node tools.
for /f "tokens=5" %%P in ('netstat -aon ^| findstr /r /c:":%APPPORT% .*LISTENING"') do taskkill /f /pid %%P >nul 2>&1

echo.
echo    Stopped, and it will not start at login any more.
echo    Your data is untouched.
echo.
pause
