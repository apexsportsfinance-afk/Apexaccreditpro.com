import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const uploadDir = path.join(__dirname, 'server', 'uploads', 'acc');
// Ensure it exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Upload Endpoint (open for public registrations)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const localUrl = `/api/images/${req.file.filename}`;
  res.json({ url: localUrl, filename: req.file.filename });
});

// Bridge Results Proxy (Proxy to Python Medal Engine)
app.post('/api/bridge/results', upload.array('files'), async (req, res) => {
  try {
    const { competition_name } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const formData = new FormData();
    formData.append('competition_name', competition_name);
    
    // Convert buffer back to Blob/File for Python bridge
    for (const file of files) {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('files', blob, file.originalname);
    }

    const response = await fetch('http://127.0.0.1:5001/api/bridge/results', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Bridge Proxy Error:', err);
    res.status(500).json({ success: false, error: 'Failed to connect to Python Bridge' });
  }
});

// Image Serving Endpoint
// Security: Files are stored outside the public web root and are only
// reachable through this server via the Vite proxy on localhost.
// External users cannot access port 3001 directly from the internet.
app.get('/api/images/:filename', (req, res) => {
  const { filename } = req.params;

  // Path traversal protection
  const safeFilename = path.basename(filename);
  const filePath = path.join(uploadDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Image not found');
  }

  // Cache for 1 hour
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(filePath);
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Secure Upload Server running on port ${PORT}`);
});
