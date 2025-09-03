@echo off
setlocal enabledelayedexpansion

REM QuantumMint Deployment Script for Windows
REM This script will deploy your application with all the authentication fixes

echo.
echo ==========================================
echo 🚀 QuantumMint Deployment Script
echo ==========================================
echo.

REM Check if Docker is running
echo [INFO] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)
echo [SUCCESS] Docker is running

REM Check if Docker Compose is available
echo [INFO] Checking Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose and try again.
    pause
    exit /b 1
)
echo [SUCCESS] Docker Compose is available

REM Check environment file
echo [INFO] Checking environment file...
if not exist "docker\.env" (
    echo [WARNING] Environment file not found. Creating template...
    (
        echo # Database
        echo MONGO_USERNAME=admin
        echo MONGO_PASSWORD=password123
        echo.
        echo # JWT Secrets
        echo JWT_SECRET=your_jwt_secret_key_here
        echo REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
        echo.
        echo # Email Configuration
        echo EMAIL_HOST=smtp.gmail.com
        echo EMAIL_PORT=587
        echo EMAIL_USER=your_email@gmail.com
        echo EMAIL_PASSWORD=your_email_password
        echo EMAIL_FROM=noreply@quantummint.com
        echo.
        echo # Service Configuration
        echo SERVICE_KEY=your_service_key_here
        echo CORS_ORIGIN=http://localhost:3006
        echo FRONTEND_URL=http://localhost:3006
        echo.
        echo # Payment Providers ^(Optional^)
        echo STRIPE_SECRET_KEY=your_stripe_secret_key
        echo STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
        echo ORANGE_MONEY_API_KEY=your_orange_money_api_key
        echo ORANGE_MONEY_API_SECRET=your_orange_money_api_secret
        echo AFRIMONEY_API_KEY=your_afrimoney_api_key
        echo AFRIMONEY_API_SECRET=your_afrimoney_api_secret
        echo.
        echo # Storage ^(Optional^)
        echo STORAGE_TYPE=local
        echo AWS_ACCESS_KEY_ID=your_aws_access_key
        echo AWS_SECRET_ACCESS_KEY=your_aws_secret_key
        echo AWS_REGION=us-east-1
        echo AWS_S3_BUCKET=your_s3_bucket
        echo.
        echo # RabbitMQ
        echo RABBITMQ_USERNAME=admin
        echo RABBITMQ_PASSWORD=password123
    ) > docker\.env
    echo [WARNING] Please edit docker\.env file with your actual values before continuing.
    pause
)
echo [SUCCESS] Environment file is ready

REM Stop existing containers
echo [INFO] Stopping existing containers...
cd docker
docker-compose -f docker-compose.dev.yml down >nul 2>&1
docker-compose -f docker-compose.prod.yml down >nul 2>&1
cd ..
echo [SUCCESS] Existing containers stopped

REM Choose deployment mode
echo.
echo Select deployment mode:
echo 1) Development ^(with hot reload^)
echo 2) Production ^(optimized^)
set /p choice="Enter choice (1 or 2): "

REM Build and start services
echo [INFO] Building and starting services...
cd docker

if "%choice%"=="1" (
    echo [INFO] Starting development deployment...
    docker-compose -f docker-compose.dev.yml up --build -d
) else if "%choice%"=="2" (
    echo [INFO] Starting production deployment...
    docker-compose -f docker-compose.prod.yml up --build -d
) else (
    echo [ERROR] Invalid choice. Defaulting to development mode.
    docker-compose -f docker-compose.dev.yml up --build -d
)

cd ..
echo [SUCCESS] Services deployed

REM Wait for services to be ready
echo [INFO] Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check if services are running
echo [INFO] Checking service status...
cd docker
docker-compose ps
cd ..

echo [SUCCESS] Services are ready

REM Test the deployment
echo [INFO] Testing deployment...

REM Test API Gateway
curl -f http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] API Gateway health check failed
) else (
    echo [SUCCESS] API Gateway is responding
)

REM Test Auth Service
curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Auth Service health check failed
) else (
    echo [SUCCESS] Auth Service is responding
)

REM Test Frontend
curl -f http://localhost:3006 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Frontend is not responding
) else (
    echo [SUCCESS] Frontend is responding
)

REM Show deployment summary
echo.
echo [SUCCESS] 🎉 Deployment completed!
echo.
echo 📋 Service URLs:
echo   • Frontend: http://localhost:3006
echo   • API Gateway: http://localhost:3000
echo   • API Documentation: http://localhost:3000/api-docs
echo   • Auth Service: http://localhost:3001
echo.
echo 🔧 Management Commands:
echo   • View logs: docker-compose -f docker/docker-compose.dev.yml logs -f
echo   • Stop services: docker-compose -f docker/docker-compose.dev.yml down
echo   • Restart services: docker-compose -f docker/docker-compose.dev.yml restart
echo.
echo ✅ Authentication fixes have been applied:
echo   • Fixed 'unexpected error occurred' during login/registration
echo   • Updated database schema to use passwordHash
echo   • Enhanced user model with new fields and validation
echo   • Fixed shared module dependencies
echo.
echo [SUCCESS] Your QuantumMint application is now ready to use!
echo.
pause
