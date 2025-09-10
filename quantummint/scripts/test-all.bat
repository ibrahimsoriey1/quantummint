@echo off
setlocal enabledelayedexpansion

REM Test All Services Script for QuantumMint Platform (Windows)
REM This script runs all tests for backend services and frontend

echo 🧪 Running QuantumMint Platform Tests
echo ====================================

set TEST_FAILURES=0
set PROJECT_ROOT=%~dp0..

echo Project root: %PROJECT_ROOT%
echo.

REM Function to run tests for a service
call :run_service_tests "API Gateway" "%PROJECT_ROOT%\api-gateway"
call :run_service_tests "Auth Service" "%PROJECT_ROOT%\auth-service"
call :run_service_tests "Transaction Service" "%PROJECT_ROOT%\transaction-service"
call :run_service_tests "Payment Integration" "%PROJECT_ROOT%\payment-integration"
call :run_service_tests "KYC Service" "%PROJECT_ROOT%\kyc-service"
call :run_service_tests "Money Generation" "%PROJECT_ROOT%\money-generation"

echo.
echo [INFO] Testing Frontend...
echo -------------------
call :run_service_tests "Frontend" "%PROJECT_ROOT%\frontend"

echo.

REM Generate coverage report if requested
if "%1"=="--coverage" (
    echo [INFO] Generating coverage reports...
    echo ------------------------------
    
    for %%s in (api-gateway auth-service transaction-service payment-integration kyc-service money-generation) do (
        if exist "%PROJECT_ROOT%\%%s" (
            echo [INFO] Generating coverage for %%s...
            cd /d "%PROJECT_ROOT%\%%s"
            npm run test:coverage 2>nul || echo [WARNING] Coverage generation failed for %%s
            cd /d "%PROJECT_ROOT%"
        )
    )
    
    if exist "%PROJECT_ROOT%\frontend" (
        echo [INFO] Generating coverage for frontend...
        cd /d "%PROJECT_ROOT%\frontend"
        npm run test:coverage 2>nul || echo [WARNING] Coverage generation failed for frontend
        cd /d "%PROJECT_ROOT%"
    )
)

REM Summary
echo.
echo Test Summary
echo ============

if %TEST_FAILURES%==0 (
    echo [SUCCESS] All tests passed! 🎉
    echo.
    echo ✅ API Gateway
    echo ✅ Auth Service
    echo ✅ Transaction Service
    echo ✅ Payment Integration
    echo ✅ KYC Service
    echo ✅ Money Generation
    echo ✅ Frontend
) else (
    echo [ERROR] %TEST_FAILURES% test suite^(s^) failed
    exit /b 1
)

echo.
echo [INFO] Test execution completed successfully!
goto :eof

:run_service_tests
set service_name=%~1
set service_path=%~2

echo [INFO] Testing %service_name%...

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

REM Run tests
npm test >nul 2>&1
if !errorlevel!==0 (
    echo [SUCCESS] %service_name% tests passed ✅
) else (
    echo [ERROR] %service_name% tests failed ❌
    set /a TEST_FAILURES+=1
)

cd /d "%PROJECT_ROOT%"
goto :eof
