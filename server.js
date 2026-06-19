import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Trust the platform proxy so client IPs (X-Forwarded-For) are read correctly
// behind Vercel / Nginx for rate limiting.
app.set('trust proxy', 1);

// [APX-SEC] Security headers on the API tier (the frontend gets its own set
// from vercel.json). Implemented inline to avoid an extra dependency; CSP is
// owned by the frontend host.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.removeHeader('X-Powered-By');
  next();
});

// [APX-SEC] Minimal fixed-window in-memory rate limiter (no external dep).
// For multi-instance deployments, front this with a shared store / WAF.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, resetAt }
  // Periodic sweep so the map can't grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of hits) if (rec.resetAt <= now) hits.delete(ip);
  }, windowMs).unref?.();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let rec = hits.get(ip);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(ip, rec);
    }
    rec.count += 1;
    const remaining = Math.max(0, max - rec.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    if (rec.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((rec.resetAt - now) / 1000)));
      return res.status(429).json(message);
    }
    next();
  };
}

const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000, max: 60,
  message: { success: false, error: 'Rate limit exceeded. Slow down.' },
});
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many uploads. Please wait and retry.' },
});

// [APX-SEC] CORS allow-list. Add production domains via the
// CORS_ALLOWED_ORIGINS env var (comma-separated) instead of widening this.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5180,http://localhost:5173,https://accreditation.apexsports.ae')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
// JSON bodies are small control payloads; large binaries go through multipart
// upload routes with their own size caps. A 2mb cap blunts JSON-body DoS.
app.use(express.json({ limit: '2mb' }));

// Liveness probe for uptime monitoring / load balancers.
app.get('/healthz', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Initialize Supabase Client for the API
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// [APX-SEC] Require a valid Supabase session for write endpoints that were
// previously open to anyone on the internet.
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  req.user = data.user;
  next();
};

const uploadDir = path.join(__dirname, 'server', 'uploads', 'acc');
// Ensure it exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Event Photos Upload Dir
const eventsUploadDir = path.join(__dirname, 'server', 'uploads', 'events');
if (!fs.existsSync(eventsUploadDir)) {
  fs.mkdirSync(eventsUploadDir, { recursive: true });
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

// Filter for General Uploads (Images + PDF)
const combinedFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload JPG, PNG, WEBP, or PDF only.'));
  }
};

// Filter for Gallery Photos (Images ONLY)
const photoFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported photo type. Please upload JPG, PNG, or WEBP only.'));
  }
};

const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: combinedFileFilter
});

// Storage for Event Photos
const eventPhotosStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, eventsUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPhotos = multer({ 
  storage: eventPhotosStorage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: photoFileFilter
});

// Upload Endpoint (requires an authenticated admin/staff session)
app.post('/api/upload', uploadLimiter, requireAuth, (req, res) => {
  const uploadSingle = upload.single('file');
  uploadSingle(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || err.field });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const localUrl = `/api/images/${req.file.filename}`;
    res.json({ url: localUrl, filename: req.file.filename });
  });
});

// Event Photos Upload Endpoint (supports multiple files, requires an authenticated admin/staff session)
app.post('/api/upload/photos', uploadLimiter, requireAuth, (req, res) => {
  const uploadArray = uploadPhotos.array('photos', 50);
  uploadArray(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message || err.field });
    }
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const urls = req.files.map(file => ({
      url: `/api/images/events/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname
    }));
    res.json({ success: true, files: urls });
  });
});

// Bridge Results Proxy (Proxy to Python Medal Engine)
// [APX-SEC] Now requires an authenticated session + rate limiting. This
// endpoint was previously open to the internet for unauthenticated uploads.
app.post('/api/bridge/results', uploadLimiter, requireAuth, upload.array('files'), async (req, res) => {
  const files = req.files || [];
  try {
    const { competition_name } = req.body;

    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const formData = new FormData();
    formData.append('competition_name', competition_name);
    
    // Convert disk file back to Blob/File for Python bridge
    for (const file of files) {
      const fileBuffer = fs.readFileSync(file.path);
      const blob = new Blob([fileBuffer], { type: file.mimetype });
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
  } finally {
    // Clean up temporary files to avoid disk leaks
    for (const file of files) {
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {
          console.error(`Failed to delete temp file ${file.path}:`, unlinkErr);
        }
      }
    }
  }
});

/**
 * APX-API-V1: Verification API
 * This is the endpoint used by third-party kiosks/apps.
 * It requires an 'x-api-key' header.
 */
app.post('/api/v1/verify', verifyLimiter, async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { badgeId } = req.body;

    if (!apiKey) return res.status(401).json({ success: false, error: 'API Key is required in x-api-key header' });
    if (!badgeId) return res.status(400).json({ success: false, error: 'badgeId is required in request body' });

    // [APX-SEC] Restrict badgeId to a safe charset before it is interpolated
    // into a PostgREST .or() filter string, to prevent filter injection.
    if (!/^[A-Za-z0-9_-]+$/.test(String(badgeId))) {
      return res.status(400).json({ success: false, error: 'Invalid badgeId format' });
    }

    // 1. Validate the API Key by HASH (never matches the plaintext credential).
    //    The SECURITY DEFINER RPC also stamps last_used_at and keeps the
    //    partner_api_keys table itself locked down to admins.
    const apiKeyHash = createHash('sha256').update(String(apiKey)).digest('hex');
    const { data: keyRows, error: keyError } = await supabase
      .rpc('verify_partner_api_key', { p_key_hash: apiKeyHash });

    const keyData = Array.isArray(keyRows) ? keyRows[0] : keyRows;
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
    const allowedFields = Array.isArray(keyData.allowed_fields) && keyData.allowed_fields.length
      ? keyData.allowed_fields
      : ["firstName", "lastName", "role", "badgeNumber"];
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
      status: athlete.status,
      bookingData: athlete.custom_message ? (typeof athlete.custom_message === 'string' ? JSON.parse(athlete.custom_message) : athlete.custom_message) : null
    };

    allowedFields.forEach(field => {
      if (fieldMap[field] !== undefined) {
        filteredData[field] = fieldMap[field];
      }
    });

    // 4. "Last Used" was already stamped atomically inside verify_partner_api_key.

    // 5. Return the clean, allocated data
    res.json({
      success: true,
      partner: keyData.partner_name,
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

// Event Photos Serving Endpoint
app.get('/api/images/events/:filename', (req, res) => {
  const { filename } = req.params;

  // Path traversal protection
  const safeFilename = path.basename(filename);
  const filePath = path.join(eventsUploadDir, safeFilename);

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
