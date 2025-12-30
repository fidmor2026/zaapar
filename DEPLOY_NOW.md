# ⚡ FASTEST PATH TO LIVE URL — 10 MINUTES

**Read this if you want to deploy NOW without reading anything else.**

---

## What You Need

1. GitHub account (https://github.com/signup)
2. GitHub PAT (Personal Access Token):
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Check `repo` and `workflow`
   - Click "Generate token"
   - **Copy the token** (won't show again!)
3. Render account (https://render.com)

---

## THE 3 COMMANDS

### Command 1: Push to GitHub (3 mins)

```powershell
cd C:\Users\Fidel\Desktop\zaapar
git add -A
git commit -m "ZAAPAR deployment"
git remote add origin https://github.com/YOUR_USERNAME/zaapar.git
git push -u origin main
```

When asked for password: **Paste your GitHub PAT**

Replace `YOUR_USERNAME` with your actual GitHub username.

### Command 2: Deploy on Render (5 mins setup + 5 mins waiting)

1. Go to https://render.com → Sign in with GitHub
2. Click **New +** → **Web Service**
3. Select `zaapar` repo
4. Fill in:
   - Name: `zaapar`
   - Root: `server`
   - Build: `npm ci`
   - Start: `npm start`
5. Click **Create Web Service** → Wait for build
6. **Copy the URL** (looks like `https://zaapar-abc123.onrender.com`)

### Command 3: Add Worker & Redis (5 mins)

1. Click **New +** → **Background Worker**
2. Select `zaapar`
3. Fill in:
   - Name: `zaapar-worker`
   - Root: `server`
   - Build: `npm ci`
   - Start: `npm run worker`
4. Click **Create**

5. On **Web Service**, go to **Settings** → **Add-ons**
6. Click **Create New** → **Redis** → **Free** → **Create**
7. On **Background Worker**, repeat Redis add-on creation

8. On **Web Service**, go to **Environment**
9. Add these variables:
   ```
   NODE_ENV=production
   JWT_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
   APP_URL=https://zaapar-abc123.onrender.com
   ALLOWED_ORIGINS=https://zaapar-abc123.onrender.com
   ```
10. Click **Save**

---

## TEST (2 mins)

Open: `https://zaapar-abc123.onrender.com/register.html`

1. Register with email + password
2. Verify email (click link shown in logs)
3. Login
4. Upload a PDF
5. Click "Start Swipe"
6. See jobs!

---

## IF SOMETHING FAILS

**Check Render logs**: Service → Logs tab (it will tell you what's wrong)

**Most common issue**: Redis not created
- Fix: Settings → Add-ons → Create Redis

**Email not sending**: Expected (uses test SMTP)
- Verification URL is in backend logs

**AI not working**: Need OpenAI API key
- Get it: https://platform.openai.com/account/api-keys
- Add to Render: Environment → OPENAI_API_KEY → Save

---

## YOU'RE LIVE! 🎉

Your URL: `https://zaapar-abc123.onrender.com`

Share it! Job seekers can now:
- Register
- Upload resumes
- Swipe through AI-recommended jobs
- Save matches

---

## Optional: Update Code Later

Push changes to GitHub → Render auto-deploys:

```powershell
cd C:\Users\Fidel\Desktop\zaapar
git add -A
git commit -m "Your change description"
git push origin main
```

Render redeploys automatically (~2 mins).

---

## Need More Help?

- **Still confused?** → Read `START_HERE.md` (has explanations)
- **Render errors?** → Check `DEPLOYMENT_GUIDE.md` troubleshooting
- **Want to understand?** → Read `ARCHITECTURE.md`

---

**That's it. You're done. Your app is live.** 🚀

