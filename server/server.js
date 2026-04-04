import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Directory for saved photos
const PHOTOS_DIR = path.join(__dirname, 'photos');
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve photos as static files
app.use('/photos', express.static(PHOTOS_DIR));

// --- Setup status flag ---
let setupMode = false;

app.get('/setup-status', (_req, res) => {
  res.json({ setup: setupMode });
});

app.post('/setup-status', (req, res) => {
  const { setup } = req.body;
  if (typeof setup === 'boolean') {
    setupMode = setup;
  }
  res.json({ setup: setupMode });
});

// --- Upload photo (for QR download) ---
app.post('/upload', (req, res) => {
  const { img } = req.body;
  if (!img) {
    return res.status(400).json({ error: 'Missing "img" field (base64 string)' });
  }

  try {
    // Strip data URI prefix if present
    const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `${uuidv4()}.jpg`;
    const filepath = path.join(PHOTOS_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    // Build download URL using the server's IP
    const serverIp = getLocalIp();
    const downloadUrl = `http://${serverIp}:${PORT}/photos/${filename}`;

    console.log(`[upload] Saved ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    res.json({ downloadUrl });
  } catch (err) {
    console.error('[upload] Error:', err);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

// --- Print photo ---
app.post('/print', (req, res) => {
  const { img, orientation } = req.body;
  if (!img) {
    return res.status(400).json({ error: 'Missing "img" field (base64 string)' });
  }

  try {
    const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `print_${Date.now()}.png`;
    const filepath = path.join(PHOTOS_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    console.log(`[print] Saved ${filename} (${(buffer.length / 1024).toFixed(1)} KB), orientation: ${orientation || 'default'}`);

    // Attempt OS-level printing (Windows)
    if (os.platform() === 'win32') {
      // Use mspaint /p for silent printing on Windows
      exec(`mspaint /p "${filepath}"`, (err) => {
        if (err) {
          console.warn('[print] OS print command failed:', err.message);
        } else {
          console.log('[print] Sent to OS print queue');
        }
      });
    }

    res.json({ success: true, message: 'Print job queued', filename });
  } catch (err) {
    console.error('[print] Error:', err);
    res.status(500).json({ error: 'Failed to process print' });
  }
});

// --- Utility: get local network IP ---
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip loopback and non-IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// --- Start server ---
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('');
  console.log('======================================');
  console.log('  Photobooth Server Running');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log('======================================');
  console.log('');
  console.log('Make sure the app\'s IP address setting matches:', ip);
  console.log('Photos directory:', PHOTOS_DIR);
  console.log('');
});
