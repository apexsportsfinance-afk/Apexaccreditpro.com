@echo off
REM ============================================================
REM  Apex Master Console — one-click launcher (Windows)
REM  Double-click this file to open the console in your browser.
REM  It serves master-console-live.html locally (private to this
REM  machine) and opens it. Close the server window to stop.
REM ============================================================
title Apex Master Console Server  (close to stop)
cd /d "%~dp0"

REM start a tiny local web server in this folder
start "Apex Master Console Server  (close to stop)" cmd /c python -m http.server 5510

REM give it a moment, then open the console in the default browser
timeout /t 2 >nul
start "" http://localhost:5510/master-console-live.html

echo.
echo  Apex Master Console is opening at http://localhost:5510/master-console-live.html
echo  A separate window is running the local server. Close THAT window to stop it.
echo.
echo  (Your anon key + login are remembered in the browser after the first time.)
echo.
pause
