#!/usr/bin/env node
// MemeCut AI - Install Script
// Copies extension to the correct CEP extensions folder

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const EXT_ID = 'com.memecut.ai';
// __dirname is scripts/ — go up one level to get the extension root
const SRC = path.join(__dirname, '..');

function getExtensionsPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'Adobe', 'CEP', 'extensions');
  } else {
    return path.join('/Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
  }
}

function enablePlayerDebugMode() {
  if (process.platform === 'win32') {
    try {
      execSync('REG ADD HKCU\\Software\\Adobe\\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f', { stdio: 'ignore' });
      execSync('REG ADD HKCU\\Software\\Adobe\\CSXS.10 /v PlayerDebugMode /t REG_SZ /d 1 /f', { stdio: 'ignore' });
      execSync('REG ADD HKCU\\Software\\Adobe\\CSXS.9  /v PlayerDebugMode /t REG_SZ /d 1 /f', { stdio: 'ignore' });
      console.log('✅ PlayerDebugMode enabled (Windows registry)');
    } catch(e) { console.log('⚠  Could not set registry key — run as admin or set manually'); }
  } else {
    const plistPath = path.join(os.homedir(), 'Library', 'Preferences', 'com.adobe.CSXS.11.plist');
    try {
      execSync(`defaults write com.adobe.CSXS.11 PlayerDebugMode 1`);
      execSync(`defaults write com.adobe.CSXS.10 PlayerDebugMode 1`);
      execSync(`defaults write com.adobe.CSXS.9  PlayerDebugMode 1`);
      console.log('✅ PlayerDebugMode enabled (macOS plist)');
    } catch(e) { console.log('⚠  Could not write plist — try: defaults write com.adobe.CSXS.11 PlayerDebugMode 1'); }
  }
}

async function install() {
  console.log('\n🎭 MemeCut AI — Installer\n' + '='.repeat(40));

  const dest = path.join(getExtensionsPath(), EXT_ID);
  console.log(`📁 Installing to: ${dest}`);

  // Remove old install
  if (await fs.pathExists(dest)) {
    await fs.remove(dest);
    console.log('🗑  Removed old installation');
  }

  // Copy extension files
  await fs.ensureDir(path.dirname(dest));
  await fs.copy(SRC, dest);
  console.log('✅ Extension files copied');

  // ── CRITICAL: Copy CSInterface.js from Adobe CEP SDK into dist/ ──────────
  // Without this file in dist/, the panel cannot call evalScript and will
  // show "No Sequence" for everything. Adobe provides this file in the SDK.
  const csiSrcPaths = process.platform === 'win32'
    ? [
        'C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\SDK\\interface\\js\\CSInterface.js',
        'C:\\Program Files\\Common Files\\Adobe\\CEP\\SDK\\interface\\js\\CSInterface.js',
        path.join(process.env.APPDATA || '', '..\\Local\\Adobe\\CSXS.11\\CSInterface.js'),
      ]
    : [
        '/Library/Application Support/Adobe/CEP/extensions/CSInterface.js',
        '/Applications/Adobe Premiere Pro 2025/CEP/extensions/CSInterface.js',
        path.join(process.env.HOME || '', 'Library/Application Support/Adobe/CEP/SDK/interface/js/CSInterface.js'),
      ];

  const csiDest = path.join(dest, 'dist', 'CSInterface.js');
  let csiFound = false;
  for (const csiPath of csiSrcPaths) {
    if (await fs.pathExists(csiPath)) {
      await fs.copy(csiPath, csiDest);
      console.log(`✅ CSInterface.js copied from SDK: ${csiPath}`);
      csiFound = true;
      break;
    }
  }
  if (!csiFound) {
    console.log('⚠  Could not find Adobe CSInterface.js in expected SDK locations.');
    console.log('   The stub file will be used — this is OK if npm run build already ran.');
    console.log('   If "No Sequence" persists, manually copy CSInterface.js from:');
    console.log('   https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/CSInterface.js');
    console.log(`   → Paste it into: ${csiDest}`);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Create data directories
  await fs.ensureDir(path.join(dest, 'data', 'temp'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'funny'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'angry'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'sad'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'surprised'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'cringe'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'hype'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'fail'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'rage'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'victory'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'confusion'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'sus'));
  await fs.ensureDir(path.join(dest, 'assets', 'memes', 'emotional'));
  console.log('✅ Created meme folder structure');

  // Enable unsigned extensions
  enablePlayerDebugMode();

  // Install npm deps
  console.log('\n📦 Installing npm dependencies…');
  try {
    execSync('npm install', { cwd: dest, stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch(e) { console.log('⚠  npm install failed — run manually inside the extension folder'); }

  // Build frontend
  console.log('\n🔨 Building frontend…');
  try {
    execSync('npm run build', { cwd: dest, stdio: 'inherit' });
    console.log('✅ Frontend built to dist/');
  } catch(e) { console.log('⚠  Build failed — run: npm run build'); }

  console.log('\n' + '='.repeat(40));
  console.log('🎉 MemeCut AI installed successfully!\n');
  console.log('Next steps:');
  console.log('  1. Restart Adobe Premiere Pro');
  console.log('  2. Window → Extensions → MemeCut AI 🎭');
  console.log('  3. Start the backend: npm run backend');
  console.log('  4. Add your Gemini API key in Settings tab');
  console.log('  5. Select your Memes folder in the MEMES tab\n');
}

install().catch(e => { console.error('❌ Install failed:', e.message); process.exit(1); });
