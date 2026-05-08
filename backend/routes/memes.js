// MemeCut AI - Memes Routes
const express = require('express');
const memeService = require('../services/memeService');
const settingsService = require('../services/settingsService');

module.exports = (broadcast) => {
  const router = express.Router();

  // GET /api/memes/library
  router.get('/library', async (req, res) => {
    try {
      const folder = req.query.folder || settingsService.get('memeFolder');
      if (!folder) return res.json({ ok: true, library: [] });
      broadcast('progress', { task: 'memes', status: 'Scanning meme folder…', pct: 30 });
      const library = await memeService.getLibrary(folder);
      broadcast('progress', { task: 'memes', status: 'Done!', pct: 100 });
      res.json({ ok: true, library });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/memes/scan  { folderPath }
  router.post('/scan', async (req, res) => {
    try {
      const { folderPath } = req.body;
      if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
      settingsService.set('memeFolder', folderPath);
      const library = await memeService.scanFolder(folderPath);
      res.json({ ok: true, library, count: library.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/memes/random/:tag
  router.get('/random/:tag', async (req, res) => {
    try {
      const folder = settingsService.get('memeFolder');
      const meme = await memeService.getRandomMeme(folder, req.params.tag);
      if (!meme) return res.status(404).json({ error: 'No memes for tag: ' + req.params.tag });
      res.json({ ok: true, meme });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/memes/stats
  router.get('/stats', async (req, res) => {
    try {
      const folder = settingsService.get('memeFolder');
      const stats = await memeService.getStats(folder);
      res.json({ ok: true, stats });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/memes/clear-cache
  router.post('/clear-cache', async (req, res) => {
    try { await memeService.clearCache(); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
