// MemeCut AI - Gemini Routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const gemini = require('../services/geminiService');
const ffmpeg = require('../services/ffmpegService');
const settings = require('../services/settingsService');

const upload = multer({ dest: path.join(__dirname, '../../data/temp') });

module.exports = (broadcast) => {
  const router = express.Router();

  // POST /api/gemini/transcribe  { videoPath }
  router.post('/transcribe', async (req, res) => {
    try {
      const { videoPath } = req.body;
      if (!videoPath) return res.status(400).json({ error: 'videoPath required' });

      broadcast('progress', { task: 'transcribe', status: 'Extracting audio…', pct: 10 });
      const audioPath = await ffmpeg.extractAudio(videoPath);

      broadcast('progress', { task: 'transcribe', status: 'Sending to Gemini…', pct: 40 });
      const transcript = await gemini.transcribeAudio(audioPath);

      broadcast('progress', { task: 'transcribe', status: 'Done!', pct: 100 });
      await fs.remove(audioPath);
      res.json({ ok: true, transcript });
    } catch (e) {
      broadcast('progress', { task: 'transcribe', status: 'Error: ' + e.message, pct: 0 });
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/gemini/emotions  { segments }
  router.post('/emotions', async (req, res) => {
    try {
      const { transcript, segments } = req.body;
      broadcast('progress', { task: 'emotions', status: 'Detecting emotions…', pct: 30 });
      const result = await gemini.detectEmotions(transcript, segments);
      broadcast('progress', { task: 'emotions', status: 'Done!', pct: 100 });
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/gemini/viral  { transcript, duration }
  router.post('/viral', async (req, res) => {
    try {
      const { transcript, duration } = req.body;
      broadcast('progress', { task: 'viral', status: 'Finding viral moments…', pct: 30 });
      const result = await gemini.detectViralMoments(transcript, duration);
      broadcast('progress', { task: 'viral', status: 'Done!', pct: 100 });
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/gemini/silences  { videoPath, threshold, minDuration }
  router.post('/silences', async (req, res) => {
    try {
      const { videoPath, threshold = -40, minDuration = 0.5 } = req.body;
      broadcast('progress', { task: 'silences', status: 'Extracting audio…', pct: 10 });
      const audioPath = await ffmpeg.extractAudio(videoPath);
      broadcast('progress', { task: 'silences', status: 'Detecting silences…', pct: 50 });
      const silences = await ffmpeg.detectSilences(audioPath, threshold, minDuration);
      broadcast('progress', { task: 'silences', status: 'Done!', pct: 100 });
      await fs.remove(audioPath);
      res.json({ ok: true, silences });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/gemini/captions  { words, style }
  router.post('/captions', async (req, res) => {
    try {
      const { words, style = 'tiktok' } = req.body;
      const captions = await gemini.generateCaptions(words, style);
      res.json({ ok: true, captions });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/gemini/chapters  { transcript, duration }
  router.post('/chapters', async (req, res) => {
    try {
      const { transcript, duration } = req.body;
      const result = await gemini.generateChapters(transcript, duration);
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/gemini/repetitions  { segments }
  router.post('/repetitions', async (req, res) => {
    try {
      const { segments } = req.body;
      const result = await gemini.detectRepetitions(segments);
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/gemini/suggest-meme  { text, emotion, availableMemes }
  router.post('/suggest-meme', async (req, res) => {
    try {
      const { text, emotion, availableMemes } = req.body;
      const result = await gemini.suggestMemeForMoment(text, emotion, availableMemes);
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
