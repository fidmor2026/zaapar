#!/usr/bin/env pwsh
# ZAAPAR Auto-Deploy Script (Windows PowerShell)
# Pushes code to GitHub and provides Render deployment instructions

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ZAAPAR Deployment Helper" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if username provided
if ($args.Count -eq 0) {
    Write-Host "❌ Usage: ./deploy.ps1 YOUR_GITHUB_USERNAME" -ForegroundColor Red
    Write-Host ""
    Write-Host "Example: ./deploy.ps1 fidmor2026" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Need a GitHub account? Go to https://github.com/signup" -ForegroundColor Gray
    Write-Host "Need a GitHub PAT? Go to https://github.com/settings/tokens" -ForegroundColor Gray
    exit 1
}

$GITHUB_USERNAME = $args[0]

# Check if git is initialized
if (!(Test-Path ".git")) {
    Write-Host "📌 Initializing Git repository..." -ForegroundColor Yellow
    git init
}

Write-Host ""
Write-Host "📦 Staging code..." -ForegroundColor Yellow
git add -A

Write-Host "📝 Committing..." -ForegroundColor Yellow
git commit -m "ZAAPAR: AI job seeker platform with Tinder-style swipe UI"

Write-Host "🔀 Setting main branch..." -ForegroundColor Yellow
git branch -M main

Write-Host ""
Write-Host "🔗 Adding GitHub remote..." -ForegroundColor Yellow
git remote add origin "https://github.com/$GITHUB_USERNAME/zaapar.git" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "🚀 Pushing to GitHub (you will be prompted for password/PAT)..." -ForegroundColor Yellow
Write-Host "   Paste your GitHub PAT from: https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ CODE PUSHED TO GITHUB!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Go to https://render.com" -ForegroundColor White
    Write-Host "2. Sign in with GitHub" -ForegroundColor White
    Write-Host "3. Click 'New +' → 'Web Service'" -ForegroundColor White
    Write-Host "4. Select 'zaapar' repository" -ForegroundColor White
    Write-Host "5. Configure:" -ForegroundColor White
    Write-Host "   • Name: zaapar" -ForegroundColor White
    Write-Host "   • Root Directory: server" -ForegroundColor White
    Write-Host "   • Build Command: npm ci" -ForegroundColor White
    Write-Host "   • Start Command: npm start" -ForegroundColor White
    Write-Host "6. Click 'Create Web Service'" -ForegroundColor White
    Write-Host ""
    Write-Host "7. Repeat for Background Worker:" -ForegroundColor White
    Write-Host "   • Start Command: npm run worker" -ForegroundColor White
    Write-Host ""
    Write-Host "8. Add Redis add-on to both services" -ForegroundColor White
    Write-Host "9. Set environment variables (see START_HERE.md)" -ForegroundColor White
    Write-Host ""
    Write-Host "For detailed guide: read START_HERE.md" -ForegroundColor Cyan
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "❌ Push failed. Troubleshooting:" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. Check GitHub credentials/PAT:" -ForegroundColor Yellow
    Write-Host "   https://github.com/settings/tokens" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Verify remote URL:" -ForegroundColor Yellow
    Write-Host "   git remote -v" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. If remote is wrong, fix it:" -ForegroundColor Yellow
    Write-Host "   git remote remove origin" -ForegroundColor Gray
    Write-Host "   git remote add origin https://github.com/$GITHUB_USERNAME/zaapar.git" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
