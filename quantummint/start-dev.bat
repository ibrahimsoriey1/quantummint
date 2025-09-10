@echo off
REM QuantumMint Platform Development Environment Startup Script
setlocal enabledelayedexpansion

echo ========================================
echo   QuantumMint Development Environment
echo ========================================
echo.

set "INFO=[INFO]"
set "SUCCESS=[SUCCESS]"
set "WARNING=[WARNING]"
set "ERROR=[ERROR]"

echo %INFO% Starting QuantumMint Development Environment...

REM Check if Docker is running
echo %INFO% Checking Docker status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo %ERROR% Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo %SUCCESS% Docker is running

REM Check if .env file exists
if not exist .env (
    if exist .env.development.example (
        copy .env.development.example .env >nul
        echo %WARNING% Created .env file from .env.development.example
        echo %WARNING% Please update the .env file with your configuration
    ) else (
        echo %ERROR% .env.development.example file not found
        pause
        exit /b 1
    )
)

REM Create logs directories
echo %INFO% Creating logs directories...
for %%s in (api-gateway auth-service money-generation transaction-service payment-integration kyc-service) do (
    if not exist %%s\logs mkdir %%s\logs
)

REM Stop any existing containers
echo %INFO% Stopping existing containers...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans >nul 2>&1

REM Start development services
echo %INFO% Starting development services...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

if %errorlevel% neq 0 (
    echo %ERROR% Failed to start services
    pause
    exit /b 1
)

echo %SUCCESS% Development services started successfully!

REM Wait for services to initialize
echo %INFO% Waiting for services to initialize...
timeout /t 15 /nobreak >nul

echo.
echo %SUCCESS% QuantumMint Development Environment is ready!
echo.
echo Development Services:
echo   Frontend (React):      http://localhost:3000
echo   API Gateway:           http://localhost:3000/api
echo   Auth Service:          http://localhost:3001
echo   Money Generation:      http://localhost:3002
echo   Transaction Service:   http://localhost:3003
echo   Payment Integration:   http://localhost:3004
echo   KYC Service:           http://localhost:3005
echo.
echo Database Services:
echo   MongoDB:               mongodb://localhost:27017
echo   Redis:                 redis://localhost:6379
echo   RabbitMQ Management:   http://localhost:15672
echo.
echo Development Tools:
echo   View logs:             docker-compose logs -f [service-name]
echo   Restart service:       docker-compose restart [service-name]
echo   Stop all:              docker-compose down
echo   Rebuild service:       docker-compose build [service-name]
echo.
echo %WARNING% Hot reloading is enabled - changes will auto-restart services
echo.
echo Press any key to view logs or Ctrl+C to exit...
pause >nul

docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
