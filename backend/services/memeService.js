// MemeCut AI - Meme Library Service
// Scans folder hierarchy, caches metadata, manages meme library

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const CACHE_PATH = path.join(__dirname, '../../data/meme_cache.json');
const SUPPORTED = /\.(gif|mp4|mov|png|jpg|jpeg|webp|mp3|wav)$/i;

const EMOTION_FOLDERS = ['funny','angry','sad','surprised','cringe','hype','fail','rage','victory','confusion','sus','emotional'];

const TAG_COLORS = {
  funny:'#f5c518', angry:'#ff4f4f', sad:'#4fa3ff', surprised:'#b44fff',
  cringe:'#ff8c00', hype:'#00e5a0', fail:'#ff4f4f', rage:'#ff2020',
  victory:'#00e5a0', confusion:'#b44fff', sus:'#ff8c00', emotional:'#4fa3ff'
};

const TAG_MARKER_COLORS = {
  funny:2, angry:0, sad:4, surprised:7, cringe:1, hype:6,
  fail:0, rage:0, victory:6, confusion:7, sus:1, emotional:4
};

// Scan a root folder for memes in tag subfolders
async function scanFolder(rootPath) {
  const library = [];

  for (const tag of EMOTION_FOLDERS) {
    const tagDir = path.join(rootPath, tag);
    if (!await fs.pathExists(tagDir)) continue;

    const files = await fs.readdir(tagDir);
    for (const file of files) {
      if (!SUPPORTED.test(file)) continue;
      const fullPath = path.join(tagDir, file);
      const stat = await fs.stat(fullPath);
      const isAudio = /\.(mp3|wav)$/i.test(file);
      const isVideo = /\.(mp4|mov)$/i.test(file);
      const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(file);

      library.push({
        id: uuidv4(),
        name: path.basename(file, path.extname(file)),
        filename: file,
        path: fullPath,
        tag,
        type: isAudio ? 'sound' : isVideo ? 'video' : 'image',
        color: TAG_COLORS[tag] || '#fff',
        markerColor: TAG_MARKER_COLORS[tag] || 3,
        size: stat.size,
        addedAt: stat.mtime.toISOString()
      });
    }
  }

  // Cache it
  await fs.ensureDir(path.dirname(CACHE_PATH));
  await fs.writeJson(CACHE_PATH, { rootPath, library, scannedAt: new Date().toISOString() }, { spaces: 2 });

  return library;
}

// Load from cache or re-scan
async function getLibrary(rootPath) {
  try {
    if (await fs.pathExists(CACHE_PATH)) {
      const cache = await fs.readJson(CACHE_PATH);
      if (cache.rootPath === rootPath) return cache.library;
    }
  } catch(e) {}
  return rootPath ? scanFolder(rootPath) : [];
}

// Get memes by tag
async function getMemesByTag(rootPath, tag) {
  const lib = await getLibrary(rootPath);
  return tag === 'all' ? lib : lib.filter(m => m.tag === tag);
}

// Get random meme for a tag
async function getRandomMeme(rootPath, tag) {
  const pool = await getMemesByTag(rootPath, tag);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Clear cache
async function clearCache() {
  if (await fs.pathExists(CACHE_PATH)) await fs.remove(CACHE_PATH);
}

// Get stats
async function getStats(rootPath) {
  const lib = await getLibrary(rootPath);
  const stats = { total: lib.length, byTag: {}, byType: { video: 0, image: 0, sound: 0 } };
  for (const m of lib) {
    stats.byTag[m.tag] = (stats.byTag[m.tag] || 0) + 1;
    stats.byType[m.type] = (stats.byType[m.type] || 0) + 1;
  }
  return stats;
}

module.exports = { scanFolder, getLibrary, getMemesByTag, getRandomMeme, clearCache, getStats, EMOTION_FOLDERS, TAG_COLORS };
