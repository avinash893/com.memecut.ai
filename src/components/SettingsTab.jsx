// MemeCut AI - Settings Tab
import { useState, useEffect } from 'react'
import { useStore, actions } from '../store/index.jsx'
import { api } from '../utils/cep.js'

export default function SettingsTab() {
  const { state, dispatch } = useStore()
  const [saved, setSaved] = useState(false)
  const [backendOk, setBackendOk] = useState(null)

  useEffect(() => { loadFromBackend(); checkBackend() }, [])

  async function loadFromBackend() {
    try {
      const res = await api('/settings')
      if (res.ok) dispatch(actions.setSettings(res.settings))
    } catch {}
  }

  async function checkBackend() {
    try {
      const res = await api('/health')
      setBackendOk(res.ok)
    } catch { setBackendOk(false) }
  }

  async function saveSettings() {
    try {
      await api('/settings', 'POST', state.settings)
      setSaved(true)
      dispatch(actions.setToast({ msg: '✅ Settings saved' }))
      setTimeout(() => setSaved(false), 2000)
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    }
  }

  const s = state.settings
  const set = (key, val) => dispatch(actions.setSettings({ [key]: val }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-5">

        {/* Backend status */}
        <div className={`flex items-center gap-2 p-2.5 border rounded text-[9px]
          ${backendOk ? 'border-hype/40 bg-hype/5 text-hype' : 'border-accent2/40 bg-accent2/5 text-accent2'}`}>
          <div className={`w-2 h-2 rounded-full ${backendOk ? 'bg-hype' : 'bg-accent2'}`} />
          {backendOk ? '✅ Backend running on port 3001' : '❌ Backend not running — run: npm run backend'}
          <button onClick={checkBackend} className="ml-auto underline opacity-60 hover:opacity-100">Recheck</button>
        </div>

        {/* Gemini API */}
        <Section title="🤖 Gemini AI">
          <label className="block text-[9px] text-muted mb-1">API Key (Gemini Student Subscription)</label>
          <input type="password" value={s.geminiApiKey || ''} placeholder="AIza..."
            onChange={e => set('geminiApiKey', e.target.value)}
            className="w-full bg-surface2 border border-border text-white text-[10px] px-2 py-1.5 rounded font-mono outline-none focus:border-accent" />
          <p className="text-[8px] text-muted mt-1">
            Get your key at <span className="text-accent">aistudio.google.com</span>
          </p>
        </Section>

        {/* Silence removal */}
        <Section title="✂️ Silence Removal">
          {[
            ['Silence Threshold (dB)', 'silenceThreshold', -80, -10, 1],
            ['Min Silence Duration (s)', 'minSilenceDuration', 0.1, 10, 0.1],
            ['Padding Before/After (s)', 'silencePadding', 0, 2, 0.05],
          ].map(([label, key, min, max, step]) => (
            <Row key={key} label={label}>
              <input type="number" value={s[key] ?? ''} min={min} max={max} step={step}
                onChange={e => set(key, parseFloat(e.target.value))}
                className="w-20 bg-surface2 border border-border text-white text-[9px] px-1.5 py-0.5 rounded text-center" />
            </Row>
          ))}
        </Section>

        {/* Meme settings */}
        <Section title="🎭 Meme Engine">
          {[
            ['Default Meme Duration (s)', 'defaultMemeDuration', 0.5, 30, 0.5],
            ['Default Zoom Amount', 'defaultZoomAmount', 1.0, 2.0, 0.05],
          ].map(([label, key, min, max, step]) => (
            <Row key={key} label={label}>
              <input type="number" value={s[key] ?? ''} min={min} max={max} step={step}
                onChange={e => set(key, parseFloat(e.target.value))}
                className="w-20 bg-surface2 border border-border text-white text-[9px] px-1.5 py-0.5 rounded text-center" />
            </Row>
          ))}
          <Row label="Auto random meme on tag">
            <input type="checkbox" checked={!!s.autoRandomMeme}
              onChange={e => set('autoRandomMeme', e.target.checked)}
              className="accent-yellow-400 w-4 h-4" />
          </Row>
        </Section>

        {/* Caption settings */}
        <Section title="💬 Captions">
          <Row label="Font">
            <input type="text" value={s.captionFont || ''} onChange={e => set('captionFont', e.target.value)}
              className="w-36 bg-surface2 border border-border text-white text-[9px] px-1.5 py-0.5 rounded" />
          </Row>
          <Row label="Font Size">
            <input type="number" value={s.captionFontSize || 72} min={24} max={200}
              onChange={e => set('captionFontSize', parseInt(e.target.value))}
              className="w-20 bg-surface2 border border-border text-white text-[9px] px-1.5 py-0.5 rounded text-center" />
          </Row>
          <Row label="Color">
            <input type="color" value={s.captionColor || '#ffffff'}
              onChange={e => set('captionColor', e.target.value)}
              className="w-10 h-6 rounded border border-border bg-surface2 cursor-pointer" />
          </Row>
          <Row label="Stroke Color">
            <input type="color" value={s.captionStroke || '#000000'}
              onChange={e => set('captionStroke', e.target.value)}
              className="w-10 h-6 rounded border border-border bg-surface2 cursor-pointer" />
          </Row>
        </Section>

        {/* Hotkey reference */}
        <Section title="⌨️ Hotkeys">
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            {[
              ['F','Funny'], ['A','Angry'], ['S','Sad'], ['W','Surprised'],
              ['C','Cringe'], ['H','Hype'], ['Q','Fail'], ['R','Rage'],
              ['V','Victory'], ['N','Confusion'], ['U','Sus'], ['M','Emotional'],
              ['Space','Play / Pause'], ['← →','Skip 1s'],
              ['Ctrl+Z','Undo last mark'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="font-display text-accent text-xs w-16">{key}</span>
                <span className="text-muted">{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Installation path reminder */}
        <Section title="📁 Installation">
          <div className="text-[9px] text-muted space-y-1 leading-5">
            <div className="text-white font-bold">Windows:</div>
            <div className="text-accent/80 break-all">%AppData%\Adobe\CEP\extensions\com.memecut.ai</div>
            <div className="text-white font-bold mt-2">macOS:</div>
            <div className="text-accent/80 break-all">/Library/Application Support/Adobe/CEP/extensions/com.memecut.ai</div>
            <div className="mt-2 text-muted">Enable unsigned extensions: <span className="text-white">CSXS.PlayerDebugMode = 1</span></div>
          </div>
        </Section>

      </div>

      {/* Save button */}
      <div className="flex-shrink-0 p-3 border-t border-border bg-surface">
        <button onClick={saveSettings}
          className={`w-full py-2.5 font-display text-base tracking-widest rounded border transition-all
            ${saved ? 'bg-hype/20 border-hype text-hype' : 'bg-accent text-black border-accent hover:bg-yellow-300'}`}>
          {saved ? '✅ SAVED!' : '💾 SAVE SETTINGS'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div className="font-display text-sm tracking-wider text-accent mb-2">{title}</div>
      <div className="bg-surface border border-border rounded p-3 space-y-2.5">{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between text-[9px] text-muted">
      <span>{label}</span>
      {children}
    </div>
  )
}
