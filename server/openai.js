const { fetch } = require('undici');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  module.exports = {
    async extractProfile(text) { return { error: 'OPENAI_API_KEY not configured', profile: { summary: text.slice(0,800), raw: text } }; },
    async scoreJobs(profile, jobs) { return null; }
  };
  return;
}

async function callChat(prompt, max_tokens = 800) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens })
  });
  const j = await resp.json();
  return j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || null;
}

module.exports = {
  async extractProfile(text) {
    const prompt = `Extract a JSON object with fields: name (string|null), email (string|null), phone (string|null), skills (array of short strings), experienceSummary (short string), desiredRoles (array of strings). Return strictly valid JSON only. Text:\n\n${text}`;
    try {
      const answer = await callChat(prompt);
      try { return { profile: JSON.parse(answer) }; } catch (e) { return { profile: { raw: answer } }; }
    } catch (e) { return { error: e.message, profile: { summary: text.slice(0,800), raw: text } }; }
  },

  async scoreJobs(profile, jobs) {
    if (!profile) return null;
    const prompt = `You are a job matching assistant. Given the user profile JSON and a list of job objects, return a JSON array where each element is {"id":string,"score":number} with score between 0 and 1 indicating relevance. Do not return any extra text.\nUser profile:\n${JSON.stringify(profile)}\nJobs:\n${JSON.stringify(jobs)}\nReturn only JSON.`;
    try {
      const answer = await callChat(prompt, 600);
      try { return JSON.parse(answer); } catch (e) { return null; }
    } catch (e) { return null; }
  }
};
