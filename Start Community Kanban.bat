@echo off
REM ---------------------------------------------------------------------------
REM  Community Kanban - one-click start (Windows)
REM
REM  Double-click this file. It installs what's needed the first time, asks a
REM  few setup questions, then starts the app and opens it in your browser.
REM
REM  To stop the app: close this window, or press Ctrl+C in it.
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
title Community Kanban

echo.
echo    Community Kanban
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo    Node isn't installed yet - that's the engine this app runs on.
  echo    Opening nodejs.org. Download the big green LTS button, run the
  echo    installer with all the defaults, then double-click this file again.
  start "" "https://nodejs.org"
  echo.
  pause
  exit /b 1
)

node -e "process.exit(parseInt(process.versions.node,10)>=22?0:1)"
if errorlevel 1 (
  echo    Your Node is too old - this needs v22 or newer.
  echo    Opening nodejs.org. Install the LTS version over the top of the old
  echo    one, then double-click this file again.
  start "" "https://nodejs.org"
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo    First run - fetching what the app needs. Takes a few seconds.
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo. & echo    That didn't finish. Are you online? & pause & exit /b 1 )
)

if not exist .env (
  echo.
  echo    Let's set it up. A few quick questions:
  echo.
  call npm run setup
  if not exist .env ( echo. & echo    Setup didn't finish - run this file again. & pause & exit /b 1 )
  echo.
  set /p LOADSAMPLES="   Load five sample parts so you can see how it works? [Y/n] "
  if /i not "%LOADSAMPLES%"=="n" call npm run seed:sample
)

REM Open the port setup actually chose, not an assumed one.
set APPPORT=8080
for /f "tokens=2 delims==" %%A in ('findstr /b "PORT=" .env 2^>nul') do set APPPORT=%%A

REM Give the server a moment to bind, then open the browser.
start "" /b cmd /c "timeout /t 3 >nul & start "" http://localhost:%APPPORT%"

echo.
echo    Starting. Your browser will open in a moment.
echo    Leave this window open while you use the app - closing it stops the app.
echo.
call npm run dev

echo.
echo    The app stopped.
pause
