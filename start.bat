@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Zhixing Stock Panel launcher. This is a native CMD script and does not call PowerShell.
cd /d "%~dp0"
set "ROOT=%CD%"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "STOCKSDK_DIR=%BACKEND_DIR%\app\plugins\stocksdk"
set "ENV_FILE=%ROOT%\.env"

if not defined BACKEND_HOST set "BACKEND_HOST=127.0.0.1"
if not defined BACKEND_PORT set "BACKEND_PORT=3118"
if not defined FRONTEND_PORT set "FRONTEND_PORT=3111"

if /i "%~1"=="--backend" goto run_backend
if /i "%~1"=="--frontend" goto run_frontend

title Zhixing Launcher
echo.
echo ==============================================
echo   Zhixing Stock Panel
echo   Frontend: http://127.0.0.1:%FRONTEND_PORT%
echo   Backend : http://127.0.0.1:%BACKEND_PORT%
echo ==============================================
echo.

if not exist "%BACKEND_DIR%\pyproject.toml" goto invalid_project
if not exist "%FRONTEND_DIR%\package.json" goto invalid_project

where uv.exe >nul 2>&1
if errorlevel 1 goto missing_uv
where pnpm.cmd >nul 2>&1
if errorlevel 1 goto missing_pnpm

if not exist "%STOCKSDK_DIR%\node_modules\stock-sdk\package.json" (
  where npm.cmd >nul 2>&1
  if errorlevel 1 goto missing_npm
  echo [DATA] Installing the stock-sdk market data plugin...
  pushd "%STOCKSDK_DIR%"
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo [ERROR] stock-sdk dependency setup failed.
    pause
    exit /b 1
  )
  popd
)

set "BACKEND_READY=0"
set "FRONTEND_READY=0"
call :url_ok "http://127.0.0.1:%BACKEND_PORT%/health"
if not errorlevel 1 set "BACKEND_READY=1"
call :url_ok "http://127.0.0.1:%FRONTEND_PORT%/watchlist"
if not errorlevel 1 set "FRONTEND_READY=1"

if "%BACKEND_READY%"=="1" if "%FRONTEND_READY%"=="1" goto open_browser

echo [1/4] Checking Python dependencies...
pushd "%BACKEND_DIR%"
uv sync --frozen --extra dev
if errorlevel 1 (
  popd
  echo [ERROR] Python dependency setup failed.
  pause
  exit /b 1
)
popd

echo [2/4] Checking frontend dependencies...
pushd "%FRONTEND_DIR%"
call pnpm install --frozen-lockfile
if errorlevel 1 (
  popd
  echo [ERROR] Frontend dependency setup failed.
  pause
  exit /b 1
)
popd

if /i "%~1"=="--check" (
  echo [OK] Launcher and dependencies are ready.
  exit /b 0
)

if "%BACKEND_READY%"=="0" (
  call :port_free "%BACKEND_PORT%" "backend"
  if errorlevel 1 exit /b 1
)
if "%FRONTEND_READY%"=="0" (
  call :port_free "%FRONTEND_PORT%" "frontend"
  if errorlevel 1 exit /b 1
)

echo [3/4] Starting services...
if "%BACKEND_READY%"=="0" start "Zhixing Backend" /D "%ROOT%" %ComSpec% /k call "%~f0" --backend
if "%FRONTEND_READY%"=="0" start "Zhixing Frontend" /D "%ROOT%" %ComSpec% /k call "%~f0" --frontend

echo [4/4] Waiting for the project to become ready...
call :wait_for_url "http://127.0.0.1:%BACKEND_PORT%/health" 90
if errorlevel 1 (
  echo [ERROR] Backend did not become ready. Check the Zhixing Backend window.
  pause
  exit /b 1
)
call :wait_for_url "http://127.0.0.1:%FRONTEND_PORT%/watchlist" 60
if errorlevel 1 (
  echo [ERROR] Frontend did not become ready. Check the Zhixing Frontend window.
  pause
  exit /b 1
)

:open_browser
echo [OK] Zhixing is ready.
if /i "%~1"=="--no-browser" exit /b 0
start "" "http://127.0.0.1:%FRONTEND_PORT%/watchlist"
exit /b 0

:run_backend
title Zhixing Backend
cd /d "%BACKEND_DIR%"
set "PYTHONUNBUFFERED=1"
if exist "%ENV_FILE%" (
  ".venv\Scripts\python.exe" -m uvicorn app.main:app --env-file "%ENV_FILE%" --reload --host "%BACKEND_HOST%" --port "%BACKEND_PORT%"
) else (
  ".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host "%BACKEND_HOST%" --port "%BACKEND_PORT%"
)
exit /b %ERRORLEVEL%

:run_frontend
title Zhixing Frontend
cd /d "%FRONTEND_DIR%"
call pnpm dev --host "%BACKEND_HOST%" --port "%FRONTEND_PORT%"
exit /b %ERRORLEVEL%

:url_ok
where curl.exe >nul 2>&1
if errorlevel 1 exit /b 1
curl.exe -fsS --max-time 2 "%~1" >nul 2>&1
exit /b %ERRORLEVEL%

:wait_for_url
where curl.exe >nul 2>&1
if errorlevel 1 (
  ping.exe -n 6 127.0.0.1 >nul
  exit /b 0
)
set "WAIT_URL=%~1"
set /a "WAIT_LEFT=%~2"
:wait_loop
curl.exe -fsS --max-time 2 "!WAIT_URL!" >nul 2>&1
if not errorlevel 1 exit /b 0
set /a "WAIT_LEFT-=1"
if !WAIT_LEFT! LEQ 0 exit /b 1
ping.exe -n 2 127.0.0.1 >nul
goto wait_loop

:port_free
netstat -ano -p tcp | findstr /I "LISTENING" | findstr /R /C:":%~1 " >nul
if errorlevel 1 exit /b 0
echo [ERROR] Port %~1 for %~2 is already in use.
echo         Close the conflicting program or set another port before retrying.
pause
exit /b 1

:missing_uv
echo [ERROR] uv was not found. Install it with: winget install --id=astral-sh.uv
pause
exit /b 1

:missing_pnpm
echo [ERROR] pnpm was not found. Install Node.js, then run: npm install -g pnpm
pause
exit /b 1

:missing_npm
echo [ERROR] npm was not found. Install Node.js 18 or newer.
pause
exit /b 1

:invalid_project
echo [ERROR] start.bat must stay in the Zhixing project root.
pause
exit /b 1
