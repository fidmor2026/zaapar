@echo off
REM Quick start script for Zaapar local dev (Windows)

setlocal enabledelayedexpansion

echo === ZAAPAR Local Dev Setup ===
echo.

REM Check Docker
where docker >nul 2>nul
if errorlevel 1 (
  echo WARNING: Docker not found. Skipping services.
  echo Install Docker or start redis, clamav, mailhog manually.
) else (
  echo Starting Redis, ClamAV, and MailHog...
  cd /d %~dp0
  docker-compose up -d redis clamav mailhog || (
    echo docker-compose failed; continue anyway
  )
  echo Services starting ^(check http://localhost:8025 for MailHog^)
)

echo.
echo Installing server dependencies...
cd /d %~dp0
cd server
call npm ci
echo ✓ Dependencies installed

echo.
if not exist .env (
  echo Creating .env from .env.example...
  copy .env.example .env
  echo ✓ .env created. Edit it with your OPENAI_API_KEY, SMTP settings, JWT_SECRET if desired.
) else (
  echo .env already exists, skipping.
)

echo.
echo === Setup complete! ===
echo.
echo Next steps:
echo 1^) Edit server\.env with your configuration
echo 2^) Run in PowerShell / CMD:  npm start
echo 3^) In another terminal run:  npm run worker
echo 4^) Open http://localhost:4000/register.html
echo 5^) Verify email via http://localhost:8025 ^(MailHog^)
echo 6^) Login and test upload/swipe at /dashboard.html
echo.
pause
