@echo off
REM QuantumMint Platform Deployment Script for Windows
setlocal enabledelayedexpansion

echo ========================================
echo     QuantumMint Platform Deployment
echo ========================================
echo.

REM Colors for output (Windows doesn't support colors natively, but we'll use echo)
set "INFO=[INFO]"
set "SUCCESS=[SUCCESS]"
set "WARNING=[WARNING]"
set "ERROR=[ERROR]"

echo %INFO% Starting QuantumMint Platform Deployment...

REM Check if Docker and Docker Compose are installed
echo %INFO% Checking dependencies...

docker --version >nul 2>&1
if errorlevel 1 (
    echo %ERROR% Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo %ERROR% Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

echo %SUCCESS% Dependencies check passed

REM Create environment file if it doesn't exist
echo %INFO% Setting up environment configuration...

if not exist .env (
    if exist .env.docker.example (
        copy .env.docker.example .env >nul
        echo %WARNING% Created .env file from .env.docker.example
        echo %WARNING% Please update the .env file with your actual configuration values
    ) else (
        echo %ERROR% .env.docker.example file not found
        pause
        exit /b 1
    )
) else (
    echo %SUCCESS% Environment file already exists
)

REM Build and start services
echo %INFO% Building and starting services...

REM Stop any running containers
echo %INFO% Stopping existing containers...
docker-compose down --remove-orphans

REM Build images
echo %INFO% Building Docker images...
docker-compose build --no-cache

REM Start services
echo %INFO% Starting services...
docker-compose up -d

if errorlevel 1 (
    echo %ERROR% Failed to start services
    pause
    exit /b 1
)

echo %SUCCESS% Services started successfully

REM Wait for services to be ready
echo %INFO% Waiting for services to be ready...
echo %INFO% This may take a few minutes...

REM Wait a bit for services to initialize
timeout /t 30 /nobreak >nul

REM Initialize database
echo %INFO% Initializing database...
docker-compose exec -T mongodb mongosh quantummint --eval "db.users.createIndex({ email: 1 }, { unique: true }); db.transactions.createIndex({ userId: 1, createdAt: -1 }); print('Database indexes created');"

echo %SUCCESS% Database initialized

REM Display deployment information
echo.
echo %SUCCESS% QuantumMint Platform deployed successfully!
echo.
echo Service Information:
echo   Frontend:              http://localhost
echo   API Gateway:           http://localhost:3000
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
echo Monitoring:
echo   View logs:             docker-compose logs -f [service-name]
echo   Check status:          docker-compose ps
echo   Stop services:         docker-compose down
echo.
echo %WARNING% Don't forget to update your .env file with production values!
echo.
echo %SUCCESS% Deployment completed successfully!

pause
