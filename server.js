const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const uploadDir = path.join(__dirname, 'files');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({ url: `/files/${req.file.filename}` });
});

app.get('/api/files', (_, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to list files.' });

    const sessions = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const raw = fs.readFileSync(path.join(uploadDir, f), 'utf-8');
          const clean = raw.trim().replace(/^[0-9]{10,15}/, ''); // حذف شماره اول
          const data = JSON.parse(clean);
          const valid = !!(data.me?.id && data.me?.name);
          const timestamp = fs.statSync(path.join(uploadDir, f)).mtimeMs;
          return {
            id: f.replace('.json', ''),
            filename: f,
            name: data.me?.name || 'Unknown',
            number: data.me?.id?.split('@')[0] || 'N/A',
            valid,
            timestamp,
            data
          };
        } catch (e) {
          return {
            id: f.replace('.json', ''),
            filename: f,
            name: 'Corrupted',
            number: 'N/A',
            valid: false,
            timestamp: 0,
            data: {}
          };
        }
      });

    sessions.sort((a, b) => b.timestamp - a.timestamp);

    const recent24h = sessions.filter(s => Date.now() - s.timestamp < 24 * 3600 * 1000).length;
    const validCount = sessions.filter(s => s.valid).length;

    res.json({
      files: sessions,
      total: sessions.length,
      recent: recent24h,
      valid: validCount
    });
  });
});

app.delete('/api/files/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

app.put('/api/files/:filename', (req, res) => {
  const { newName, newData } = req.body;
  const oldPath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'File not found.' });

  if (newName) {
    const newPath = path.join(uploadDir, newName + '.json');
    fs.renameSync(oldPath, newPath);
    return res.json({ success: true });
  }

  if (newData) {
    fs.writeFileSync(oldPath, JSON.stringify(newData, null, 2));
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'No valid operation.' });
});

app.get('/api/files/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
  const data = JSON.parse(fs.readFileSync(filePath));
  res.json(data);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
