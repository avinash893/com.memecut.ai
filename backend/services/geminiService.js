// MemeCut AI - Gemini Service
// Handles all AI tasks: transcription, emotion detection, meme suggestions, viral scoring

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const path = require('path');
const settingsService = require('./settingsService');

let genAI = null;
let model = null;

function getClient() {
  const apiKey = settingsService.get('geminiApiKey');
  if (!apiKey) throw new Error('Gemini API key not set. Go to Settings.');
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return model;
}

// ─── TRANSCRIPTION ───────────────────────────────────────────────────────────
// Sends audio file to Gemini for transcription with timestamps
async function transcribeAudio(audioPath) {
  const m = getClient();
  const audioData = await fs.readFile(audioPath);
  const base64Audio = audioData.toString('base64');
  const ext = path.extname(audioPath).replace('.', '');
  const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'audio/mp4' };

  const prompt = `Transcribe this audio with precise word-level timestamps.
Return ONLY valid JSON in this exact format:
{
  "words": [
    { "word": "Hello", "start": 0.12, "end": 0.45, "confidence": 0.99 }
  ],
  "filler_words": ["um", "uh", "like", "basically", "literally", "you know", "kind of", "sort of"],
  "segments": [
    { "text": "Hello world", "start": 0.12, "end": 1.5 }
  ]
}`;

  const result = await m.generateContent([
    { inlineData: { mimeType: mimeMap[ext] || 'audio/mpeg', data: base64Audio } },
    prompt
  ]);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ─── EMOTION DETECTION ───────────────────────────────────────────────────────
async function detectEmotions(transcript, segments) {
  const m = getClient();
  const prompt = `Analyze this video transcript and detect emotional moments for meme insertion.

Transcript segments:
${JSON.stringify(segments, null, 2)}

For each high-impact moment, identify:
- The emotion type: funny, angry, sad, surprised, cringe, hype, fail, rage, victory, confusion, sus, emotional
- Confidence (0-1)
- Whether it's a good meme insertion point
- Suggested meme category

Return ONLY valid JSON:
{
  "moments": [
    {
      "time": 12.5,
      "end_time": 14.2,
      "emotion": "funny",
      "confidence": 0.92,
      "text": "the transcript text here",
      "meme_suggestion": "classic reaction",
      "is_viral_worthy": true
    }
  ]
}`;

  const result = await m.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ─── VIRAL MOMENT DETECTION ──────────────────────────────────────────────────
async function detectViralMoments(transcript, videoDuration) {
  const m = getClient();
  const prompt = `You are a viral video expert for TikTok/YouTube Shorts.
Analyze this transcript and identify the TOP viral moments.

Transcript: ${transcript}
Video duration: ${videoDuration} seconds

Return ONLY valid JSON:
{
  "viral_moments": [
    {
      "start": 45.2,
      "end": 75.8,
      "score": 0.95,
      "reason": "High energy punchline with relatable content",
      "hook_text": "This moment will blow up",
      "suggested_caption": "When you realize...",
      "emotion": "funny"
    }
  ],
  "best_short_start": 45.2,
  "best_short_end": 105.8,
  "overall_virality_score": 0.78
}`;

  const result = await m.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ─── FILLER WORD DETECTION ───────────────────────────────────────────────────
async function detectFillerWords(words) {
  // Filter from transcription result directly — no API call needed
  const fillers = new Set(['um', 'uh', 'like', 'basically', 'literally',
    'you know', 'kind of', 'sort of', 'i mean', 'actually', 'right', 'so']);
  return words.filter(w => fillers.has(w.word.toLowerCase().replace(/[.,!?]/g, '')));
}

// ─── SILENCE DETECTION via transcript gaps ────────────────────────────────────
async function detectSilences(words, threshold = 0.5) {
  const silences = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].start - words[i].end;
    if (gap >= threshold) {
      silences.push({ start: words[i].end, end: words[i + 1].start, duration: gap });
    }
  }
  return silences;
}

// ─── CAPTION GENERATION ──────────────────────────────────────────────────────
async function generateCaptions(words, style = 'tiktok') {
  // Group words into caption chunks (3-4 words per caption for TikTok style)
  const chunks = [];
  const chunkSize = style === 'tiktok' ? 3 : 6;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    chunks.push({
      text: chunk.map(w => w.word).join(' '),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      words: chunk
    });
  }
  return chunks;
}

// ─── MEME SUGGESTION ─────────────────────────────────────────────────────────
async function suggestMemeForMoment(text, emotion, availableMemes) {
  const m = getClient();
  const memeNames = availableMemes.map(m => m.name).join(', ');
  const prompt = `Given this moment in a video: "${text}"
Emotion: ${emotion}
Available memes: ${memeNames}

Which meme fits best? Return ONLY JSON:
{ "best_meme": "meme_name_here", "reason": "brief reason", "confidence": 0.85 }`;

  const result = await m.generateContent(prompt);
  const text2 = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text2);
}

// ─── CHAPTER GENERATION ──────────────────────────────────────────────────────
async function generateChapters(transcript, duration) {
  const m = getClient();
  const prompt = `Create YouTube chapters for this video transcript.
Duration: ${duration}s

Transcript: ${transcript}

Return ONLY valid JSON:
{
  "chapters": [
    { "time": 0, "title": "Intro", "description": "Brief intro" },
    { "time": 45.2, "title": "Main Topic", "description": "..." }
  ]
}`;

  const result = await m.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ─── REPETITION DETECTION ────────────────────────────────────────────────────
async function detectRepetitions(segments) {
  const m = getClient();
  const prompt = `Analyze these transcript segments and find repeated takes or duplicate sentences.
${JSON.stringify(segments)}

Return ONLY valid JSON:
{
  "repetitions": [
    {
      "first_occurrence": { "start": 10.2, "end": 15.8, "text": "..." },
      "duplicate": { "start": 45.2, "end": 50.1, "text": "..." },
      "similarity": 0.94,
      "keep": "first"
    }
  ]
}`;

  const result = await m.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

module.exports = {
  transcribeAudio, detectEmotions, detectViralMoments,
  detectFillerWords, detectSilences, generateCaptions,
  suggestMemeForMoment, generateChapters, detectRepetitions
};
