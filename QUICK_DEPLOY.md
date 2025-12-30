# QUICK DEPLOY — Copy & Paste Commands

**Goal**: Get ZAAPAR live on Render in ~10 minutes.

---

## Step 1: Verify Local Setup Works

```powershell
cd C:\Users\Fidel\Desktop\zaapar
.\setup.bat
docker-compose up -d redis
cd server
npm start
# Open http://localhost:4000/register.html in browser
# Should see: "Register for ZAAPAR"
```

If this works, continue to Step 2.

---

## Step 2: Push to GitHub

```powershell
cd C:\Users\Fidel\Desktop\zaapar

# If git not initialized
git init

# Stage everything
git add -A
git commit -m "Initial: ZAAPAR AI job platform"
git branch -M main

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/zaapar.git

# Push (will ask for GitHub password/PAT)
git push -u origin main
```

When asked for password: Use GitHub Personal Access Token from https://github.com/settings/tokens

**Verify**: Open https://github.com/YOUR_USERNAME/zaapar — should show all files

---

## Step 3: Deploy on Render (Dashboard Clicks)

Go to https://render.com and sign in with GitHub.

### Create Web Service

1. Click **New +** → **Web Service**
2. Select `zaapar` repository
3. Fill in:
   - **Name**: `zaapar`
   - **Root Directory**: `server`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
4. Click **Create Web Service** and wait for deploy

**Copy your URL from the dashboard** (looks like: `https://zaapar-abc123.onrender.com`)

### Create Background Worker

1. Click **New +** → **Background Worker**
2. Select `zaapar` repository
3. Fill in:
   - **Name**: `zaapar-worker`
   - **Root Directory**: `server`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run worker`
4. Click **Create Background Worker**

### Add Redis Add-On

**On Web Service:**
- Go to **Settings** → **Add-ons**
- Click **Create New** → **Redis**
- Select **Free**
- Click **Create**

**On Background Worker:**
- Repeat the same process

### Set Environment Variables

**On Web Service Settings → Environment:**

```
NODE_ENV=production
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
APP_URL=https://YOUR_RENDER_URL_HERE
ALLOWED_ORIGINS=https://YOUR_RENDER_URL_HERE
OPENAI_API_KEY=<optional - leave blank if you don't have OpenAI key>
```

**On Background Worker Settings → Environment:**
```
NODE_ENV=production
OPENAI_API_KEY=<optional>
```

(Redis vars auto-populated from add-on)

---

## Step 4: Generate JWT_SECRET

Pick the easiest option:

### Option A: Online Generator
Go to https://www.randomkeygen.com/ and copy "CodeIgniter" string (32 chars).

Example output:
```
e7c4d8a2b1f9e3c6a9d4b7e2f5c8a1d4
```

### Option B: PowerShell
```powershell
-join ((0..31) | ForEach-Object { [char][int][Math]::Floor(16 * [random]::NextDouble() + 48) }) | ? {$_ -match '[a-f0-9]'} | Select-Object -First 32
```

Use whatever you get as your `JWT_SECRET`.

---

## Step 5: Test Live

After all services show green checkmarks:

```
https://YOUR_RENDER_URL/register.html
```

1. Register with email
2. Check logs for verification link
3. Click link to verify
4. Login
5. Upload PDF resume
6. Click "Start Swipe"
7. See job recommendations

---

## That's It! 🎉

Your live URL is:
```
https://zaapar-abc123.onrender.com
```

Share it with friends. It's live!

---

## Troubleshooting (Copy-Paste Fixes)

### "Build failed" or "Deployment failed"
- Check Render dashboard **Logs** tab for error
- Most common: Missing Redis add-on
  - Go to **Settings** → **Add-ons** → **Create New Redis**

### "Redis connection refused"
```
Wait 30 seconds after creating Redis add-on (provisioning takes time)
Then check Environment Variables are set
```

### "Email verification not sent"
This is normal in free tier. Verification URL is in backend logs.

### "CV upload not working"
```
Check Render dashboard → Web Service → Logs
Look for multer errors
Max file size is 10MB
```

### "AI recommendations disabled"
You need OpenAI key:
1. Get key: https://platform.openai.com/account/api-keys
2. Set in Render **Environment** as `OPENAI_API_KEY`
3. Click Save (auto-redeploys)

---

## Update Code After Deployment

To push changes live:

```powershell
cd C:\Users\Fidel\Desktop\zaapar
git add -A
git commit -m "Updated: your change description"
git push origin main
```

Render auto-rebuilds and redeploys (~2 mins).

---

## Next (Optional)

- **Keep it always-on**: Upgrade to Paid ($5/month) in Render settings
- **Add custom domain**: Render Settings → Custom Domains
- **Monitor errors**: Render → Monitoring tab

---

**Done!** Your ZAAPAR app is now live and shareable. 🚀
