const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB اتصال
mongoose.connect('mongodb://localhost:27017/fileDB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('MongoDB connection error:', err));

// مدل MongoDB برای ذخیره‌سازی فایل‌ها
const fileSchema = new mongoose.Schema({
  filename: String,
  url: String,
  timestamp: { type: Date, default: Date.now },
});

const File = mongoose.model('File', fileSchema);

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

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  // ذخیره اطلاعات فایل در MongoDB
  const newFile = new File({
    filename: req.file.originalname,
    url: `/files/${req.file.filename}`,
  });

  await newFile.save();

  res.json({ url: `/files/${req.file.filename}` });
});

app.get('/api/files', async (_, res) => {
  try {
    const files = await File.find().sort({ timestamp: -1 });

    const recent24h = files.filter(f => Date.now() - new Date(f.timestamp) < 24 * 3600 * 1000).length;
    const validCount = files.length;

    res.json({
      files,
      total: files.length,
      recent: recent24h,
      valid: validCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to list files.' });
  }
});

app.delete('/api/files/:filename', async (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });

  // حذف فایل از MongoDB
  await File.deleteOne({ filename: req.params.filename });

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

app.put('/api/files/:filename', async (req, res) => {
  const { newName, newData } = req.body;
  const oldPath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'File not found.' });

  // تغییر نام یا داده‌های فایل
  if (newName) {
    const newPath = path.join(uploadDir, newName);
    fs.renameSync(oldPath, newPath);

    // بروزرسانی MongoDB
    await File.updateOne({ filename: req.params.filename }, { filename: newName });
    return res.json({ success: true });
  }

  if (newData) {
    fs.writeFileSync(oldPath, JSON.stringify(newData, null, 2));

    // بروزرسانی MongoDB
    await File.updateOne({ filename: req.params.filename }, { data: newData });
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'No valid operation.' });
});

app.get('/api/files/:filename', async (req, res) => {
  const file = await File.findOne({ filename: req.params.filename });
  if (!file) return res.status(404).json({ error: 'File not found.' });

  res.json(file);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));