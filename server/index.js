// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
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

// Configure multer to store uploads in memory (no local disk storage)
const upload = multer({
  storage: multer.memoryStorage(),
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
  
  // Log file info for testing
  console.log('[UPLOAD] File received:', {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    encoding: req.file.encoding,
    timestamp: new Date().toISOString(),
    user_id: req.user.uid
  });
  
  try {
    const dataBuffer = req.file.buffer;
    const parsed = await pdf(dataBuffer).catch(() => ({ text: '' }));
    const text = parsed.text || '';

    // Insert a processing job to extract structured profile asynchronously in DB, then enqueue to Redis queue
    const now = Date.now();
    const filename = Date.now() + '-' + req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const payload = JSON.stringify({ filename, text });
    db.run('INSERT INTO jobs (user_id, type, payload, status, created_at, updated_at) VALUES (?,?,?,?,?,?)', [req.user.uid, 'extract_profile', payload, 'pending', now, now], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to enqueue job' });
      const jobRowId = this.lastID;
      // enqueue to BullMQ
      try {
        const { queue } = require('./queue');
        queue.add('extract_profile', { jobRowId, user_id: req.user.uid, filename, text });
      } catch (e) {
        // If queue not available, keep job as pending; worker can pick DB records.
        console.error('Queue enqueue failed', e.message || e);
      }
      res.json({ message: 'File uploaded and queued for analysis', filename: req.file.originalname, jobId: jobRowId });
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

// Simple GET / route - serve upload form
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zaapar - CV Upload</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #333;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .file-input-wrapper {
      position: relative;
      display: inline-block;
      width: 100%;
    }
    input[type="file"] {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      top: 0;
      left: 0;
    }
    .file-input-label {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      border: 2px dashed #667eea;
      border-radius: 8px;
      background: #f8f9ff;
      cursor: pointer;
      transition: all 0.3s ease;
      color: #667eea;
      font-weight: 500;
      margin: 0;
    }
    .file-input-label:hover {
      border-color: #764ba2;
      background: #f0f0ff;
      color: #764ba2;
    }
    .file-name {
      display: block;
      margin-top: 8px;
      color: #666;
      font-size: 13px;
    }
    #fileName {
      color: #667eea;
      font-weight: 600;
    }
    button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .message {
      margin-top: 20px;
      padding: 12px;
      border-radius: 8px;
      display: none;
      font-size: 14px;
    }
    .message.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
      display: block;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      display: block;
    }
    .info-box {
      background: #f0f0ff;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      color: #555;
      margin-top: 20px;
      line-height: 1.6;
    }
    .info-box strong {
      color: #333;
    }
    .loader {
      display: none;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
      margin-right: 10px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .button-content {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Zaapar</h1>
    <p class="subtitle">Upload your CV to discover matched job opportunities</p>
    
    <form id="uploadForm">
      <div class="form-group">
        <label for="cvFile">Select your CV</label>
        <div class="file-input-wrapper">
          <input type="file" id="cvFile" name="cv" accept=".pdf,.doc,.docx" required>
          <label for="cvFile" class="file-input-label">
            <span>Click to browse or drag & drop</span>
          </label>
          <span class="file-name" id="fileName" style="display:none;">File: <span id="fileNameText"></span></span>
        </div>
      </div>
      
      <button type="submit" id="submitBtn" disabled>
        <div class="button-content">
          <div class="loader" id="loader"></div>
          <span id="btnText">Upload CV</span>
        </div>
      </button>
      
      <div id="message" class="message"></div>
    </form>
    
    <div class="info-box">
      <strong>Supported formats:</strong> PDF, DOC, DOCX<br>
      <strong>Max size:</strong> 10MB<br>
      <strong>Note:</strong> You need to be logged in to upload a CV.
    </div>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('cvFile');
    const fileNameSpan = document.getElementById('fileName');
    const fileNameText = document.getElementById('fileNameText');
    const submitBtn = document.getElementById('submitBtn');
    const loader = document.getElementById('loader');
    const btnText = document.getElementById('btnText');
    const message = document.getElementById('message');

    // File selection handler
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        fileNameText.textContent = file.name;
        fileNameSpan.style.display = 'block';
        submitBtn.disabled = false;
      } else {
        fileNameSpan.style.display = 'none';
        submitBtn.disabled = true;
      }
      message.textContent = '';
      message.className = 'message';
    });

    // Drag & drop handlers
    const label = document.querySelector('.file-input-label');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      label.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      label.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      label.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
      label.style.borderColor = '#764ba2';
      label.style.background = '#f0f0ff';
    }

    function unhighlight(e) {
      label.style.borderColor = '#667eea';
      label.style.background = '#f8f9ff';
    }

    label.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      fileInput.files = files;
      const event = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(event);
    }

    // Form submission handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = fileInput.files[0];
      if (!file) return;

      // Get auth token from localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        showMessage('Please log in first to upload a CV.', 'error');
        return;
      }

      submitBtn.disabled = true;
      loader.style.display = 'inline-block';
      btnText.textContent = 'Uploading...';
      message.textContent = '';
      message.className = 'message';

      const formData = new FormData();
      formData.append('cv', file);

      try {
        const response = await fetch('/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          showMessage('CV uploaded successfully! Job matching in progress...', 'success');
          form.reset();
          fileNameSpan.style.display = 'none';
          fileInput.value = '';
          setTimeout(() => {
            message.textContent = '';
            message.className = 'message';
          }, 5000);
        } else {
          showMessage('Error: ' + (data.error || 'Upload failed'), 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      } finally {
        submitBtn.disabled = !fileInput.files[0];
        loader.style.display = 'none';
        btnText.textContent = 'Upload CV';
      }
    });

    function showMessage(text, type) {
      message.textContent = text;
      message.className = 'message ' + type;
    }
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Serve public UI
app.use('/', express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`ZAAPAR server running on port ${PORT}`);
});
