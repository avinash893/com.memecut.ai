// MemeCut AI - Captions Tab
import { useState } from 'react'
import { useStore, actions } from '../store/index.jsx'
import { api, insertCaptionClip } from '../utils/cep.js'

const PRESETS = {
  tiktok:   { font: 'Arial Black', size: 72, color: '#FFFFFF', stroke: '#000000', pos: 'bottom' },
  youtube:  { font: 'Impact',       size: 60, color: '#FFFF00', stroke: '#000000', pos: 'bottom' },
  minimal:  { font: 'Helvetica',    size: 48, color: '#FFFFFF', stroke: 'none',    pos: 'bottom' },
  fire:     { font: 'Arial Black',  size: 80, color: '#FF4F4F', stroke: '#000000', pos: 'center' },
}

export default function CaptionsTab() {
  const { state, dispatch } = useStore()
  const [style, setStyle] = useState('tiktok')
  const [inserting, setInserting] = useState(false)
  const [preview, setPreview] = useState(null)

  async function generateCaptions() {
    if (!state.words?.length) {
      dispatch(actions.setToast({ msg: 'Run AI → Transcribe first!', error: true })); return
    }
    try {
      dispatch(actions.setProgress({ task: 'captions', status: 'Generating captions…', pct: 20 }))
      const res = await api('/captions/generate', 'POST', { words: state.words, style })
      if (!res.ok) throw new Error(res.error)
      dispatch(actions.setCaptions(res.captions))
      dispatch(actions.setToast({ msg: `✅ Generated ${res.captions.length} caption chunks` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function insertAllCaptions() {
    if (!state.captions?.length) {
      dispatch(actions.setToast({ msg: 'Generate captions first!', error: true })); return
    }
    setInserting(true)
    const s = state.settings
    const track = 2
    let done = 0
    try {
      dispatch(actions.setProgress({ task: 'captions', status: 'Inserting captions…', pct: 5 }))
      for (const cap of state.captions) {
        await insertCaptionClip(cap.text, cap.start, cap.end, track,
          s.captionFont, s.captionFontSize, s.captionColor)
        done++
        dispatch(actions.setProgress({ task: 'captions', status: `Inserted ${done}/${state.captions.length}…`,
          pct: Math.round((done/state.captions.length)*100) }))
      }
      dispatch(actions.setToast({ msg: `✅ Inserted ${done} captions on V${track+1}` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      setInserting(false)
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  function applyPreset(name) {
    const p = PRESETS[name]
    if (!p) return
    setStyle(name)
    dispatch(actions.setSettings({ captionFont: p.font, captionFontSize: p.size, captionColor: p.color, captionStroke: p.stroke }))
  }

  const s = state.settings

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Presets */}
        <div>
          <div className="text-[9px] text-muted uppercase tracking-widest mb-2">🎨 Style Presets</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(PRESETS).map(name => (
              <button key={name} onClick={() => applyPreset(name)}
                className={`py-2 border rounded font-display text-sm tracking-wider transition-all
                  ${style === name ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:border-white'}`}>
                {name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <div className="text-[9px] text-muted uppercase tracking-widest mb-2">⚙️ Caption Settings</div>
          {[
            ['Font', 'captionFont', 'text'],
            ['Font Size', 'captionFontSize', 'number'],
            ['Color', 'captionColor', 'color'],
            ['Stroke Color', 'captionStroke', 'color'],
          ].map(([label, key, type]) => (
            <label key={key} className="flex items-center justify-between text-[9px] text-muted">
              {label}
              <input type={type} value={s[key]}
                onChange={e => dispatch(actions.setSettings({ [key]: type === 'number' ? parseInt(e.target.value) : e.target.value }))}
                className="bg-surface2 border border-border text-white px-2 py-0.5 rounded text-[9px] w-28"
                style={type === 'color' ? { padding: '2px', height: '24px', width: '48px' } : {}} />
            </label>
          ))}
        </div>

        {/* Preview */}
        <div>
          <div className="text-[9px] text-muted uppercase tracking-widest mb-2">👁 Preview</div>
          <div className="bg-black rounded aspect-video flex items-end justify-center pb-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-surface2 to-black opacity-50" />
            <div className="relative z-10 text-center px-4 py-1 rounded"
              style={{
                fontFamily: s.captionFont,
                fontSize: `${Math.min(s.captionFontSize / 5, 28)}px`,
                color: s.captionColor,
                WebkitTextStroke: s.captionStroke !== 'none' ? `2px ${s.captionStroke}` : 'none',
                textShadow: `2px 2px 4px ${s.captionStroke || '#000'}`,
              }}>
              {state.captions?.[0]?.text || 'SAMPLE CAPTION TEXT'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Btn primary onClick={generateCaptions}>🤖 Generate Captions</Btn>
          <Btn onClick={insertAllCaptions} disabled={inserting}>
            {inserting ? '⏳ Inserting…' : '✅ Insert All to Timeline'}
          </Btn>
        </div>

        {/* Caption list */}
        {state.captions?.length > 0 && (
          <div>
            <div className="text-[9px] text-muted uppercase tracking-widest mb-2">
              📋 {state.captions.length} Captions
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {state.captions.map((cap, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-surface border border-border rounded text-[9px]">
                  <span className="text-accent font-display w-12 flex-shrink-0">{formatTime(cap.start)}</span>
                  <span className="flex-1 text-white truncate">{cap.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!state.words?.length && (
          <div className="text-center py-6 text-muted text-[9px]">
            <div className="font-display text-3xl text-border mb-2">💬</div>
            Go to the AI tab → Run Transcription first,<br/>then come back here to generate captions.
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(sec) {
  if (!sec && sec !== 0) return '—'
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function Btn({ children, onClick, primary, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`text-[10px] px-3 py-1.5 border rounded font-mono transition-all active:scale-95 disabled:opacity-40
        ${primary ? 'bg-accent text-black border-accent hover:bg-yellow-300 font-bold'
                  : 'bg-surface2 text-white border-border hover:bg-border'}`}>
      {children}
    </button>
  )
}
