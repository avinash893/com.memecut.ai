// MemeCut AI - Captions Route
const express = require('express');
module.exports = (broadcast) => {
  const router = express.Router();
  const gemini = require('../services/geminiService');

  // POST /api/captions/generate  { words, style }
  router.post('/generate', async (req, res) => {
    try {
      const { words, style = 'tiktok' } = req.body;
      broadcast('progress', { task: 'captions', status: 'Generating captions…', pct: 30 });
      const captions = await gemini.generateCaptions(words, style);
      broadcast('progress', { task: 'captions', status: 'Done!', pct: 100 });
      res.json({ ok: true, captions });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/captions/export-youtube  { chapters }
  router.post('/export-youtube', (req, res) => {
    try {
      const { chapters } = req.body;
      const lines = chapters.map(c => {
        const h = Math.floor(c.time / 3600);
        const m = Math.floor((c.time % 3600) / 60);
        const s = Math.floor(c.time % 60);
        const ts = h > 0
          ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
          : `${m}:${String(s).padStart(2,'0')}`;
        return `${ts} ${c.title}`;
      });
      res.json({ ok: true, text: lines.join('\n') });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
