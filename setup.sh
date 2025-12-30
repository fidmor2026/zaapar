#!/usr/bin/env bash
# Quick start script for Zaapar local dev

set -e

echo "=== ZAAPAR Local Dev Setup ==="
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "WARNING: Docker not found. Skipping services (redis, clamav, mailhog)."
  echo "Install Docker or start these services manually."
else
  echo "Starting Redis, ClamAV, and MailHog..."
  docker-compose up -d redis clamav mailhog || echo "docker-compose failed; continue anyway"
  echo "Services starting (check http://localhost:8025 for MailHog in a minute)"
fi

echo ""
echo "Installing server dependencies..."
cd server
npm ci
echo "✓ Dependencies installed"

echo ""
echo "Creating .env from .env.example..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env created. Edit it with your OPENAI_API_KEY, SMTP settings, JWT_SECRET if desired."
else
  echo ".env already exists, skipping."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1) Edit server/.env with your configuration (OPENAI_API_KEY, SMTP, JWT_SECRET, etc.)"
echo "2) In one terminal, run:  npm start"
echo "3) In another terminal, run:  npm run worker"
echo "4) Open http://localhost:4000/register.html in your browser"
echo "5) Verify email via http://localhost:8025 (MailHog)"
echo "6) Login at http://localhost:4000/login.html"
echo "7) Upload CV and swipe at http://localhost:4000/dashboard.html"
echo ""
