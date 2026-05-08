// MemeCut AI - Tagger Tab
// Live video tagging with hotkeys, scrubber, marks list, and meme assignment

import { useRef } from 'react'
import { useStore, actions } from '../store/index.jsx'
import { setPlayerPosition, playSequence, pauseSequence,
         importAndInsertMedia, addMarker, createFreezeFrame } from '../utils/cep.js'

const TAG_CONFIG = {
  funny:    { emoji:'😂', color:'#f5c518', key:'F', marker:2 },
  angry:    { emoji:'😡', color:'#ff4f4f', key:'A', marker:0 },
  sad:      { emoji:'😢', color:'#4fa3ff', key:'S', marker:4 },
  surprised:{ emoji:'😱', color:'#b44fff', key:'W', marker:7 },
  cringe:   { emoji:'🤦', color:'#ff8c00', key:'C', marker:1 },
  hype:     { emoji:'🔥', color:'#00e5a0', key:'H', marker:6 },
  fail:     { emoji:'💀', color:'#ff4f4f', key:'Q', marker:0 },
  rage:     { emoji:'🤬', color:'#ff2020', key:'R', marker:0 },
  victory:  { emoji:'🏆', color:'#00e5a0', key:'V', marker:6 },
  confusion:{ emoji:'😵', color:'#b44fff', key:'N', marker:7 },
  sus:      { emoji:'😏', color:'#ff8c00', key:'U', marker:1 },
  emotional:{ emoji:'😭', color:'#4fa3ff', key:'M', marker:4 },
}

function formatTime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function TaggerTab() {
  const { state, dispatch } = useStore()
  const scrubRef = useRef(null)

  const seqDur = state.sequence?.duration || 600

  function addMark(tag) {
    dispatch(actions.addMark({
      time: state.currentTime,
      tag,
      memePath: null,
      duration: state.settings.defaultMemeDuration || 2
    }))
    dispatch(actions.setToast({ msg: `📌 ${tag.toUpperCase()} @ ${formatTime(state.currentTime)}` }))
  }

  function togglePlay() {
    state.isPlaying ? pauseSequence() : playSequence()
  }

  function scrubClick(e) {
    const rect = scrubRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    setPlayerPosition(pct * seqDur)
  }

  function skip(delta) { setPlayerPosition(Math.max(0, state.currentTime + delta)) }

  function seekToMark(time) { setPlayerPosition(time) }

  async function insertMark(mark) {
    if (!mark.memePath) {
      dispatch(actions.setToast({ msg: 'Assign a meme first (click 🎭)', error: true }))
      return
    }
    try {
      dispatch(actions.setProgress({ task: 'insert', status: 'Inserting meme…', pct: 30 }))
      const res = await importAndInsertMedia(mark.memePath, mark.time, mark.duration, 1, 0)
      if (res?.success) {
        dispatch(actions.setToast({ msg: `✅ Meme inserted at ${formatTime(mark.time)}` }))
      } else {
        dispatch(actions.setToast({ msg: res?.error || 'Insert failed', error: true }))
      }
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function insertAllMarks() {
    const toInsert = state.marks.filter(m => m.memePath)
    if (!toInsert.length) {
      dispatch(actions.setToast({ msg: 'No memes assigned yet!', error: true })); return
    }
    dispatch(actions.setProgress({ task: 'insert_all', status: 'Inserting all memes…', pct: 10 }))
    for (let i = 0; i < toInsert.length; i++) {
      const m = toInsert[i]
      await importAndInsertMedia(m.memePath, m.time, m.duration, 1, 0)
      dispatch(actions.setProgress({ task: 'insert_all', status: `Inserted ${i+1}/${toInsert.length}…`, pct: Math.round(((i+1)/toInsert.length)*100) }))
    }
    dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    dispatch(actions.setToast({ msg: `✅ Inserted ${toInsert.length} memes!` }))
  }

  async function addAllMarkersToTimeline() {
    for (const m of state.marks) {
      const cfg = TAG_CONFIG[m.tag]
      await addMarker(m.time, m.tag, `MemeCut: ${m.tag}`, cfg?.marker || 0)
    }
    dispatch(actions.setToast({ msg: `🔖 Added ${state.marks.length} markers` }))
  }

  function openBrowserForMark(markId) {
    dispatch(actions.setMemeForMark(markId))
    dispatch(actions.setTab('memes'))
    dispatch(actions.setToast({ msg: '👆 Click a meme to assign it' }))
  }

  const scrubPct = seqDur > 0 ? Math.min(100, (state.currentTime / seqDur) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Player ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-surface border-b border-border p-3">
        {/* Timecode */}
        <div className="font-display text-4xl text-accent tracking-widest text-center mb-2">
          {formatTime(state.currentTime)}
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center mb-2">
          <Btn onClick={() => skip(-10)}>⏮ 10s</Btn>
          <Btn onClick={() => skip(-1)}>◀ 1s</Btn>
          <Btn primary onClick={togglePlay}>{state.isPlaying ? '⏸ PAUSE' : '▶ PLAY'}</Btn>
          <Btn onClick={() => skip(1)}>1s ▶</Btn>
          <Btn onClick={() => skip(10)}>10s ⏭</Btn>
        </div>

        {/* Scrubber */}
        <div ref={scrubRef} onClick={scrubClick}
          className="relative h-5 bg-surface2 border border-border rounded cursor-pointer overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent to-yellow-300 rounded pointer-events-none transition-all"
            style={{ width: `${scrubPct}%` }} />
          {/* Blips */}
          {state.marks.map(m => (
            <div key={m.id} className="absolute top-0 bottom-0 w-0.5 pointer-events-none opacity-80"
              style={{ left: `${seqDur > 0 ? (m.time/seqDur)*100 : 0}%`,
                background: TAG_CONFIG[m.tag]?.color || '#fff' }} />
          ))}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-4 bg-white rounded-sm pointer-events-none"
            style={{ left: `${scrubPct}%` }} />
        </div>
      </div>

      {/* ── Tag Buttons ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3 border-b border-border">
        <div className="text-[9px] text-muted uppercase tracking-widest mb-2">
          ⚡ Tag this moment (hotkeys shown)
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(TAG_CONFIG).map(([tag, cfg]) => (
            <button key={tag} onClick={() => addMark(tag)}
              className="flex flex-col items-center py-2 border-2 rounded text-center transition-all hover:opacity-80 active:scale-95"
              style={{ borderColor: cfg.color, color: cfg.color }}>
              <span className="text-lg leading-none">{cfg.emoji}</span>
              <span className="font-display text-[11px] tracking-wide mt-0.5">{tag.toUpperCase()}</span>
              <span className="text-[8px] opacity-40">[{cfg.key}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Marks List ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[9px] text-muted uppercase tracking-widest">
          📌 Marks ({state.marks.length})
        </span>
        <div className="flex gap-2">
          <Btn small onClick={addAllMarkersToTimeline}>🔖 Add Markers</Btn>
          <Btn small primary onClick={insertAllMarks}>✅ Insert All</Btn>
          <Btn small onClick={() => { if(confirm('Clear all marks?')) dispatch(actions.clearMarks()) }}>✕ Clear</Btn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {state.marks.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <div className="font-display text-3xl text-border mb-2">😶</div>
            Play video and tag moments.<br/>Hotkeys: F A S W C H Q R V N U M
          </div>
        ) : state.marks.map(mark => {
          const cfg = TAG_CONFIG[mark.tag] || {}
          const memeName = mark.memePath ? mark.memePath.split(/[/\\]/).pop() : '— no meme'
          return (
            <div key={mark.id}
              className="flex items-center gap-2 p-2 bg-surface border border-border rounded hover:border-accent/50 transition-colors">
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: cfg.color || '#fff' }} />
              <button className="font-display text-sm w-14 text-left flex-shrink-0 hover:text-accent transition-colors"
                style={{ color: cfg.color }} onClick={() => seekToMark(mark.time)}>
                {formatTime(mark.time)}
              </button>
              <span className="font-display text-xs w-16 flex-shrink-0" style={{ color: cfg.color }}>
                {mark.tag.toUpperCase()}
              </span>
              <span className={`flex-1 text-[9px] truncate ${mark.memePath ? 'text-white' : 'text-muted'}`}
                title={mark.memePath || ''}>
                {memeName}
              </span>
              <input type="number" value={mark.duration} min={0.5} max={30} step={0.5}
                onChange={e => dispatch(actions.updateMark({ id: mark.id, duration: parseFloat(e.target.value) }))}
                className="w-10 bg-surface2 border border-border text-white text-[9px] px-1 py-0.5 rounded text-center" />
              <span className="text-[8px] text-muted">s</span>
              <button onClick={() => openBrowserForMark(mark.id)}
                className="opacity-60 hover:opacity-100 transition-opacity text-sm" title="Pick meme">🎭</button>
              <button onClick={() => insertMark(mark)}
                className="opacity-60 hover:opacity-100 transition-opacity text-sm" title="Insert now">➕</button>
              <button onClick={() => dispatch(actions.removeMark(mark.id))}
                className="opacity-40 hover:opacity-100 transition-opacity text-xs text-accent2">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Btn({ children, onClick, primary, small }) {
  return (
    <button onClick={onClick}
      className={`border rounded font-mono transition-all active:scale-95
        ${small ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-3 py-1.5'}
        ${primary
          ? 'bg-accent text-black border-accent hover:bg-yellow-300 font-bold'
          : 'bg-surface2 text-white border-border hover:bg-border'}`}>
      {children}
    </button>
  )
}
