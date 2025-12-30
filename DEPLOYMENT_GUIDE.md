# ZAAPAR Deployment Guide

Complete step-by-step guide to deploy ZAAPAR to Render and get a live public URL.

**Time to deploy**: ~10 minutes  
**Cost**: Free (Render free tier)  
**Result**: Live public URL like `https://zaapar-xxx.onrender.com`

---

## Prerequisites

- ✅ GitHub account
- ✅ Render account (free at render.com)
- ✅ This repo cloned locally
- ✅ Node.js 20+ installed
- ✅ Git installed

---

## Phase 1: Local Setup (5 mins)

Ensure your local environment works first.

### Windows
```powershell
cd C:\Users\Fidel\Desktop\zaapar
.\setup.bat
```

### macOS/Linux
```bash
cd ~/Desktop/zaapar
bash setup.sh
```

### Start Redis
```bash
docker-compose up -d redis
# (or docker-compose up -d for all services)
```

### Start local server
```powershell
cd server
npm start
# Should print: "Server running on http://localhost:4000"
```

### Test locally
```
http://localhost:4000/register.html
```

If this works, move to Phase 2.

---

## Phase 2: Push to GitHub (3 mins)

### 1. Initialize Git (if not already)
```powershell
cd C:\Users\Fidel\Desktop\zaapar
git init
git add -A
git commit -m "Initial commit: ZAAPAR - AI job seeker platform"
git branch -M main
```

### 2. Add GitHub Remote
```powershell
git remote add origin https://github.com/YOUR_USERNAME/zaapar.git
```
Replace `YOUR_USERNAME` with your actual GitHub username.

### 3. Push to GitHub
```powershell
git push -u origin main
```
When prompted for password, use a GitHub Personal Access Token (PAT):
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" (classic)
3. Give it `repo` and `workflow` scopes
4. Copy the token
5. Paste as password in terminal

**Verify**: Go to https://github.com/YOUR_USERNAME/zaapar — you should see all files.

---

## Phase 3: Deploy to Render (2 mins setup, 3-5 mins deployment)

### Step 1: Create Web Service

1. Go to https://render.com
2. Sign in with GitHub (or create account)
3. Click **New +** → **Web Service**
4. Select **zaapar** repository
5. Configure:
   - **Name**: zaapar
   - **Root Directory**: `server`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free
6. Click **Create Web Service**
7. Render starts building (~2 mins)
8. When done, you'll see a URL like: `https://zaapar-abc123.onrender.com`
9. **Copy this URL** — you'll need it later

### Step 2: Create Background Worker

The background worker processes CV extraction asynchronously.

1. In Render dashboard, click **New +** → **Background Worker**
2. Select **zaapar** repository again
3. Configure:
   - **Name**: zaapar-worker
   - **Root Directory**: `server`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run worker`
   - **Environment**: Node
   - **Plan**: Free
4. Click **Create Background Worker**
5. Wait for build to finish

### Step 3: Add Redis (Required)

The app needs Redis for the job queue. Render provides an add-on.

**For Web Service:**
1. Go to **Web Service Settings** → **Add-ons**
2. Click **Create New** → **Redis**
3. Choose Free plan
4. Click **Create**
5. Render automatically adds these env vars:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`

**For Background Worker:**
Same process—add Redis add-on to the worker service.

### Step 4: Configure Environment Variables

**For Web Service:**
1. Go to **Web Service Settings** → **Environment**
2. Add these variables:
   ```
   NODE_ENV=production
   JWT_SECRET=<GENERATE-STRONG-RANDOM-STRING>
   APP_URL=https://zaapar-abc123.onrender.com
   OPENAI_API_KEY=<YOUR-KEY> (leave blank if you don't have one)
   ALLOWED_ORIGINS=https://zaapar-abc123.onrender.com
   ```
3. Click **Save** (auto-redeploys)

**For Background Worker:**
1. Go to **Background Worker Settings** → **Environment**
2. Add:
   ```
   NODE_ENV=production
   OPENAI_API_KEY=<YOUR-KEY> (leave blank if you don't have one)
   ```
3. Click **Save**

Note: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` are auto-populated from Redis add-on.

### Step 5: Generate JWT_SECRET

You need a strong random string. Use any of these:

**PowerShell:**
```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString() + (New-Guid).ToString())) | Substring 0, 32
```

**Or use online generator:**
https://www.randomkeygen.com/ (use "CodeIgniter" - 32 char hex string)

**Example:**
```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

---

## Phase 4: Test Live Site (2 mins)

After all services show green checkmarks (deployed):

1. Open your live URL: `https://zaapar-abc123.onrender.com/register.html`
2. Register with any email (e.g., `test@gmail.com`)
3. You'll get a verification preview URL in the backend response
4. Click verification link
5. Login with your credentials
6. Upload a PDF resume
7. Click "Start Swipe"
8. You should see AI-recommended jobs

**Congratulations! You're live! 🎉**

---

## Troubleshooting

### "Deployment failed" or "Build failed"
- Go to **Service Logs** and read the error
- Common issues:
  - Missing `REDIS_HOST` env var → Add Redis add-on
  - Node version mismatch → Ensure Node 20+ in Render settings
  - Missing `npm ci` dependencies → Check `server/package.json`

### "Redis connection refused"
- Ensure Redis add-on is created for both Web Service and Worker
- Check `REDIS_HOST` and `REDIS_PASSWORD` are set in Environment
- Wait 30 seconds after adding Redis add-on (provisioning delay)

### "Email verification not sent"
- This is expected in free tier without custom SMTP
- Verification preview URL is printed to backend logs
- To fix: Set `SMTP_*` env vars in Render

### "AI recommendations not working"
- Set `OPENAI_API_KEY` in Render Environment
- Without it, heuristic scoring is used (job title matching — still works!)
- Get key at https://platform.openai.com/account/api-keys

### "Can't upload CV"
- Check backend logs for errors
- Ensure file is a valid PDF
- Max 10MB (multer limit)

---

## Monitoring & Logs

### Check Live Logs
1. Render Dashboard → **Web Service** → **Logs**
2. Watch real-time requests and errors
3. Same for Background Worker

### Check Metrics
1. Render Dashboard → **Service** → **Metrics**
2. View CPU, memory, requests/sec

### Disable Auto-Deploy (Optional)
- By default, Render redeploys on every GitHub push
- To disable: **Service Settings** → **Auto-Deploy** → **Off**

---

## Next Steps

### 1. Upgrade to Paid (Optional)
- Free tier sleeps after 15 mins of inactivity
- Paid tier ($5-15/month) keeps it always running
- Render Dashboard → **Service Settings** → **Plan**

### 2. Add Custom Domain (Optional)
- Render → **Service Settings** → **Custom Domains**
- Add your domain (e.g., `zaapar.com`)
- Update DNS records (instructions provided)

### 3. Add GitHub Auto-Deploy Secrets (Optional)
- For continuous deployment on every GitHub push
- Render Dashboard → **Environment** → Add `GITHUB_TOKEN`
- GitHub Settings → Generate PAT → Paste in Render

### 4. Enable Monitoring (Optional)
- Render Dashboard → **Monitoring** → Enable error alerts
- Get notified if service crashes

### 5. Add More Job Adapters (Future)
- Currently scrapes Indeed
- Add LinkedIn, Google Jobs, etc. (requires API keys)
- See `server/adapters/` folder

---

## Render URLs Reference

After deployment, you'll have:

| Service | URL |
|---------|-----|
| **Web Service** | `https://zaapar-abc123.onrender.com` |
| **Dashboard** | `https://zaapar-abc123.onrender.com/dashboard.html` |
| **Register** | `https://zaapar-abc123.onrender.com/register.html` |
| **API Base** | `https://zaapar-abc123.onrender.com/api/` |

---

## FAQ

**Q: Is it really free?**  
A: Yes! Render free tier includes:
- 750 free dyno hours/month
- 100GB bandwidth/month
- Free Redis add-on (10MB)
- Enough for 1-2 services running 24/7

**Q: What about scaling?**  
A: Start free. When you hit limits:
- Upgrade Web Service to Starter ($5/month, always-on)
- Upgrade Background Worker to Starter ($5/month)
- Upgrade Redis to paid plan if needed

**Q: Can I run this on other platforms?**  
A: Yes! This works on:
- Heroku (similar steps)
- Railway.app
- Vercel (frontend only)
- AWS, GCP, Azure (more complex)

**Q: How do I update the code after deploying?**  
A: Just push to GitHub! Render auto-deploys:
```powershell
git add -A
git commit -m "Update: add feature XYZ"
git push origin main
```
Render rebuilds and redeploys automatically (~2 mins).

---

## Success Checklist

- [ ] Local setup works (http://localhost:4000)
- [ ] Pushed to GitHub
- [ ] Web Service created on Render
- [ ] Background Worker created on Render
- [ ] Redis add-on created for both services
- [ ] Environment variables set
- [ ] Live URL loads (https://zaapar-xxx.onrender.com)
- [ ] Can register and login
- [ ] Can upload CV
- [ ] Can swipe jobs
- [ ] Backend logs show requests

---

## Support

For issues:
1. Check Render logs: Dashboard → Service → Logs
2. Run locally first: `npm start` + `npm run worker`
3. Check `.env` file has all required vars
4. Read error messages in browser console (F12)

---

**You're all set! Your ZAAPAR app is now live for job seekers worldwide.** 🚀

Questions? Check the main [README.md](./README.md) for architecture details.
