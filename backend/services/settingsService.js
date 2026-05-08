// MemeCut AI - Settings Service
// Persists settings to a local JSON file

const fs = require('fs-extra');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../data/settings.json');

const DEFAULTS = {
  geminiApiKey: '',
  memeFolder: '',
  silenceThreshold: -40,
  minSilenceDuration: 0.5,
  silencePadding: 0.1,
  defaultMemeDuration: 2,
  defaultZoomAmount: 1.15,
  captionFont: 'Arial Black',
  captionFontSize: 72,
  captionColor: '#FFFFFF',
  captionStroke: '#000000',
  captionPosition: 'bottom',
  autoSave: true,
  backendPort: 3001
};

function load() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULTS, ...fs.readJsonSync(SETTINGS_PATH) };
    }
  } catch (e) {}
  return { ...DEFAULTS };
}

function save(settings) {
  fs.ensureDirSync(path.dirname(SETTINGS_PATH));
  fs.writeJsonSync(SETTINGS_PATH, settings, { spaces: 2 });
}

function get(key) { return load()[key]; }

function set(key, value) {
  const s = load();
  s[key] = value;
  save(s);
}

function getAll() { return load(); }
function setAll(settings) { save({ ...load(), ...settings }); }

module.exports = { get, set, getAll, setAll, DEFAULTS };
