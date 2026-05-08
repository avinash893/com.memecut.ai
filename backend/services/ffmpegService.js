// MemeCut AI - FFmpeg Service
// Handles audio extraction, silence detection, frame export

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../data/temp');
fs.ensureDirSync(TEMP_DIR);

// Extract audio from video for Gemini transcription
function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    outputPath = outputPath || path.join(TEMP_DIR, `audio_${Date.now()}.mp3`);
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

// Detect silences using ffmpeg silencedetect filter
function detectSilences(audioPath, threshold = -40, minDuration = 0.5) {
  return new Promise((resolve, reject) => {
    const silences = [];
    let currentStart = null;

    ffmpeg(audioPath)
      .audioFilters(`silencedetect=noise=${threshold}dB:d=${minDuration}`)
      .format('null')
      .on('stderr', (line) => {
        const startMatch = line.match(/silence_start: ([\d.]+)/);
        const endMatch   = line.match(/silence_end: ([\d.]+)/);
        if (startMatch) currentStart = parseFloat(startMatch[1]);
        if (endMatch && currentStart !== null) {
          silences.push({ start: currentStart, end: parseFloat(endMatch[1]),
            duration: parseFloat(endMatch[1]) - currentStart });
          currentStart = null;
        }
      })
      .on('end', () => resolve(silences))
      .on('error', reject)
      .output('/dev/null').run();
  });
}

// Get video duration
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// Get audio waveform peaks (for beat detection)
function getAudioPeaks(audioPath, numPeaks = 200) {
  return new Promise((resolve, reject) => {
    const peaks = [];
    ffmpeg(audioPath)
      .audioFilters(`aresample=8000,asetnsamples=n=${Math.ceil(numPeaks)},astats=metadata=1:reset=1`)
      .format('null')
      .on('stderr', line => {
        const rmsMatch = line.match(/RMS level dB:([\s-\d.]+)/);
        if (rmsMatch) peaks.push(parseFloat(rmsMatch[1].trim()));
      })
      .on('end', () => resolve(peaks))
      .on('error', reject)
      .output('/dev/null').run();
  });
}

// Export a single frame as PNG
function exportFrame(videoPath, seconds, outputPath) {
  return new Promise((resolve, reject) => {
    outputPath = outputPath || path.join(TEMP_DIR, `frame_${Date.now()}.png`);
    ffmpeg(videoPath)
      .seekInput(seconds)
      .frames(1)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

// Generate thumbnail for meme card
function generateThumbnail(mediaPath, outputPath, seconds = 0) {
  return new Promise((resolve, reject) => {
    outputPath = outputPath || path.join(TEMP_DIR, `thumb_${Date.now()}.jpg`);
    ffmpeg(mediaPath)
      .seekInput(seconds)
      .frames(1)
      .size('200x?')
      .on('end', () => resolve(outputPath))
      .on('error', () => resolve(null)) // silently fail for images
      .save(outputPath);
  });
}

// Cleanup temp files older than 1 hour
async function cleanupTemp() {
  const files = await fs.readdir(TEMP_DIR);
  const now = Date.now();
  for (const f of files) {
    const fp = path.join(TEMP_DIR, f);
    const stat = await fs.stat(fp);
    if (now - stat.mtimeMs > 3600000) await fs.remove(fp);
  }
}

module.exports = { extractAudio, detectSilences, getVideoDuration, getAudioPeaks, exportFrame, generateThumbnail, cleanupTemp, TEMP_DIR };
