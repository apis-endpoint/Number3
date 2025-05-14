// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ساخت مسیر ذخیره‌سازی فایل‌ها
const uploadDir = path.join(__dirname, 'files');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// تنظیم multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = uuidv4() + ext;
        cb(null, filename);
    }
});

const upload = multer({ storage });

// API: POST /api/upload
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// ارائه فایل‌ها به‌صورت عمومی
app.use('/files', express.static(uploadDir));

// شروع سرور
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});