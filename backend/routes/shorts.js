// MemeCut AI - Shorts Route
const express = require('express');
const gemini = require('../services/geminiService');
module.exports = (broadcast) => {
  const router = express.Router();

  // POST /api/shorts/analyze  { transcript, duration }
  router.post('/analyze', async (req, res) => {
    try {
      const { transcript, duration } = req.body;
      broadcast('progress', { task: 'shorts', status: 'Finding viral moments…', pct: 30 });
      const result = await gemini.detectViralMoments(transcript, duration);
      broadcast('progress', { task: 'shorts', status: 'Done!', pct: 100 });
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
