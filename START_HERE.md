# 🚀 GET YOUR LIVE URL IN 3 STEPS

**Time needed**: ~10 minutes  
**Result**: Live public URL like `https://zaapar-abc123.onrender.com`  
**Cost**: FREE (Render free tier)

---

## Your Current Status

✅ **Code**: Complete and production-ready  
✅ **Backend**: All endpoints built (auth, upload, jobs, AI, matches)  
✅ **Frontend**: Tinder-style swipe UI complete  
✅ **Worker**: Background job processing ready  
✅ **Security**: Hardened (CORS, CSP, JWT, helmet, bcrypt)  
✅ **Docker**: Ready for containerization  
✅ **GitHub**: Repo initialized and ready to push  

❌ **GitHub**: Code not yet pushed  
❌ **Render**: Services not yet deployed  

---

## YOUR 3-STEP DEPLOYMENT CHECKLIST

### ✅ STEP 1: Push to GitHub (3 mins)

**Why**: Render deploys from GitHub repos. You push code once, Render auto-deploys.

**Copy & paste these commands:**

```powershell
cd C:\Users\Fidel\Desktop\zaapar

# Initialize git (if not already done)
git init

# Stage all code
git add -A
git commit -m "ZAAPAR: AI job seeker platform"

# Set main branch
git branch -M main

# Add GitHub remote (replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/zaapar.git

# Push to GitHub (will ask for password - use GitHub PAT)
git push -u origin main
```

**Get GitHub PAT (Personal Access Token)**:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Check `repo` and `workflow` boxes
4. Click "Generate token"
5. Copy the token (it will disappear after you leave the page)
6. Use it as password when `git push` asks

**Verify**: Open https://github.com/YOUR_USERNAME/zaapar — should see all your files

---

### ✅ STEP 2: Deploy on Render (5 mins setup, 5 mins waiting)

Go to https://render.com and sign in with GitHub.

#### 2a. Create Web Service

1. Click **New +** → **Web Service**
2. Select your **zaapar** repository
3. Fill in these fields:
   - **Name**: `zaapar`
   - **Root Directory**: `server`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free
4. Click **Create Web Service**
5. Render starts building (~2 mins)
6. Wait until you see a URL like: `https://zaapar-abc123.onrender.com`
7. **Copy this URL** for later

#### 2b. Create Background Worker

1. Click **New +** → **Background Worker**
2. Select your **zaapar** repository again
3. Fill in:
   - **Name**: `zaapar-worker`
   - **Root Directory**: `server`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run worker`
   - **Environment**: Node
   - **Plan**: Free
4. Click **Create Background Worker**
5. Wait for build to finish (~2 mins)

#### 2c. Add Redis (Required for job queue)

**On the Web Service:**
1. Go to **Settings** → **Add-ons**
2. Click **Create New** → **Redis**
3. Select **Free** plan
4. Click **Create**
5. Render auto-adds these env vars (you'll see them in Environment tab)

**On the Background Worker:**
1. Repeat the same (Settings → Add-ons → Create New → Redis → Free → Create)

#### 2d. Set Environment Variables

**On Web Service** (Settings → Environment tab):

```
NODE_ENV=production
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
APP_URL=https://zaapar-abc123.onrender.com
ALLOWED_ORIGINS=https://zaapar-abc123.onrender.com
OPENAI_API_KEY=sk-xxxxxxx (optional - skip if you don't have it)
```

(Replace `zaapar-abc123.onrender.com` with your actual Render URL from Step 2a)

**For JWT_SECRET**: Go to https://www.randomkeygen.com/ → copy the "CodeIgniter" string (32 chars)

**On Background Worker** (Settings → Environment tab):

```
NODE_ENV=production
OPENAI_API_KEY=sk-xxxxxxx (optional - skip if you don't have it)
```

(Redis vars are auto-populated from the add-on)

---

### ✅ STEP 3: Test Your Live Site (2 mins)

After all services show **green checkmarks** (deployed):

1. Open: `https://zaapar-abc123.onrender.com/register.html`
2. Click **Register**
3. Enter any email (e.g., `test@gmail.com`) and password
4. You'll see a verification email preview link
5. Click the link to verify your email
6. Click **Login** with same credentials
7. Click **Upload CV** and upload a PDF resume
8. Click **Start Swipe**
9. You should see AI-recommended jobs to swipe through

**If everything works → YOU'RE LIVE! 🎉**

---

## Troubleshooting (Quick Fixes)

### "Build failed" or "Deployment failed"
- Check Render dashboard: Service → **Logs** tab
- Most common fix: Create Redis add-on (Step 2c)
- Wait 30 seconds after creating Redis add-on (provisioning time)

### "Redis connection refused"
- Ensure Redis add-on is created for **both** Web Service and Worker
- Check Environment variables show `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Wait 30 seconds and refresh page

### "Email verification not working"
- This is expected in free tier without custom SMTP
- Verification URL is printed in backend logs
- To fix later: Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` in Environment

### "AI recommendations showing generic scores"
- You need OpenAI API key for smart scoring
- Get one: https://platform.openai.com/account/api-keys
- Add to Render Environment as `OPENAI_API_KEY`
- Click Save (auto-redeploys)

---

## That's All You Need! 🎯

**Your live URLs**:

```
Register:    https://zaapar-abc123.onrender.com/register.html
Dashboard:   https://zaapar-abc123.onrender.com/dashboard.html
API:         https://zaapar-abc123.onrender.com/api/
```

**Share with friends**: Anyone can visit your public URL and job hunt!

---

## What Happens When You Update Code?

After deployment, to push new changes:

```powershell
cd C:\Users\Fidel\Desktop\zaapar
git add -A
git commit -m "Update: describe your change"
git push origin main
```

Render automatically rebuilds and redeploys (~2 mins). No manual Render steps needed!

---

## Keep It Running Forever (Optional)

- **Free tier**: Falls asleep after 15 mins of inactivity
- **Upgrade to Paid**: $5-15/month keeps it always-on
- Render Dashboard → Service Settings → Plan → Choose paid

---

## Questions?

1. **Check Render logs first**: Service → Logs tab (has all error messages)
2. **Read DEPLOYMENT_GUIDE.md**: Detailed step-by-step walkthrough
3. **Check PROJECT_STATUS.md**: Complete inventory of what's built
4. **Read README.md**: Architecture and configuration details

---

## READY? LET'S GO! 🚀

Next action: Copy Step 1 commands above and run them in PowerShell.

**The world needs your job platform. Go make it live!**

Good luck! 🎉
