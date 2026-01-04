const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Root route – HTML form
app.get('/', (req, res) => {
  res.send(`
<h2>Upload your CV</h2>
<form action="/upload" method="POST" enctype="multipart/form-data">
<input type="file" name="cv" />
<button type="submit">Upload</button>
</form>
`);
});

// Upload route
app.post('/upload', upload.single('cv'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  console.log('File received:', req.file.originalname);
  res.json({ message: 'File uploaded!', fileName: req.file.originalname });
});

// Railway-ready port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
