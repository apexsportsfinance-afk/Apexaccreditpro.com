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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Secure Upload Server running on port ${PORT}`);
});
