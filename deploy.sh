#!/bin/bash
# ZAAPAR Auto-Deploy Script
# Pushes code to GitHub and provides Render deployment instructions

echo "════════════════════════════════════════════════════════"
echo "  ZAAPAR Deployment Helper"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📌 Initializing Git repository..."
    git init
fi

# Check if user has provided GitHub username
if [ -z "$1" ]; then
    echo "❌ Usage: ./deploy.sh YOUR_GITHUB_USERNAME"
    echo ""
    echo "Example: ./deploy.sh fidmor2026"
    echo ""
    echo "Need a GitHub account? Go to https://github.com/signup"
    echo "Need a GitHub PAT? Go to https://github.com/settings/tokens"
    exit 1
fi

GITHUB_USERNAME=$1

echo ""
echo "📦 Staging code..."
git add -A

echo "📝 Committing..."
git commit -m "ZAAPAR: AI job seeker platform with Tinder-style swipe UI"

echo "🔀 Setting main branch..."
git branch -M main

echo ""
echo "🔗 Adding GitHub remote..."
git remote add origin https://github.com/$GITHUB_USERNAME/zaapar.git 2>/dev/null || true

echo ""
echo "🚀 Pushing to GitHub (you will be prompted for password/PAT)..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo "  ✅ CODE PUSHED TO GITHUB!"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Go to https://render.com"
    echo "2. Sign in with GitHub"
    echo "3. Click 'New +' → 'Web Service'"
    echo "4. Select 'zaapar' repository"
    echo "5. Configure:"
    echo "   • Name: zaapar"
    echo "   • Root Directory: server"
    echo "   • Build Command: npm ci"
    echo "   • Start Command: npm start"
    echo "6. Click 'Create Web Service'"
    echo ""
    echo "7. Repeat for Background Worker:"
    echo "   • Start Command: npm run worker"
    echo ""
    echo "8. Add Redis add-on to both services"
    echo "9. Set environment variables (see START_HERE.md)"
    echo ""
    echo "For detailed guide: read START_HERE.md"
    echo ""
else
    echo ""
    echo "❌ Push failed. Troubleshooting:"
    echo ""
    echo "1. Check GitHub credentials/PAT:"
    echo "   https://github.com/settings/tokens"
    echo ""
    echo "2. Verify remote URL:"
    echo "   git remote -v"
    echo ""
    echo "3. If remote is wrong, fix it:"
    echo "   git remote remove origin"
    echo "   git remote add origin https://github.com/$GITHUB_USERNAME/zaapar.git"
    echo ""
    exit 1
fi
