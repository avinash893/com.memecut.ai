// MemeCut AI - Backend Server
// Runs as a local Node.js server inside CEP's Node.js environment
// Port 3001 - communicates with React frontend via fetch/WebSocket

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { WebSocketServer } = require('ws');
const http = require('http');

const geminiService   = require('./services/geminiService');
const memeService     = require('./services/memeService');
const ffmpegService   = require('./services/ffmpegService');
const settingsService = require('./services/settingsService');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// ─── WebSocket: broadcast progress to frontend ───────────────────────────────
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}
app.set('broadcast', broadcast);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/gemini',   require('./routes/gemini')(broadcast));
app.use('/api/memes',    require('./routes/memes')(broadcast));
app.use('/api/ffmpeg',   require('./routes/ffmpeg')(broadcast));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/captions', require('./routes/captions')(broadcast));
app.use('/api/shorts',   require('./routes/shorts')(broadcast));

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, version: '1.0.0' }));

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`MemeCut AI backend running on http://127.0.0.1:${PORT}`);
});

module.exports = { broadcast };
