require('dotenv').config();
const { Worker } = require('bullmq');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { fetch } = require('undici');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379,
  password: process.env.REDIS_PASS || undefined
};

const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

const openai = require('./openai');

async function processExtractProfile(data) {
  const { jobRowId, user_id, text } = data;
  let result = { profile: { summary: text.slice(0,800) } };
  try {
    const r = await openai.extractProfile(text);
    if (r && r.profile) result.profile = r.profile;
    if (r && r.error) result.error = r.error;
  } catch (e) { result.error = e.message; }

  // Update job row
  db.run('UPDATE jobs SET status = ?, result = ?, updated_at = ? WHERE id = ?', ['done', JSON.stringify(result), Date.now(), jobRowId]);

  // Insert profile record associated with user
  try {
    db.run('INSERT INTO profiles (user_id, data, created_at) VALUES (?,?,?)', [user_id, JSON.stringify(result.profile || {}), Date.now()]);
  } catch (e) { /* ignore */ }
}

const worker = new Worker('zaapar-jobs', async job => {
  if (job.name === 'extract_profile' || job.name === 'default') {
    await processExtractProfile(job.data);
  }
}, { connection });

worker.on('completed', job => console.log('Job completed', job.id));
worker.on('failed', (job, err) => console.error('Job failed', job?.id, err));

console.log('BullMQ worker started, listening for jobs...');
