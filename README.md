# ZAAPAR — AI Job Seeker Platform

AI-powered job search with Tinder-like swipe UI. Upload your CV, AI analyzes it, recommends jobs from Indeed (Nordic region), and you swipe to save matches.

**Features:**
- ✅ User authentication (email + password, verification)
- ✅ CV upload and AI-powered extraction (OpenAI optional)
- ✅ Job search from Indeed (Nordic region)
- ✅ AI-powered job recommendations
- ✅ Tinder-like swipe UI with gesture support
- ✅ Saved job matches
- ✅ Background worker for async processing
- ✅ Production-ready security (CORS, CSP, JWT, helmet)
- ✅ Docker support
- ✅ GitHub Actions CI
- ✅ 1-click Render deployment

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js 20+**
- **Docker** (for Redis, MailHog, ClamAV) — optional but recommended
- **Git**

### Setup (Windows)

```powershell
# Clone and setup
cd C:\Users\Fidel\Desktop\zaapar
.\setup.bat

# Then edit environment
notepad server\.env

# Start services (choose one)
# Option A: With Docker
docker-compose up -d redis mailhog clamav

# Start in 2 terminals
cd server
npm start         # Terminal 1: HTTP server on http://localhost:4000
npm run worker    # Terminal 2: Background worker
```

### Setup (macOS/Linux)

```bash
cd ~/Desktop/zaapar
bash setup.sh

# Edit environment
nano server/.env

# Start services
docker-compose up -d redis mailhog clamav

# Start in 2 terminals
cd server
npm start         # Terminal 1
npm run worker    # Terminal 2
```

### First Test

1. Open http://localhost:4000/register.html
2. Register with any email (e.g., `test@example.com`)
3. Check email preview URL in console output (test SMTP)
4. Click verification link
5. Login
6. Upload a PDF resume
7. Click "Start Swipe" and browse AI-recommended jobs

---

## Deploy to Render (Get Public URL)

### Why Render?
- Free tier includes 750 free dyno hours/month
- Supports background workers (needed for CV extraction)
- Handles Redis integration (add PostgreSQL or Redis add-on)
- Auto-deploys from GitHub with webhooks

### Prerequisites
- GitHub account (repo must be pushed)
- Render account (free tier available at render.com)
- OpenAI API key (optional, for AI features)
- Redis URL (use Render Redis add-on or external Redis)

### Step 1: Push to GitHub

```powershell
cd C:\Users\Fidel\Desktop\zaapar

# Verify git is initialized
git status

# Stage all changes
git add -A
git commit -m "chore: zaapar app - backend, worker, frontend, Docker, CI"

# Ensure main branch
git branch -M main

# Add GitHub remote (use your GitHub username)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/zaapar.git

# Push (will ask for GitHub credentials or PAT)
git push -u origin main
```

### Step 2: Create Web Service on Render

1. Go to https://render.com and sign in with GitHub
2. Click **New +** → **Web Service**
3. Select your `zaapar` repository
4. Configure:
   - **Name**: zaapar
   - **Root Directory**: server
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free
5. Click **Create Web Service**
6. Wait for deployment to finish (~2-3 minutes)
7. Copy your URL: `https://zaapar-xxx.onrender.com`

### Step 3: Create Background Worker

1. In same Render dashboard, click **New +** → **Background Worker**
2. Select your `zaapar` repository
3. Configure:
   - **Name**: zaapar-worker
   - **Root Directory**: server
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run worker`
   - **Environment**: Node
   - **Plan**: Free
4. Click **Create Background Worker**

### Step 4: Set Environment Variables

**On the Web Service:**
1. Go to **Settings** → **Environment**
2. Add these variables:
   ```
   NODE_ENV = production
   JWT_SECRET = <generate-strong-random-string-here>
   APP_URL = https://zaapar-xxx.onrender.com
   REDIS_HOST = <redis-endpoint>
   REDIS_PORT = 6379
   REDIS_PASS = <redis-password>
   OPENAI_API_KEY = <your-key> (optional)
   ALLOWED_ORIGINS = https://zaapar-xxx.onrender.com
   ```
3. Click **Save**
4. Render will auto-redeploy

**On the Background Worker:**
1. Go to **Settings** → **Environment**
2. Add the same variables **except**:
   - Remove `APP_URL`
   - Keep `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`, `OPENAI_API_KEY`

### Step 5: Add Redis (Required)

Render doesn't include Redis by default. Choose one:

**Option A: Render Redis Add-on (Recommended)**
- On Web Service → **Add-ons** → **Postgres** → pick Redis
- Render will populate `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS` environment variables
- No manual configuration needed

**Option B: External Redis (e.g., Redis Cloud)**
- Go to https://redis.com/try-free (free 30MB tier)
- Create account, get Redis connection string
- In Render, set:
  - `REDIS_HOST` = (from connection string)
  - `REDIS_PORT` = (from connection string)
  - `REDIS_PASS` = (from connection string)

### Step 6: Test Live Site

After all services are deployed (green checkmarks):

1. Open https://zaapar-xxx.onrender.com/register.html
2. Register, verify email, login, upload CV, swipe jobs
3. Check Render logs if anything fails (dashboard → Service → Logs)

**Your Public URL:**
```
https://zaapar-xxx.onrender.com
```

---

## Architecture

```
FRONTEND (Static HTML/CSS/JS)
  ├─ register.html
  ├─ login.html
  ├─ dashboard.html (Tinder-like swipe UI)
  └─ styles.css

BACKEND (Express.js)
  ├─ POST   /auth/register           → bcrypt, email verification
  ├─ GET    /auth/verify             → JWT token generation
  ├─ POST   /auth/login              → password auth
  ├─ POST   /upload                  → CV parsing (pdf-parse)
  ├─ GET    /jobs/search             → Indeed adapter
  ├─ GET    /jobs/recommend          → AI scoring (OpenAI)
  ├─ POST   /matches                 → like/dislike tracking
  ├─ GET    /profile                 → user profile + extracted skills
  └─ GET    /jobs/status/:id         → extraction job status

BACKGROUND WORKER (BullMQ + Redis)
  └─ extract_profile job → PDF text → OpenAI → DB update

DATABASE (SQLite)
  ├─ users (email, password_hash, email_verified)
  ├─ profiles (user_id, extracted_data)
  ├─ jobs (job_id, title, url, company)
  ├─ recommendations (user_id, job_id, score)
  └─ matches (user_id, job_id, decision, timestamp)

EXTERNAL SERVICES
  ├─ Indeed (job scraping)
  ├─ OpenAI (CV extraction + job scoring)
  ├─ Nodemailer (email verification)
  └─ Redis (job queue)
```

---

## Environment Variables

**Create `server/.env`** (copy from `.env.example`):

```
NODE_ENV=development
PORT=4000
APP_URL=http://localhost:4000
JWT_SECRET=dev-secret-change-in-production
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=
OPENAI_API_KEY=sk-...
SMTP_HOST=smtp.ethereal.email
SMTP_USER=your@ethereal.email
SMTP_PASS=ethereal-password
FROM_EMAIL=noreply@zaapar.dev
ALLOWED_ORIGINS=http://localhost:4000
```

---

## Running with Docker (Optional)

```bash
# Start dependencies
docker-compose up -d redis mailhog clamav

# Development
cd server
npm install
npm start         # HTTP server
npm run worker    # Background worker (in another terminal)

# Production
docker build -t zaapar:latest .
docker run -p 4000:4000 --env-file .env zaapar:latest
```

---

## Security & Production Checklist

- ✅ HTTPS enforced (Render auto-provides)
- ✅ JWT_SECRET generated and secure
- ✅ CORS origin restricted to your Render URL
- ✅ Content Security Policy (CSP) headers set
- ✅ Multer file validation (ext + mimetype)
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on auth endpoints
- ✅ Environment variables not committed
- ⚠️ SQLite → PostgreSQL for scaling (optional)
- ⚠️ Virus scanning via ClamAV (optional)

---

## Troubleshooting

**"Redis connection failed"**
- Ensure Redis is running: `docker-compose up -d redis`
- Or set `REDIS_HOST` to external Redis URL

**"Email verification not sent"**
- Check SMTP settings in `.env`
- Default fallback: Ethereal test SMTP (preview URL printed to console)

**"AI recommendations not working"**
- Set `OPENAI_API_KEY` in `.env`
- Without it, heuristic scoring is used (job title matching)

**"Render deploy fails"**
- Check logs: Render Dashboard → Service → Logs
- Verify `REDIS_HOST` and `REDIS_PASS` are set
- Ensure `npm ci` can fetch all dependencies

---

## Tech Stack

**Backend**: Node.js, Express, SQLite, BullMQ, Redis
**Frontend**: Vanilla HTML/CSS/JS
**AI**: OpenAI API (optional)
**Deployment**: Docker, Render, GitHub Actions
**Security**: Helmet, CORS, CSP, bcrypt, JWT

---

## File Structure

```
zaapar/
├── server/
│   ├── index.js              # Express app + API endpoints
│   ├── worker-bull.js        # BullMQ worker (CV extraction)
│   ├── openai.js             # OpenAI helper functions
│   ├── queue.js              # BullMQ queue setup
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile
│   └── public/
│       ├── index.html
│       ├── register.html
│       ├── login.html
│       ├── dashboard.html
│       └── styles.css
├── docker-compose.yml
├── render.yaml               # Render Infrastructure-as-Code
├── setup.sh / setup.bat      # Local dev setup
├── .github/workflows/ci.yml  # GitHub Actions
└── README.md
```

---

## Support & Questions

For issues, check:
1. Render logs: Dashboard → Service → Logs
2. Console output: `npm start` and `npm run worker`
3. Network tab in browser DevTools
4. `.env` file for missing config

---

**Ready to deploy?** Follow [Step 1: Push to GitHub](#step-1-push-to-github) above. You'll have a live URL in ~5 minutes!
cd server
docker build -t zaapar-server .
docker run -e JWT_SECRET=change-me -e APP_URL=https://yourdomain -p 4000:4000 zaapar-server
```

For a production deployment use a process manager for `worker-bull.js`, secure Redis, enable HTTPS, and store secrets in a secret manager (Vault, cloud secrets, etc.).

For next steps, I can:
- Integrate OpenAI parsing and scoring (requires `OPENAI_API_KEY`).
- Add a Redis-backed queue and worker process.
- Implement virus scanning with ClamAV in a containerized environment.
- Expand job adapters (LinkedIn/Google) with proper API access.
Security checklist & production hardening:
- Set `NODE_ENV=production` and provide a strong `JWT_SECRET` (required in production).
- Set `ALLOWED_ORIGINS` or `APP_URL` to restrict CORS. Example: `ALLOWED_ORIGINS=https://yourdomain.com`
- Use HTTPS (TLS) in production and terminate TLS at your load balancer or reverse proxy.
- Use a secrets manager for `OPENAI_API_KEY`, `SMTP_PASS`, and `REDIS_PASS`.
- Run dependency vulnerability scans (`npm audit`) and keep deps up-to-date.
- Run the worker as a separate service/process and use Redis provided by your host.

Deploying to Render (recommended quick path):
1) Push your repo to GitHub.
2) On Render, create a new Web Service, connect your GitHub repo, set the build command `npm ci` and start command `npm start`.
3) Add environment variables in Render dashboard: `REDIS_HOST`, `OPENAI_API_KEY`, `JWT_SECRET`, `APP_URL` (your Render URL), `SMTP_*` if needed.
4) Create a Background Worker service in Render for `npm run worker` to process jobs.

Alternatively use Railway, Fly, or Docker on a VPS. For static-only hosting (GitHub Pages) note: GitHub Pages cannot host the Node backend — use it only for static frontend.
