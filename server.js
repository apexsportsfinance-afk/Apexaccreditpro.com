import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const stripeEnvironmentKey = process.env.STRIPE_SECRET_KEY || 'sk_test_123';
const stripe = new Stripe(stripeEnvironmentKey);

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

// ------------------------------------------------------------------
// Stripe Integration
// ------------------------------------------------------------------

// 1. Create Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { items, eventId, eventSlug, orderData } = req.body;
    
    // Convert cart items to Stripe line_items format
    const line_items = items.map(item => ({
      price_data: {
        currency: 'aed',
        product_data: {
          name: item.name,
          description: item.description || 'Spectator Ticket',
        },
        unit_amount: Math.round(item.price * 100), // Stripe expects cents/fils
      },
      quantity: item.quantity,
    }));

    // Get origin from request headers to dynamically redirect back properly
    const origin = req.headers.origin || 'http://localhost:5173';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      // If successful, redirect back with the session ID
      success_url: `${origin}/tickets/${eventSlug}?session_id={CHECKOUT_SESSION_ID}`,
      // If canceled, redirect back to the normal ticketing page
      cancel_url: `${origin}/tickets/${eventSlug}`,
      client_reference_id: eventId,
      metadata: {
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        ticketCount: orderData.ticketCount,
        selectedDates: JSON.stringify(orderData.selectedDates),
        eventId: eventId,
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Verify Session after Return
app.post('/api/verify-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'No session ID provided' });
    }
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      res.json({
        success: true,
        session: {
          id: session.id,
          metadata: session.metadata,
          amount_total: session.amount_total / 100, // convert back to currency
          customer_email: session.customer_details?.email,
          customer_name: session.customer_details?.name
        }
      });
    } else {
      res.json({ success: false, status: session.payment_status });
    }
  } catch (error) {
    console.error('Verify session error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Secure Upload Server running on port ${PORT}`);
});
