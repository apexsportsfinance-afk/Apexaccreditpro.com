import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

dotenv.config();

// Initialize Supabase Client for the API
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

/**
 * APX-API-V1: Verification API
 * This is the endpoint used by third-party kiosks/apps.
 * It requires an 'x-api-key' header.
 */
app.post('/api/v1/verify', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { badgeId } = req.body;

    if (!apiKey) return res.status(401).json({ success: false, error: 'API Key is required in x-api-key header' });
    if (!badgeId) return res.status(400).json({ success: false, error: 'badgeId is required in request body' });

    // 1. Validate the API Key
    const { data: keyData, error: keyError } = await supabase
      .from('partner_api_keys')
      .select('*, partner:partners(*)')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (keyError || !keyData) {
      return res.status(403).json({ success: false, error: 'Invalid or revoked API Key' });
    }

    // 2. Fetch the Athlete/Accreditation data
    // We check accreditation_id (ATH-xxx), system id (UUID), and badge_number
    const { data: athlete, error: athleteError } = await supabase
      .from('accreditations')
      .select('*')
      .or(`accreditation_id.eq.${badgeId},id.eq.${badgeId},badge_number.eq.${badgeId}`)
      .single();

    if (athleteError || !athlete) {
      return res.status(404).json({ success: false, error: 'Badge/Athlete not found' });
    }

    // 3. Filter data based on "Allowed Fields" allocated to this key
    const allowedFields = keyData.allowed_fields || ["firstName", "lastName", "role", "badgeNumber"];
    const filteredData = {};
    
    // Map of DB columns to JS property names (matching the UI allocation)
    const fieldMap = {
      firstName: athlete.first_name,
      lastName: athlete.last_name,
      role: athlete.role,
      badgeNumber: athlete.badge_number,
      club: athlete.club,
      nationality: athlete.nationality,
      photoUrl: athlete.photo_url,
      status: athlete.status
    };

    allowedFields.forEach(field => {
      if (fieldMap[field] !== undefined) {
        filteredData[field] = fieldMap[field];
      }
    });

    // 4. Update "Last Used" on the key for auditing
    await supabase.from('partner_api_keys').update({ last_used_at: new Date() }).eq('id', keyData.id);

    // 5. Return the clean, allocated data
    res.json({
      success: true,
      partner: keyData.partner.name,
      data: filteredData
    });

  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
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
