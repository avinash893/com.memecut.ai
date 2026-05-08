// MemeCut AI - Settings Routes
const express = require('express');
const router = express.Router();
const settings = require('../services/settingsService');

router.get('/',        (req, res) => res.json({ ok: true, settings: settings.getAll() }));
router.post('/',       (req, res) => { settings.setAll(req.body); res.json({ ok: true }); });
router.get('/:key',    (req, res) => res.json({ ok: true, value: settings.get(req.params.key) }));
router.post('/:key',   (req, res) => { settings.set(req.params.key, req.body.value); res.json({ ok: true }); });

module.exports = router;
