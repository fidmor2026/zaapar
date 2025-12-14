// server/index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

app.get('/', (req, res) => {
  res.send('ZAAPAR server is running!');
});

app.listen(PORT, () => {
  console.log(`ZAAPAR server running on port ${PORT}`);
});
