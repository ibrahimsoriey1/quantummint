@echo off
setlocal enabledelayedexpansion

REM Install All Dependencies Script for QuantumMint Platform (Windows)
REM This script installs dependencies for all services

echo 📦 Installing QuantumMint Platform Dependencies
echo ===============================================

set INSTALL_FAILURES=0
set PROJECT_ROOT=%~dp0..

echo Project root: %PROJECT_ROOT%
echo.

REM Check Node.js version
echo [INFO] Checking Node.js version...
node --version >nul 2>&1
if !errorlevel!==0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [SUCCESS] Node.js version: !NODE_VERSION!
) else (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ to continue.
    exit /b 1
)

REM Check npm version
npm --version >nul 2>&1
if !errorlevel!==0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [SUCCESS] npm version: !NPM_VERSION!
) else (
    echo [ERROR] npm is not installed. Please install npm to continue.
    exit /b 1
)

echo.

REM Install shared dependencies first
echo [INFO] Installing Shared Dependencies...
echo --------------------------------
call :install_service_deps "Shared" "%PROJECT_ROOT%\shared"

echo.

REM Install backend service dependencies
echo [INFO] Installing Backend Service Dependencies...
echo ----------------------------------------

call :install_service_deps "API Gateway" "%PROJECT_ROOT%\api-gateway"
call :install_service_deps "Auth Service" "%PROJECT_ROOT%\auth-service"
call :install_service_deps "Transaction Service" "%PROJECT_ROOT%\transaction-service"
call :install_service_deps "Payment Integration" "%PROJECT_ROOT%\payment-integration"
call :install_service_deps "KYC Service" "%PROJECT_ROOT%\kyc-service"
call :install_service_deps "Money Generation" "%PROJECT_ROOT%\money-generation"

echo.

REM Install frontend dependencies
echo [INFO] Installing Frontend Dependencies...
echo ----------------------------------
call :install_service_deps "Frontend" "%PROJECT_ROOT%\frontend"

echo.

REM Install root dependencies
echo [INFO] Installing Root Dependencies...
echo ------------------------------
cd /d "%PROJECT_ROOT%"
npm install >nul 2>&1
if !errorlevel!==0 (
    echo [SUCCESS] Root dependencies installed ✅
) else (
    echo [ERROR] Root dependency installation failed ❌
    set /a INSTALL_FAILURES+=1
)

echo.

REM Summary
echo Installation Summary
echo ===================

if %INSTALL_FAILURES%==0 (
    echo [SUCCESS] All dependencies installed successfully! 🎉
    echo.
    echo ✅ Shared
    echo ✅ API Gateway
    echo ✅ Auth Service
    echo ✅ Transaction Service
    echo ✅ Payment Integration
    echo ✅ KYC Service
    echo ✅ Money Generation
    echo ✅ Frontend
    echo ✅ Root
    echo.
    echo [INFO] Next steps:
    echo 1. Copy .env.development.example to .env.development and configure
    echo 2. Run 'npm run dev' to start development environment
    echo 3. Run 'npm run test:all' to run all tests
) else (
    echo [ERROR] %INSTALL_FAILURES% service^(s^) failed to install dependencies
    exit /b 1
)

echo.
echo [INFO] Installation completed successfully!
goto :eof

:install_service_deps
set service_name=%~1
set service_path=%~2

echo [INFO] Installing dependencies for %service_name%...

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

REM Install dependencies
npm install >nul 2>&1
if !errorlevel!==0 (
    echo [SUCCESS] %service_name% dependencies installed ✅
) else (
    echo [ERROR] %service_name% dependency installation failed ❌
    set /a INSTALL_FAILURES+=1
)

cd /d "%PROJECT_ROOT%"
goto :eof
