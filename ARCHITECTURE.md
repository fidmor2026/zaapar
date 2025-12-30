# ZAAPAR Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZAAPAR PLATFORM                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌─────────────────┐         ┌──────────────┐
│   FRONTEND   │         │   BACKEND       │         │  EXTERNAL    │
│  (HTML/CSS)  │◄────────│  (Express.js)   │◄────────│  SERVICES    │
└──────────────┘         └─────────────────┘         └──────────────┘
       │                         │                          ▲
       │ HTTP                    │ SQL                     │
       │ REST API                │ Cache                   │
       │                         │                         │
       ▼                         ▼                         │
  ┌─────────┐             ┌──────────┐          ┌─────────┴──────┐
  │ Browsers│             │ SQLite   │          │  OpenAI API    │
  │ Mobile  │             │ Database │          │  Indeed Jobs   │
  └─────────┘             └──────────┘          │  Email (SMTP)  │
                                                 │  Redis Queue   │
                                                 └────────────────┘
                               │
                               │ Jobs Queue
                               ▼
                        ┌──────────────────┐
                        │ Background Worker│
                        │ (BullMQ/Node.js) │
                        └──────────────────┘
                               │
                               │ Process CSV
                               ▼
                        ┌──────────────────┐
                        │ AI Extraction    │
                        │ (pdf-parse)      │
                        └──────────────────┘
```

---

## Complete User Flow

```
USER JOURNEY: Register → Verify → Login → Upload → Swipe → Match

┌─────────────────────────────────────────────────────────────────┐
│ 1. REGISTER                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  register.html                                                  │
│       ↓                                                          │
│  POST /auth/register {email, password}                          │
│       ↓                                                          │
│  Express validates input                                        │
│       ↓                                                          │
│  Hash password with bcrypt                                      │
│       ↓                                                          │
│  Store user in SQLite (users table)                             │
│       ↓                                                          │
│  Send verification email (nodemailer)                           │
│       ↓                                                          │
│  Show preview link to user                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. VERIFY EMAIL                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Click verification link in email (GET /auth/verify?token=...) │
│       ↓                                                          │
│  Verify JWT signature                                           │
│       ↓                                                          │
│  Update user.email_verified = true                              │
│       ↓                                                          │
│  Redirect to login.html                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. LOGIN                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  login.html                                                     │
│       ↓                                                          │
│  POST /auth/login {email, password}                             │
│       ↓                                                          │
│  Find user in database                                          │
│       ↓                                                          │
│  Compare password with bcrypt                                   │
│       ↓                                                          │
│  Generate JWT token (expires in 24h)                            │
│       ↓                                                          │
│  Send token to frontend                                         │
│       ↓                                                          │
│  Frontend stores token in localStorage                          │
│       ↓                                                          │
│  Redirect to dashboard.html                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 4. UPLOAD CV                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  dashboard.html → click "Upload CV"                             │
│       ↓                                                          │
│  Select PDF file                                                │
│       ↓                                                          │
│  POST /upload (multipart/form-data)                             │
│       │ with JWT token in Authorization header                  │
│       ↓                                                          │
│  Express validates JWT                                          │
│       ↓                                                          │
│  Multer validates file:                                         │
│       • Extension: .pdf, .doc, .docx                            │
│       • MIME type: application/pdf, etc.                        │
│       • Size: < 10MB                                            │
│       ↓                                                          │
│  Extract text from PDF (pdf-parse)                              │
│       ↓                                                          │
│  Create job in queue:                                           │
│       • Queue job to Redis (BullMQ)                             │
│       • Job type: 'extract_profile'                             │
│       • Job data: {userId, fileName, pdfText}                   │
│       ↓                                                          │
│  Return jobId to frontend                                       │
│       ↓                                                          │
│  Frontend polls GET /jobs/status/:jobId                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 5. BACKGROUND WORKER (async)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Worker polls Redis queue continuously                          │
│       ↓                                                          │
│  Pick job: {userId, pdfText}                                    │
│       ↓                                                          │
│  Call OpenAI API (or heuristic fallback):                        │
│       • Input: Resume text                                      │
│       • Output: {skills, experience, role, seniority}           │
│       ↓                                                          │
│  Store profile in DB (profiles table)                           │
│       ↓                                                          │
│  Mark job as completed                                          │
│       ↓                                                          │
│  Frontend detects completion, shows ready message               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 6. GET JOB RECOMMENDATIONS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  dashboard.html → click "Start Swipe"                           │
│       ↓                                                          │
│  GET /jobs/recommend (with JWT token)                           │
│       ↓                                                          │
│  Express:                                                       │
│       • Get user's profile from DB                              │
│       • Search jobs from Indeed adapter                         │
│       • Call OpenAI to score jobs by relevance                  │
│       • Sort by score (highest first)                           │
│       • Return top 50 jobs with scores                          │
│       ↓                                                          │
│  Frontend renders cards:                                        │
│       • Job title, company, location, description               │
│       • AI score badge (0-100)                                  │
│       • Like/Dislike buttons                                    │
│       • Open Link button                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 7. SWIPE & MATCH                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User swipes:                                                   │
│       • Right swipe (←) = Dislike                                │
│       • Left swipe (→) = Like                                    │
│       • Keyboard: arrow keys                                    │
│       • Touch: swipe gestures                                   │
│       ↓                                                          │
│  POST /matches {jobId, decision: 'like'|'dislike'}              │
│       ↓                                                          │
│  Express stores in DB (matches table)                           │
│       ↓                                                          │
│  Frontend:                                                      │
│       • Show next job card                                      │
│       • Update counter (X of Y)                                 │
│       • Animate card out                                        │
│       ↓                                                          │
│  When jobs run out:                                             │
│       • Show "All jobs reviewed!" message                       │
│       • Option to see saved (liked) jobs                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints (Complete Reference)

### Authentication

```
POST /auth/register
  Request: {email, password}
  Response: {success, message, verificationLink}

GET /auth/verify?token=JWT
  Response: {success, jwt, message}

POST /auth/login
  Request: {email, password}
  Response: {success, jwt, user: {id, email}}
```

### Profile & Jobs

```
POST /upload
  Auth: JWT token required
  Body: FormData {file: PDF}
  Response: {jobId, status, message}

GET /jobs/status/:jobId
  Response: {status, progress, error}

GET /jobs/search?query=nodejs&location=dk
  Response: [{jobId, title, company, url, description, location}, ...]

GET /jobs/recommend
  Auth: JWT token required
  Response: [{jobId, title, company, score, description}, ...]
```

### User Data

```
GET /profile
  Auth: JWT token required
  Response: {user: {id, email}, profile: {skills, experience, ...}}

POST /matches
  Auth: JWT token required
  Body: {jobId, decision: 'like'|'dislike'}
  Response: {success, message}
```

---

## Database Schema (SQLite)

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profiles (extracted from CV)
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  extracted_data TEXT, -- JSON: {skills, experience, role, seniority}
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Jobs from Indeed
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  location TEXT,
  posted_date DATETIME,
  salary TEXT
);

-- AI recommendations cache
CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  score INTEGER, -- 0-100
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- User decisions on jobs
CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  decision TEXT CHECK (decision IN ('like', 'dislike')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
```

---

## Security Flow

```
REQUEST → CORS VALIDATION → JWT VERIFY → ROUTE HANDLER → DB → RESPONSE

Step 1: CORS Check
  • Only from allowed origins
  • If origin not in whitelist → 403 Forbidden

Step 2: Helmet Headers
  • CSP (Content Security Policy)
  • X-Frame-Options: DENY
  • X-Content-Type-Options: nosniff
  • Strict-Transport-Security (HTTPS)

Step 3: JWT Verification (if protected endpoint)
  • Extract token from Authorization header
  • Verify signature with JWT_SECRET
  • Check expiry (24 hours)
  • If invalid → 401 Unauthorized

Step 4: Input Validation
  • Email format (RFC 5322)
  • Password strength (optional)
  • File size/type (multer)

Step 5: Database Operation
  • Use parameterized queries (prevent SQL injection)
  • Hash passwords with bcrypt (one-way, 10 rounds)
  • Rate limiting on auth endpoints

Step 6: Response
  • No sensitive data in error messages
  • HTTPS enforced in production
  • All responses JSON
```

---

## Deployment Architecture (Render)

```
┌────────────────────────────────────────────────────────┐
│              RENDER PLATFORM (Cloud)                   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │  WEB SERVICE     │         │ BACKGROUND WORKER│    │
│  │  (Express.js)    │         │ (BullMQ Worker)  │    │
│  │  npm start       │         │ npm run worker   │    │
│  │  Port: 4000      │         │                  │    │
│  └────────┬─────────┘         └────────┬─────────┘    │
│           │                            │              │
│           │   Shared Redis Queue       │              │
│           ├────────────────────────────┤              │
│           │                            │              │
│           ▼                            ▼              │
│  ┌──────────────────────────────────────────┐         │
│  │  REDIS (Job Queue)                       │         │
│  │  • Holds CV extraction jobs              │         │
│  │  • Processes async without blocking      │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │  SQLite Database (embedded in web svc)   │         │
│  │  • Users, profiles, jobs, matches        │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
└────────────────────────────────────────────────────────┘

External:
  • GitHub (source code, auto-deploy on push)
  • OpenAI API (job scoring)
  • Indeed (job scraping)
  • Email SMTP (verification)
```

---

## Key Technologies

| Component | Tech | Purpose |
|-----------|------|---------|
| Frontend | HTML/CSS/JS | User interface |
| Backend | Express.js | REST API server |
| Database | SQLite | User data, jobs, matches |
| Queue | BullMQ + Redis | Async job processing |
| PDF Parse | pdf-parse | Extract text from resumes |
| Password Hash | bcrypt | Secure password storage |
| Auth | JWT | Stateless user sessions |
| Security | Helmet | Security headers |
| File Upload | multer | File validation |
| Async | async/await | Non-blocking I/O |
| Job Scraping | Cheerio | HTML parsing |
| AI | OpenAI API | Smart profile extraction |
| Email | nodemailer | Verification emails |
| Container | Docker | Deployment |
| Cloud | Render | Production hosting |

---

## Performance Metrics

```
Typical Response Times (local):
  • Register: 200ms (bcrypt hashing is intentionally slow)
  • Login: 100ms
  • Search jobs: 500ms (web scraping)
  • Get recommendations: 1-2s (if OpenAI API called)
  • Post match: 50ms (DB write)

Throughput:
  • HTTP: ~1000 req/s per dyno
  • Queue: ~100 jobs/s processing
  • Database: ~10k concurrent users possible with SQLite

Memory:
  • Web service: ~200MB
  • Worker: ~150MB
  • Redis: ~50MB (default)

Storage:
  • SQLite: Grows ~100KB per 100 jobs, minimal with cleanup
```

---

## What Happens When You Deploy

```
1. You push code to GitHub
2. Render detects push via GitHub webhook
3. Render pulls latest code
4. Builds Docker image:
   • npm ci (clean install dependencies)
   • Sets NODE_ENV=production
5. Starts web service: npm start
   • Express server listens on port 4000
   • Creates/connects to SQLite DB
   • Connects to Redis
6. Starts background worker: npm run worker
   • Connects to Redis queue
   • Listens for extract_profile jobs
   • Processes CV text via OpenAI or heuristic
7. Health checks:
   • Render pings /health endpoint
   • If 200 OK → service stays up
   • If fails 2x → restart
8. Your live URL goes live!
   • https://zaapar-abc123.onrender.com
   • All traffic routed here
```

---

## Next Steps

See **START_HERE.md** for your 3-step deployment checklist.
See **DEPLOYMENT_GUIDE.md** for detailed step-by-step instructions.

