@echo off
setlocal enabledelayedexpansion

REM Lint All Services Script for QuantumMint Platform (Windows)
REM This script runs ESLint for all backend services and frontend

echo 🔍 Running QuantumMint Platform Linting
echo =======================================

set LINT_FAILURES=0
set PROJECT_ROOT=%~dp0..
set FIX_MODE=

REM Check if fix mode is requested
if "%1"=="--fix" (
    set FIX_MODE=fix
    echo [INFO] Running in fix mode - automatically fixing issues where possible
)

echo Project root: %PROJECT_ROOT%
echo.

echo [INFO] Linting Backend Services...
echo ---------------------------
call :run_service_lint "API Gateway" "%PROJECT_ROOT%\api-gateway"
call :run_service_lint "Auth Service" "%PROJECT_ROOT%\auth-service"
call :run_service_lint "Transaction Service" "%PROJECT_ROOT%\transaction-service"
call :run_service_lint "Payment Integration" "%PROJECT_ROOT%\payment-integration"
call :run_service_lint "KYC Service" "%PROJECT_ROOT%\kyc-service"
call :run_service_lint "Money Generation" "%PROJECT_ROOT%\money-generation"

echo.
echo [INFO] Linting Frontend...
echo -------------------
call :run_service_lint "Frontend" "%PROJECT_ROOT%\frontend"

echo.

REM Summary
echo Lint Summary
echo ============

if %LINT_FAILURES%==0 (
    echo [SUCCESS] All linting checks passed! 🎉
    echo.
    echo ✅ API Gateway
    echo ✅ Auth Service
    echo ✅ Transaction Service
    echo ✅ Payment Integration
    echo ✅ KYC Service
    echo ✅ Money Generation
    echo ✅ Frontend
) else (
    echo [ERROR] %LINT_FAILURES% service^(s^) have linting issues
    echo.
    echo [INFO] Run with --fix flag to automatically fix issues where possible:
    echo   .\scripts\lint-all.bat --fix
    exit /b 1
)

echo.
echo [INFO] Linting completed successfully!
goto :eof

:run_service_lint
set service_name=%~1
set service_path=%~2

echo [INFO] Linting %service_name%...

if not exist "%service_path%" (
    echo [WARNING] %service_name% directory not found, skipping...
    goto :eof
)

cd /d "%service_path%"

if not exist "package.json" (
    echo [WARNING] %service_name% package.json not found, skipping...
    cd /d "%PROJECT_ROOT%"
    goto :eof
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies for %service_name%...
    npm install
)

REM Run linting
if "%FIX_MODE%"=="fix" (
    npm run lint:fix >nul 2>&1
    if !errorlevel!==0 (
        echo [SUCCESS] %service_name% linting completed with fixes ✅
    ) else (
        echo [ERROR] %service_name% linting failed ❌
        set /a LINT_FAILURES+=1
    )
) else (
    npm run lint >nul 2>&1
    if !errorlevel!==0 (
        echo [SUCCESS] %service_name% linting passed ✅
    ) else (
        echo [ERROR] %service_name% linting failed ❌
        set /a LINT_FAILURES+=1
    )
)

cd /d "%PROJECT_ROOT%"
goto :eof
