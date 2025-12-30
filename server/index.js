// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { fetch } = require('undici');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 4000;
// Warn/require secure JWT secret in production
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  console.error('ERROR: In production you must set a strong JWT_SECRET environment variable. Exiting.');
  process.exit(1);
}

app.use(helmet());

// Content Security Policy - restrict sources for scripts, styles and others
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", 'https:'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https:']
  }
}));

// CORS: restrict to APP_URL or explicit ALLOWED_ORIGINS list
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin like mobile apps or curl
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'), false);
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Configure multer to store uploads in server/uploads with timestamped filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'))
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.pdf|\.doc|\.docx/i;
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ok = allowedExt.test(ext) && allowedMimes.includes(file.mimetype);
    cb(null, ok);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// --- Simple SQLite DB setup ---
const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    verified INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS verify_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT,
    created_at INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    data TEXT,
    created_at INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    job_id TEXT,
    decision TEXT,
    created_at INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    payload TEXT,
    status TEXT,
    result TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`);
});

// Try to load queue (optional)
let jobQueue = null;
try { jobQueue = require('./queue').queue; } catch (e) { /* queue optional */ }

// Helper: send verification email (uses SMTP env or Ethereal)
async function sendVerificationEmail(email, token) {
  let transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } else {
    // create ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
  }

  const verifyUrl = `${process.env.APP_URL || 'http://localhost:4000'}/auth/verify?token=${token}`;
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'no-reply@zaapar.local',
    to: email,
    subject: 'Verify your Zaapar account',
    text: `Please verify: ${verifyUrl}`,
    html: `<p>Please verify your account by clicking <a href="${verifyUrl}">here</a>.</p>`
  });

  return nodemailer.getTestMessageUrl(info) || null;
}

// --- Auth endpoints ---
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (email, password) VALUES (?,?)', [email, hashed], function(err) {
    if (err) return res.status(400).json({ error: 'Email already registered' });
    const userId = this.lastID;
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const now = Date.now();
    db.run('INSERT INTO verify_tokens (user_id, token, created_at) VALUES (?,?,?)', [userId, token, now]);
    sendVerificationEmail(email, token).then(url => {
      res.json({ message: 'Registered. Verification email sent.', previewUrl: url });
    }).catch(e => res.json({ message: 'Registered, but failed to send email', error: e.message }));
  });
});

app.get('/auth/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token required');
  db.get('SELECT user_id FROM verify_tokens WHERE token = ?', [token], (err, row) => {
    if (err || !row) return res.status(400).send('Invalid token');
    db.run('UPDATE users SET verified = 1 WHERE id = ?', [row.user_id]);
    db.run('DELETE FROM verify_tokens WHERE token = ?', [token]);
    res.send('Account verified. You can close this page and login.');
  });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  db.get('SELECT id, password, verified FROM users WHERE email = ?', [email], async (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    if (!row.verified) return res.status(403).json({ error: 'Email not verified' });
    const token = jwt.sign({ uid: row.id, email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
    res.json({ token });
  });
});

// simple auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid auth' });
  try {
    const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// get profile
app.get('/profile', authMiddleware, (req, res) => {
  db.get('SELECT data FROM profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.uid], (err, row) => {
    if (err || !row) return res.json({ profile: null });
    res.json({ profile: JSON.parse(row.data) });
  });
});

// POST /upload - accepts 'cv' file field (multipart/form-data)
app.post('/upload', authMiddleware, upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = path.join(uploadsDir, req.file.filename);
  try {
    // Optional virus scan using clamscan if available
    const scanAvailable = (() => { try { require('child_process').execSync('clamscan --version', { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
    if (scanAvailable) {
      try {
        require('child_process').execSync(`clamscan --no-summary "${filePath.replace(/"/g,'\"')}"`, { stdio: 'ignore' });
      } catch (e) {
        return res.status(400).json({ error: 'Uploaded file failed virus scan' });
      }
    }

    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdf(dataBuffer).catch(() => ({ text: '' }));
    const text = parsed.text || '';

        // Insert a processing job to extract structured profile asynchronously in DB, then enqueue to Redis queue
        const now = Date.now();
        const payload = JSON.stringify({ filename: req.file.filename, text });
        db.run('INSERT INTO jobs (user_id, type, payload, status, created_at, updated_at) VALUES (?,?,?,?,?,?)', [req.user.uid, 'extract_profile', payload, 'pending', now, now], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to enqueue job' });
          const jobRowId = this.lastID;
          // enqueue to BullMQ
          try {
            const { queue } = require('./queue');
            queue.add('extract_profile', { jobRowId, user_id: req.user.uid, filename: req.file.filename, text });
          } catch (e) {
            // If queue not available, keep job as pending; worker can pick DB records.
            console.error('Queue enqueue failed', e.message || e);
          }
          res.json({ message: 'File uploaded and queued for analysis', filename: req.file.filename, jobId: jobRowId });
        });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Job status endpoint
app.get('/jobs/status/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, status, result, updated_at FROM jobs WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Job not found' });
    res.json({ id: row.id, status: row.status, result: row.result ? JSON.parse(row.result) : null, updated_at: row.updated_at });
  });
});

// Background worker has been moved to a separate process: see server/worker.js
// This keeps the HTTP server lightweight and suitable for running in a process manager.

// Simple Indeed adapter: search by query and location, return basic job objects
app.get('/jobs/search', authMiddleware, async (req, res) => {
  const q = encodeURIComponent(req.query.q || 'developer');
  const l = encodeURIComponent(req.query.l || 'Sweden');
  const url = `https://se.indeed.com/jobs?q=${q}&l=${l}`; // starting with Sweden domain as example
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const $ = cheerio.load(html);
    const results = [];
    $('.result, .job_seen_beacon').slice(0, 25).each((i, el) => {
      const title = $(el).find('h2, .jobTitle').first().text().trim();
      const company = $(el).find('.companyName').text().trim();
      const location = $(el).find('.companyLocation').text().trim();
      const summary = $(el).find('.job-snippet').text().trim().replace(/\n+/g, ' ');
      const link = $(el).find('a').first().attr('href') || '';
      results.push({ id: `indeed-${i}-${Date.now()}`, title, company, location, summary, link: link.startsWith('http') ? link : `https://se.indeed.com${link}` });
    });
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /jobs/recommend - use profile to search and rank jobs
app.get('/jobs/recommend', authMiddleware, async (req, res) => {
  // Load latest profile for user
  db.get('SELECT data FROM profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.uid], async (err, row) => {
    const profile = row ? JSON.parse(row.data) : null;
    const defaultQ = profile && (profile.ai?.skills ? profile.ai.skills.join(' ') : (profile.skills ? profile.skills.join(' ') : null)) || req.query.q || 'developer';
    const q = encodeURIComponent(defaultQ);
    const l = encodeURIComponent(req.query.l || 'Sweden');
    const url = `https://se.indeed.com/jobs?q=${q}&l=${l}`;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await r.text();
      const $ = cheerio.load(html);
      const jobs = [];
      $('.result, .job_seen_beacon').slice(0, 40).each((i, el) => {
        const title = $(el).find('h2, .jobTitle').first().text().trim();
        const company = $(el).find('.companyName').text().trim();
        const location = $(el).find('.companyLocation').text().trim();
        const summary = $(el).find('.job-snippet').text().trim().replace(/\n+/g, ' ');
        const link = $(el).find('a').first().attr('href') || '';
        jobs.push({ id: `indeed-${i}-${Date.now()}`, title, company, location, summary, link: link.startsWith('http') ? link : `https://se.indeed.com${link}` });
      });

      // Scoring: use OpenAI if available to score relevance between profile and each job
      let scored = [];
      try {
        const openai = require('./openai');
        const aiScores = await openai.scoreJobs(profile, jobs);
        if (aiScores && Array.isArray(aiScores)) {
          const map = new Map(aiScores.map(x => [x.id, x.score]));
          scored = jobs.map(job => ({ ...job, score: map.get(job.id) || 0 }));
        }
      } catch (e) {
        scored = [];
      }

      if (!scored || scored.length === 0) {
        // fallback simple keyword matching using profile.skills or profile.summary
        const keywords = [];
        if (profile) {
          if (profile.ai && Array.isArray(profile.ai.skills)) keywords.push(...profile.ai.skills.map(s => s.toLowerCase()));
          if (profile.skills && Array.isArray(profile.skills)) keywords.push(...profile.skills.map(s => s.toLowerCase()));
          if (profile.summary) keywords.push(...profile.summary.split(/\W+/).slice(0,50).map(s=>s.toLowerCase()));
        }
        scored = jobs.map(job => {
          const hay = (job.title + ' ' + job.summary + ' ' + job.company + ' ' + job.location).toLowerCase();
          let count = 0;
          for (const k of keywords) if (k && hay.includes(k)) count++;
          const score = keywords.length ? Math.min(1, count / Math.max(1, keywords.length)) : 0.01;
          return { ...job, score };
        });
      }

      // Sort descending by score
      scored.sort((a,b)=>b.score - a.score);
      res.json({ results: scored });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// Save match decision (like/dislike)
app.post('/matches', authMiddleware, (req, res) => {
  const { job_id, decision } = req.body;
  if (!job_id || !decision) return res.status(400).json({ error: 'job_id and decision required' });
  db.run('INSERT INTO matches (user_id, job_id, decision, created_at) VALUES (?,?,?,?)', [req.user.uid, job_id, decision, Date.now()]);
  res.json({ message: 'Saved' });
});

// Serve uploaded files statically and public UI
app.use('/uploads', express.static(uploadsDir));
app.use('/', express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`ZAAPAR server running on port ${PORT}`);
});
