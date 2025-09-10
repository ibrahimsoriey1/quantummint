@echo off
REM QuantumMint Mail Server Setup Script for Windows
REM This script sets up the mail server environment and dependencies

setlocal enabledelayedexpansion

echo 🚀 Setting up QuantumMint Mail Server...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18 or higher.
    pause
    exit /b 1
)

echo [INFO] Node.js version: 
node --version

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed
    pause
    exit /b 1
)

echo [INFO] npm version: 
npm --version

REM Create necessary directories
echo [INFO] Creating directory structure...
if not exist "logs" mkdir logs
if not exist "certs" mkdir certs
if not exist "keys" mkdir keys
if not exist "keys\dkim" mkdir keys\dkim
if not exist "data" mkdir data
if not exist "backups" mkdir backups

echo [INFO] Directory structure created ✓

REM Install dependencies
echo [INFO] Installing Node.js dependencies...
npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo [INFO] Dependencies installed ✓

REM Generate environment file
if not exist ".env" (
    echo [INFO] Creating environment configuration...
    copy ".env.example" ".env"
    echo [INFO] Environment file created ✓
    echo [WARNING] Please update .env file with your specific configuration
) else (
    echo [WARNING] Environment file already exists. Skipping creation.
)

REM Generate TLS certificates using OpenSSL if available
where openssl >nul 2>&1
if not errorlevel 1 (
    if not exist "certs\private.key" (
        echo [INFO] Generating self-signed TLS certificates...
        openssl req -x509 -newkey rsa:2048 -keyout certs\private.key -out certs\certificate.crt -days 365 -nodes -subj "/C=US/ST=CA/L=San Francisco/O=QuantumMint/CN=mail.quantummint.com"
        echo [INFO] TLS certificates generated ✓
        echo [WARNING] Self-signed certificates are for development only. Use proper certificates in production.
    ) else (
        echo [INFO] TLS certificates already exist ✓
    )
) else (
    echo [WARNING] OpenSSL not found. Please install OpenSSL to generate TLS certificates.
    echo [INFO] You can download OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html
)

REM Generate DKIM keys if OpenSSL is available
where openssl >nul 2>&1
if not errorlevel 1 (
    if not exist "keys\dkim" mkdir keys\dkim
    if not exist "keys\dkim\quantummint.com" mkdir keys\dkim\quantummint.com
    
    if not exist "keys\dkim\quantummint.com\quantum.private" (
        echo [INFO] Generating DKIM keys...
        openssl genrsa -out keys\dkim\quantummint.com\quantum.private 2048
        openssl rsa -in keys\dkim\quantummint.com\quantum.private -pubout -out keys\dkim\quantummint.com\quantum.public
        echo [INFO] DKIM keys generated ✓
    ) else (
        echo [INFO] DKIM keys already exist ✓
    )
)

REM Check for Docker
docker --version >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Docker found. You can use docker-compose for easy deployment ✓
    
    docker-compose --version >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Docker Compose found ✓
        echo.
        echo [INFO] To start with Docker Compose:
        echo   docker-compose up -d
        echo.
    )
) else (
    echo [WARNING] Docker not found. Manual service installation required for MongoDB, Redis, etc.
)

REM Create Windows service batch file
echo [INFO] Creating Windows service helper...
echo @echo off > install-service.bat
echo echo Installing QuantumMint Mail Server as Windows Service... >> install-service.bat
echo sc create "QuantumMint Mail Server" binPath= "%CD%\node.exe src\server.js" start= auto >> install-service.bat
echo echo Service installed. Use 'sc start "QuantumMint Mail Server"' to start >> install-service.bat

echo [INFO] Windows service helper created: install-service.bat

REM Display DNS setup information
echo.
echo [INFO] DNS Setup Required:
echo Add these DNS records to your domain:
echo.
echo MX Record:
echo   quantummint.com MX 10 mail.quantummint.com
echo.
echo A Records:
echo   mail.quantummint.com A [YOUR_SERVER_IP]
echo   webmail.quantummint.com A [YOUR_SERVER_IP]
echo.
echo SPF Record:
echo   quantummint.com TXT "v=spf1 ip4:[YOUR_SERVER_IP] ~all"
echo.
echo DMARC Record:
echo   _dmarc.quantummint.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@quantummint.com"
echo.

REM Display next steps
echo [INFO] Setup completed successfully! 🎉
echo.
echo Next steps:
echo 1. Update .env file with your specific configuration
echo 2. Set up MongoDB and Redis (or use Docker Compose)
echo 3. Configure DNS records for your domain
echo 4. Update TLS certificates for production use
echo 5. Start the mail server: npm start
echo.
echo For development: npm run dev
echo For production with Docker: docker-compose up -d
echo.
echo [WARNING] Remember to change default passwords and secure your installation!

pause
exit /b 0
