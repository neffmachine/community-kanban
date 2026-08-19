@echo off
REM ---------------------------------------------------------------------------
REM  Community Kanban - run it in the background, always (Windows)
REM
REM  Double-click this once. After that the app starts when you log in, runs
REM  with no window open, and restarts itself if it ever stops.
REM
REM  How: it writes a small startup script into your Startup folder. No admin
REM  rights, no Windows service, nothing installed system-wide. To undo it,
REM  double-click "Uninstall background service.bat".
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
title Community Kanban - install background service

echo.
echo    Community Kanban - background service
echo.

if not exist server.mjs ( echo    Can't find the app. Keep this file inside the app folder. & echo. & pause & exit /b 1 )
if not exist .env       ( echo    Not set up yet. Run "Start Community Kanban.bat" first. & echo. & pause & exit /b 1 )
if not exist node_modules ( echo    Not installed yet. Run "Start Community Kanban.bat" first. & echo. & pause & exit /b 1 )

set APPPORT=8080
for /f "tokens=2 delims==" %%A in ('findstr /b "PORT=" .env 2^>nul') do set APPPORT=%%A

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "AGENT=%STARTUP%\Community Kanban.vbs"

REM  The app folder, without its trailing backslash.
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"

echo    Writing the startup script...

REM  A supervisor: runs the app hidden (the 0), waits for it, and starts it
REM  again if it ever exits. The loop IS the restart policy - it doesn't rely
REM  on Windows noticing a failure.
> "%AGENT%" echo ' Community Kanban - starts the app at logon, hidden, and restarts it if it stops.
>>"%AGENT%" echo ' Delete this file to stop that happening (or run "Uninstall background service.bat").
>>"%AGENT%" echo Set shell = CreateObject("WScript.Shell")
>>"%AGENT%" echo shell.CurrentDirectory = "%APPDIR%"
>>"%AGENT%" echo Do
>>"%AGENT%" echo   shell.Run "cmd /c npm run dev", 0, True
>>"%AGENT%" echo   WScript.Sleep 5000
>>"%AGENT%" echo Loop

if not exist "%AGENT%" (
  echo. & echo    Couldn't write to your Startup folder. & echo. & pause & exit /b 1
)

echo    Starting it now...
start "" wscript.exe "%AGENT%"

echo    Waiting for it to come up...
set UP=
for /l %%i in (1,1,30) do (
  if not defined UP (
    >nul 2>&1 (netstat -aon ^| findstr /r /c:":%APPPORT% .*LISTENING") && set UP=yes
    if not defined UP timeout /t 1 >nul
  )
)

echo.
if defined UP (
  echo    Running, and it will keep running.
  echo.
  echo      On this PC:         http://localhost:%APPPORT%
  for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%J in ("%%I") do echo      From the shop wifi: http://%%J:%APPPORT%
  )
  echo.
  echo    It starts again by itself when you log in, and if it ever stops.
  echo    You can close this window - the app keeps going.
  echo.
  echo    To stop it: double-click "Uninstall background service.bat"
) else (
  echo    It's set to start at logon, but hasn't answered on port %APPPORT% yet.
  echo    Give it a minute and try http://localhost:%APPPORT% in your browser.
  echo    If it still won't load, run "Start Community Kanban.bat" to see the error.
)
echo.
pause
