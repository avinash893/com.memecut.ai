// MemeCut AI - CEP Bridge v1.2
// FIXED: Added full error logging, proper error surfacing, video detection checks

let _csi = null;

// ─── DEBUG LOG ────────────────────────────────────────────────────────────────
// Central logger — pushes to window.__memecutLog so the DebugConsole can read it
export function cepLog(level, ...args) {
  const entry = { level, ts: new Date().toLocaleTimeString(), msg: args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
  }).join(' ') };
  if (!window.__memecutLog) window.__memecutLog = [];
  window.__memecutLog.push(entry);
  // Keep last 200 entries
  if (window.__memecutLog.length > 200) window.__memecutLog.shift();
  // Notify listeners
  window.dispatchEvent(new CustomEvent('memecut-log', { detail: entry }));
  // Also mirror to browser console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn('[MemeCut]', ...args);
}

let _csiErrorLogged = false;
let _evalErrorCount = 0;

function getCSI() {
  if (_csi) return _csi;

  if (typeof CSInterface === 'undefined') {
    // Only log this once — it fires every 250ms due to polling otherwise
    if (!_csiErrorLogged) {
      _csiErrorLogged = true;
      cepLog('error',
        '❌ CSInterface is undefined — panel is NOT connected to Premiere.',
        'Fix: run QUICK_FIX_CSInterface.bat (or reinstall via install.bat)',
        'then close+reopen the panel in Premiere.'
      );
    }
    return null;
  }

  _csi = new CSInterface();
  _csiErrorLogged = false; // reset in case it recovered
  cepLog('info', '✅ CSInterface initialised — connected to Premiere Pro');
  try {
    const env = _csi.getHostEnvironment();
    cepLog('info', `Host: ${env.appName} ${env.appVersion}`);
    
    // FORCE RELOAD host scripts to bypass Premiere Pro caching old broken versions
    const extPath = _csi.getSystemPath('extension').replace(/\\/g, '/');
    const hostScripts = ['host/index.jsx', 'host/mcp_core.jsx'];
    hostScripts.forEach((relativePath) => {
      const jsxPath = `${extPath}/${relativePath}`;
      const loaderScript = "var res; try { $.evalFile('" + jsxPath + "'); res = 'OK'; } catch(e) { res = e.name + ': ' + e.message + ' at line ' + e.line; } res;";

      _csi.evalScript(loaderScript, (res) => {
        cepLog('info', `Forced evaluation of ${relativePath} result:`, res);
        if (res !== 'OK') {
          cepLog('error', `CRITICAL: Failed to load ${relativePath}:`, res);
        }
      });
    });
  } catch(e) {
    cepLog('warn', 'Could not read host environment:', e.message);
  }
  return _csi;
}

// Core evalScript wrapper — returns a Promise
export function jsx(script) {
  return new Promise((resolve) => {
    const csi = getCSI();
    if (!csi) {
      // Development mode outside Premiere
      cepLog('warn', '[CEP mock] evalScript called outside Premiere:', script.slice(0, 80));
      resolve(null);
      return;
    }
    // Only log debug for non-polling commands
    const isPolling = script.includes('getCurrentTime()') || script.includes('isPlaying()');
    if (!isPolling) cepLog('debug', 'evalScript →', script.slice(0, 120));
    
    // Wrap in simple try-catch on the ExtendScript side using var assignment to ensure return
    const safeScript = "var res; try { res = " + script + "; } catch(e) { res = '{\"error\":\"ExtendScript Exception: ' + e.message + '\"}'; } res;";
    
    csi.evalScript(safeScript, (result) => {
      if (!isPolling) cepLog('debug', 'evalScript ←', String(result).slice(0, 200));
      
      if (result === 'EvalScript error.') {
        _evalErrorCount++;
        if (_evalErrorCount === 1 || _evalErrorCount % 20 === 0) {
          cepLog('error', `ExtendScript critical failure (EvalScript error). Is host/index.jsx loaded without syntax errors? (${_evalErrorCount}x)`, '| script:', script.slice(0, 80));
        }
        resolve({ error: 'EvalScript error.' });
        return;
      }
      _evalErrorCount = 0; // reset on success

      try {
        const parsed = JSON.parse(result);
        if (parsed && parsed.error && !isPolling) {
          cepLog('error', 'ExtendScript error:', parsed.error, '| script:', script.slice(0, 80));
        }
        resolve(parsed);
      } catch {
        resolve(result);
      }
    });
  });
}

// ─── SEQUENCE / PLAYBACK ─────────────────────────────────────────────────────

export const getSequenceInfo   = () => jsx('getSequenceInfo()');
export const getCurrentTime    = () => jsx('getCurrentTime()').then(r => parseFloat(r) || 0);
export const setPlayerPosition = (s) => jsx(`setPlayerPosition(${s})`);
export const playSequence      = () => jsx('playSequence()');
export const pauseSequence     = () => jsx('pauseSequence()');
export const isPlaying         = () => jsx('isPlaying()').then(r => r === 'true');

// ─── TIMELINE-AWARE CLIP DETECTION ───────────────────────────────────────────

export const getActiveClipInfo     = () => jsx('getActiveClipInfo()');
export const getSelectedClipInfo   = () => jsx('getSelectedClipInfo()');
export const getFirstVideoClipPath = () => jsx('getFirstVideoClipPath()');
export const getFirstClipAnyTrack  = () => jsx('getFirstClipAnyTrack()');
export const getLargestClipOnTimeline = () => jsx('getLargestClipOnTimeline()');
export const getClipClosestToPlayhead = () => jsx('getClipClosestToPlayhead()');
export const getProjectBinVideo    = () => jsx('getProjectBinVideo()');
export const getAnyVideoFromProject= () => jsx('getAnyVideoFromProject()');
export const getPrimaryAudioPath   = () => jsx('getPrimaryAudioPath()');
export const getAllTimelineMediaPaths = () => jsx('getAllTimelineMediaPaths()');

/**
 * resolveMediaPath()
 * EXHAUSTIVE 10-METHOD RESOLUTION
 */
export async function resolveMediaPath() {
  cepLog('info', 'resolveMediaPath: starting exhaustive 10-method search…');

  const methods = [
    { name: 'Active Clip (V1-V9 under playhead)', fn: getActiveClipInfo },
    { name: 'Selected Clip', fn: async () => { const r = await getSelectedClipInfo(); return Array.isArray(r) && r.length > 0 ? r[0] : null; } },
    { name: 'Closest Clip to Playhead', fn: getClipClosestToPlayhead },
    { name: 'Largest Clip on Timeline', fn: getLargestClipOnTimeline },
    { name: 'First Clip on V1', fn: getFirstVideoClipPath },
    { name: 'First Clip on Any Track', fn: getFirstClipAnyTrack },
    { name: 'First Audio Track (fallback)', fn: getPrimaryAudioPath },
    { name: 'Any Timeline Media Path', fn: async () => { const r = await getAllTimelineMediaPaths(); return Array.isArray(r) && r.length > 0 ? r[0] : null; } },
    { name: 'Project Bin First Video', fn: getProjectBinVideo },
    { name: 'Any Project Video (Deep Search)', fn: getAnyVideoFromProject },
  ];

  for (let i = 0; i < methods.length; i++) {
    const { name, fn } = methods[i];
    cepLog('info', `Method ${i + 1}/10: trying ${name}…`);
    try {
      const result = await fn();
      if (result && result.mediaPath) {
        cepLog('info', `✅ SUCCESS (Method ${i + 1}): found media via ${name}:`, result.mediaPath);
        return result;
      }
      cepLog('warn', `❌ Method ${i + 1} (${name}) failed:`, result?.error || 'No mediaPath returned');
    } catch (e) {
      cepLog('error', `❌ Method ${i + 1} (${name}) threw an error:`, e.message);
    }
  }

  cepLog('error', 'resolveMediaPath: ❌ ALL 10 METHODS FAILED. Cannot find any video.');
  throw new Error('Critical Failure: Could not locate a video file in the timeline or project bin. Please import a valid .mp4 or .mov file.');
}

/**
 * resolveAudioPath()
 * FIXED: Full logging.
 */
export async function resolveAudioPath() {
  cepLog('info', 'resolveAudioPath: checking audio tracks…');
  try {
    const audio = await getPrimaryAudioPath();
    cepLog('info', 'getPrimaryAudioPath result:', audio);
    if (audio?.found && audio?.mediaPath) {
      cepLog('info', 'resolveAudioPath: ✅ found audio:', audio.mediaPath);
      return audio;
    }
    if (audio?.error) cepLog('warn', 'getPrimaryAudioPath error:', audio.error);
    else cepLog('warn', 'getPrimaryAudioPath: no audio at playhead');
  } catch (e) {
    cepLog('error', 'getPrimaryAudioPath threw:', e.message);
  }

  // Fall back to video path (video files contain audio)
  cepLog('info', 'resolveAudioPath: falling back to video clip path…');
  const video = await resolveMediaPath();
  if (video?.mediaPath) {
    cepLog('info', 'resolveAudioPath: ✅ using video file for audio:', video.mediaPath);
    return { ...video, mediaPath: video.mediaPath };
  }

  cepLog('error', 'resolveAudioPath: ❌ no audio found anywhere');
  throw new Error('No audio found on timeline. Ensure A1 has a clip.');
}

// ─── MCP-INSPIRED PREMIERE HELPERS ───────────────────────────────────────────

function escJsxString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const mcpCommand = (command, args = {}) =>
  jsx(`mcpx_execute("${escJsxString(command)}", "${escJsxString(JSON.stringify(args))}")`);

export const mcpPing = () => mcpCommand('ping');
export const mcpProjectInfo = () => mcpCommand('projectInfo');
export const mcpSequenceList = () => mcpCommand('sequenceList');
export const mcpTimelineState = () => mcpCommand('timelineState');
export const mcpFavoriteLocations = () => mcpCommand('favoriteLocations');
export const mcpBrowseMediaFiles = (folderPath) => mcpCommand('browseMediaFiles', { path: folderPath });
export const mcpImportFiles = (paths) => mcpCommand('importFiles', { paths: Array.isArray(paths) ? paths : [paths] });
export const mcpAddMarker = (seconds, name, comment, duration) =>
  mcpCommand('addMarker', { seconds, name, comment, duration });
export const mcpSetPlayhead = (seconds) => mcpCommand('setPlayhead', { seconds });

// ─── MARKERS ─────────────────────────────────────────────────────────────────

export const getAllMarkers = () => jsx('getAllMarkers()');
export const addMarker = (seconds, label, comment, colorIndex) =>
  jsx(`addMarker(${seconds}, "${label}", "${comment}", ${colorIndex || 0})`);

// ─── MEDIA IMPORT / INSERT ────────────────────────────────────────────────────

export const importAndInsertMedia = (filePath, atSec, durSec, vTrack, aTrack) =>
  jsx(`importAndInsertMedia("${filePath.replace(/\\/g,'\\\\')}", ${atSec}, ${durSec}, ${vTrack||1}, ${aTrack||1})`);

// ─── EDITING OPERATIONS ───────────────────────────────────────────────────────

export const addZoomKeyframes = (clipStart, peak, clipEnd, track, zoom) =>
  jsx(`addZoomKeyframes(${clipStart}, ${peak}, ${clipEnd}, ${track||0}, ${zoom||1.15})`);

export const insertCaptionClip = (text, start, end, track, font, size, color) =>
  jsx(`insertCaptionClip("${text.replace(/"/g,"'")}", ${start}, ${end}, ${track||2}, "${font||'Arial Black'}", ${size||72}, "${color||'#FFFFFF'}")`);

export const cutClipAtTime = (sec, track) =>
  jsx(`cutClipAtTime(${sec}, ${track||0})`);

export const rippleDeleteRange = (start, end, track) =>
  jsx(`rippleDeleteRange(${start}, ${end}, ${track||0})`);

export const createFreezeFrame = (sec, dur) =>
  jsx(`createFreezeFrameAtTime(${sec}, ${dur||2})`);

export const getFolderContents = (folder) =>
  jsx(`getFolderContents("${folder.replace(/\\/g,'\\\\')}")`);

// ─── FILE DIALOGS ─────────────────────────────────────────────────────────────

export const getFolderDialog = () => jsx('getFolderDialog()').then(r => (r === 'null' || !r) ? null : r);

// ─── PROJECT ─────────────────────────────────────────────────────────────────

export const saveProject   = () => jsx('saveProject()');
export const getProjectPath = () => jsx('getProjectPath()');

// ─── EXPORT ──────────────────────────────────────────────────────────────────

export const exportSequence = () => jsx('exportSequence()');

export const setInOutFromRange = (start, end) =>
  jsx(`setInOutFromRange(${start}, ${end})`);

export const clearInOut = () => jsx('clearInOut()');

// ─── BACKEND API ─────────────────────────────────────────────────────────────

export const API = 'http://127.0.0.1:3001/api';

export async function api(endpoint, method = 'GET', body = null) {
  cepLog('info', `api ${method} ${endpoint}`, body ? JSON.stringify(body).slice(0,100) : '');
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
    const res = await fetch(`${API}${endpoint}`, opts);
    if (!res.ok) {
      const txt = await res.text();
      cepLog('error', `api ${endpoint} HTTP ${res.status}:`, txt.slice(0, 200));
      throw new Error(`Server error ${res.status}: ${txt.slice(0, 120)}`);
    }
    const data = await res.json();
    cepLog('info', `api ${endpoint} ← ok`, JSON.stringify(data).slice(0, 150));
    return data;
  } catch (e) {
    if (e.message.startsWith('Server error')) throw e; // already logged
    cepLog('error', `api ${endpoint} fetch failed:`, e.message,
      '— is the backend running on port 3001?');
    throw new Error(`Backend unreachable (${endpoint}): ${e.message}`);
  }
}

// WebSocket for real-time progress
let ws = null;

export function connectWS(onMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  cepLog('info', 'WebSocket: connecting to ws://127.0.0.1:3001…');
  ws = new WebSocket('ws://127.0.0.1:3001');
  ws.onopen  = () => cepLog('info', 'WebSocket: ✅ connected');
  ws.onerror = (e) => cepLog('error', 'WebSocket error:', e.type);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch (err) {
      cepLog('warn', 'WebSocket message parse error:', err.message);
    }
  };
  ws.onclose = (e) => {
    cepLog('warn', `WebSocket closed (code ${e.code}), reconnecting in 2s…`);
    ws = null;
    setTimeout(() => connectWS(onMessage), 2000);
  };
}
