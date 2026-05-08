// MemeCut AI - FFmpeg Route
const express = require('express');
const ffmpegSvc = require('../services/ffmpegService');
module.exports = (broadcast) => {
  const router = express.Router();

  router.post('/extract-audio', async (req, res) => {
    try {
      const { videoPath } = req.body;
      broadcast('progress', { task: 'ffmpeg', status: 'Extracting audio…', pct: 20 });
      const out = await ffmpegSvc.extractAudio(videoPath);
      broadcast('progress', { task: 'ffmpeg', status: 'Done!', pct: 100 });
      res.json({ ok: true, audioPath: out });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/silences', async (req, res) => {
    try {
      const { videoPath, threshold = -40, minDuration = 0.5 } = req.body;
      broadcast('progress', { task: 'silences', status: 'Extracting audio…', pct: 15 });
      const audioPath = await ffmpegSvc.extractAudio(videoPath);
      broadcast('progress', { task: 'silences', status: 'Analysing…', pct: 50 });
      const silences = await ffmpegSvc.detectSilences(audioPath, threshold, minDuration);
      broadcast('progress', { task: 'silences', status: 'Done!', pct: 100 });
      res.json({ ok: true, silences });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/duration', async (req, res) => {
    try {
      const { filePath } = req.body;
      const duration = await ffmpegSvc.getVideoDuration(filePath);
      res.json({ ok: true, duration });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/thumbnail', async (req, res) => {
    try {
      const { mediaPath, seconds = 0 } = req.body;
      const thumb = await ffmpegSvc.generateThumbnail(mediaPath, null, seconds);
      res.json({ ok: true, thumbnailPath: thumb });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
