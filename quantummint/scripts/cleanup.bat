@echo off
REM QuantumMint Platform Cleanup Script for Windows
setlocal enabledelayedexpansion

echo ========================================
echo     QuantumMint Platform Cleanup
echo ========================================
echo.

set "INFO=[INFO]"
set "SUCCESS=[SUCCESS]"
set "WARNING=[WARNING]"
set "ERROR=[ERROR]"

if "%1"=="" goto show_help
if "%1"=="--help" goto show_help

REM Parse command line arguments
:parse_args
if "%1"=="--containers" (
    call :cleanup_containers
    shift
    goto parse_args
)
if "%1"=="--images" (
    call :cleanup_images
    shift
    goto parse_args
)
if "%1"=="--volumes" (
    call :cleanup_volumes
    shift
    goto parse_args
)
if "%1"=="--networks" (
    call :cleanup_networks
    shift
    goto parse_args
)
if "%1"=="--logs" (
    call :cleanup_logs
    shift
    goto parse_args
)
if "%1"=="--all" (
    call :complete_cleanup
    shift
    goto parse_args
)
if not "%1"=="" (
    echo %ERROR% Unknown option: %1
    goto show_help
)

echo %SUCCESS% Cleanup operations completed!
goto end

:show_help
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   --containers    Stop and remove all containers
echo   --images        Remove all QuantumMint images
echo   --volumes       Remove all volumes (WARNING: This will delete all data!)
echo   --networks      Remove custom networks
echo   --all           Complete cleanup (containers, images, volumes, networks)
echo   --logs          Clear all log files
echo   --help          Show this help message
echo.
echo Examples:
echo   %0 --containers          # Stop and remove containers only
echo   %0 --images --volumes    # Remove images and volumes
echo   %0 --all                 # Complete cleanup
goto end

:cleanup_containers
echo %INFO% Stopping and removing containers...

REM Stop all services
docker-compose down --remove-orphans >nul 2>&1
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans >nul 2>&1

REM Remove any remaining QuantumMint containers
for /f "tokens=*" %%i in ('docker ps -a --filter "name=quantummint" --format "{{.ID}}" 2^>nul') do (
    docker rm -f %%i >nul 2>&1
)

echo %SUCCESS% Removed QuantumMint containers
goto :eof

:cleanup_images
echo %INFO% Removing QuantumMint images...

REM Remove QuantumMint images
for /f "tokens=*" %%i in ('docker images --filter "reference=quantummint*" --format "{{.ID}}" 2^>nul') do (
    docker rmi -f %%i >nul 2>&1
)

REM Remove dangling images
for /f "tokens=*" %%i in ('docker images -f "dangling=true" -q 2^>nul') do (
    docker rmi %%i >nul 2>&1
)

echo %SUCCESS% Removed QuantumMint images
goto :eof

:cleanup_volumes
echo %WARNING% This will permanently delete all database data!
set /p "confirm=Are you sure you want to continue? (y/N): "
if /i not "%confirm%"=="y" (
    echo %INFO% Volume cleanup cancelled
    goto :eof
)

echo %INFO% Removing volumes...

REM Remove named volumes
for /f "tokens=*" %%i in ('docker volume ls --filter "name=quantummint" --format "{{.Name}}" 2^>nul') do (
    docker volume rm %%i >nul 2>&1
)

REM Remove dangling volumes
for /f "tokens=*" %%i in ('docker volume ls -f "dangling=true" -q 2^>nul') do (
    docker volume rm %%i >nul 2>&1
)

echo %SUCCESS% Removed QuantumMint volumes
goto :eof

:cleanup_networks
echo %INFO% Removing custom networks...

REM Remove QuantumMint networks
for /f "tokens=*" %%i in ('docker network ls --filter "name=quantummint" --format "{{.ID}}" 2^>nul') do (
    docker network rm %%i >nul 2>&1
)

echo %SUCCESS% Removed QuantumMint networks
goto :eof

:cleanup_logs
echo %INFO% Clearing log files...

for %%s in (api-gateway auth-service money-generation transaction-service payment-integration kyc-service) do (
    if exist %%s\logs (
        del /q %%s\logs\* >nul 2>&1
        echo %INFO% Cleared logs for %%s
    )
)

echo %SUCCESS% Log files cleared
goto :eof

:complete_cleanup
echo %WARNING% This will perform a complete cleanup of the QuantumMint platform!
echo %WARNING% All containers, images, volumes, and data will be removed!
set /p "confirm=Are you sure you want to continue? (y/N): "
if /i not "%confirm%"=="y" (
    echo %INFO% Complete cleanup cancelled
    goto :eof
)

call :cleanup_containers
call :cleanup_images
call :cleanup_volumes
call :cleanup_networks
call :cleanup_logs

REM Docker system prune
echo %INFO% Running Docker system prune...
docker system prune -f >nul 2>&1

echo %SUCCESS% Complete cleanup finished!
goto :eof

:end
pause
