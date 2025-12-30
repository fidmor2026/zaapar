const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { fetch } = require('undici');

// worker.js - simple DB-backed job processor
const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

async function processJobPayload(job) {
  const j = JSON.parse(job.payload);
  const result = { profile: { summary: j.text.slice(0, 800) } };
  if (process.env.OPENAI_API_KEY) {
    try {
      const prompt = `Extract a JSON profile with fields: name, email, phone, skills (array of strings), experienceSummary, desiredRoles (array) from the text below. Return only valid JSON. Text:\n\n${j.text}`;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
      });
      const out = await resp.json();
      const answer = out?.choices?.[0]?.message?.content || out?.choices?.[0]?.text || null;
      if (answer) {
        try { result.profile = JSON.parse(answer); } catch (e) { result.profile = { raw: answer }; }
      }
    } catch (e) {
      result.error = e.message;
    }
  }
  return result;
}

function pickAndProcess() {
  db.get('SELECT id, payload FROM jobs WHERE status = ? ORDER BY created_at ASC LIMIT 1', ['pending'], async (err, row) => {
    if (err) { console.error('DB', err); return; }
    if (!row) return;
    const id = row.id;
    console.log('Processing job', id);
    db.run('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', ['processing', Date.now(), id]);
    try {
      const result = await processJobPayload(row);
      db.run('UPDATE jobs SET status = ?, result = ?, updated_at = ? WHERE id = ?', ['done', JSON.stringify(result), Date.now(), id]);
      // Optionally store profile in profiles table
      try {
        const profileData = JSON.stringify(result.profile || {});
        db.run('INSERT INTO profiles (user_id, data, created_at) VALUES (?,?,?)', [null, profileData, Date.now()]);
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('Job failed', e);
      db.run('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', ['failed', Date.now(), id]);
    }
  });
}

console.log('Worker started. Polling for jobs every 3s.');
setInterval(pickAndProcess, 3000);
