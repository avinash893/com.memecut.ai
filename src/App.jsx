// MemeCut AI - Main App Component v1.2
// FIXED: Full error logging on timeline polling, video detection, and backend calls.
//        Added Debug Console panel accessible from Settings tab.
import { useEffect, useRef, useState, useCallback } from 'react'
import { StoreProvider, useStore, actions } from './store/index.jsx'
import { connectWS, getSequenceInfo, getCurrentTime, isPlaying as checkPlaying,
         exportSequence, cepLog, resolveMediaPath } from './utils/cep.js'

// Tab components
import TaggerTab    from './components/TaggerTab.jsx'
import MemeTab      from './components/MemeTab.jsx'
import AITab        from './components/AITab.jsx'
import CaptionsTab  from './components/CaptionsTab.jsx'
import ShortsTab    from './components/ShortsTab.jsx'
import SettingsTab  from './components/SettingsTab.jsx'

const TABS = [
  { id: 'tagger',   icon: '🎬', label: 'TAG' },
  { id: 'memes',    icon: '🎭', label: 'MEMES' },
  { id: 'ai',       icon: '🤖', label: 'AI' },
  { id: 'captions', icon: '💬', label: 'CAPTIONS' },
  { id: 'shorts',   icon: '📱', label: 'SHORTS' },
  { id: 'settings', icon: '⚙️', label: 'SETTINGS' },
  { id: 'export',   icon: '🚀', label: 'EXPORT' },
  { id: 'debug',    icon: '🐛', label: 'DEBUG' },
]

function AppInner() {
  const { state, dispatch } = useStore()
  const pollingRef = useRef(null)
  const toastRef   = useRef(null)
  const pollErrRef = useRef(0) // consecutive poll error counter

  // ── Init sequence + polling ─────────────────────────────────────────────
  useEffect(() => {
    cepLog('info', '🚀 MemeCut AI initialising…')
    refreshSequence()
    pollingRef.current = setInterval(pollPremiere, 1000)

    // WebSocket for backend progress
    connectWS((msg) => {
      if (msg.type === 'progress') dispatch(actions.setProgress(msg.payload))
    })

    // Hotkeys
    window.addEventListener('keydown', handleHotkey)
    return () => {
      clearInterval(pollingRef.current)
      window.removeEventListener('keydown', handleHotkey)
    }
  }, [])

  // Auto-clear toast
  useEffect(() => {
    if (state.toast) {
      clearTimeout(toastRef.current)
      toastRef.current = setTimeout(() => dispatch(actions.setToast(null)), 2800)
    }
  }, [state.toast])

  async function refreshSequence(retryCount = 0) {
    cepLog('info', `refreshSequence: attempt ${retryCount + 1}…`)
    try {
      const seq = await getSequenceInfo()
      cepLog('info', 'getSequenceInfo result:', seq)

      if (seq && !seq.error) {
        dispatch(actions.setSequence(seq))
        cepLog('info', `✅ Sequence loaded: "${seq.name}" ${seq.width}×${seq.height} ${seq.duration?.toFixed(1)}s`)
        return // success
      }

      if (seq?.error) {
        cepLog('warn', 'getSequenceInfo returned error:', seq.error)
      } else {
        cepLog('warn', 'getSequenceInfo: returned null — CSInterface not ready yet or no active sequence')
      }
    } catch (e) {
      cepLog('error', 'refreshSequence threw:', e.message)
    }

    // Retry up to 8 times with increasing delay (covers slow Premiere startup)
    if (retryCount < 8) {
      const delay = Math.min(500 * (retryCount + 1), 3000)
      cepLog('info', `refreshSequence: retrying in ${delay}ms (attempt ${retryCount + 2}/9)…`)
      setTimeout(() => refreshSequence(retryCount + 1), delay)
    } else {
      cepLog('error', 'refreshSequence: ❌ gave up after 9 attempts.',
        'Possible causes:',
        '(1) No sequence is open in Premiere — open a project with a sequence.',
        '(2) CSInterface.js is missing — check index.html and rebuild.',
        '(3) Extension was not reinstalled after last build.'
      )
    }
  }

  async function pollPremiere() {
    try {
      const t = await getCurrentTime()
      dispatch(actions.setTime(t))
      const playing = await checkPlaying()
      dispatch(actions.setPlaying(playing))
      pollErrRef.current = 0 // reset error streak
    } catch (e) {
      pollErrRef.current++
      // Only log every 20 consecutive failures to avoid flooding
      if (pollErrRef.current === 1 || pollErrRef.current % 20 === 0) {
        cepLog('warn', `pollPremiere failed (${pollErrRef.current}× in a row):`, e.message)
      }
    }
  }

  function handleHotkey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
    const map = { f:'funny', a:'angry', s:'sad', w:'surprised', c:'cringe', h:'hype',
                  q:'fail', r:'rage', v:'victory', n:'confusion', u:'sus', m:'emotional' }
    const k = e.key.toLowerCase()
    if (map[k] && state.activeTab === 'tagger') {
      dispatch(actions.addMark({ time: state.currentTime, tag: map[k], memePath: null, duration: state.settings.defaultMemeDuration }))
      showToast(`📌 ${map[k].toUpperCase()} @ ${formatTime(state.currentTime)}`)
    }
    if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dispatch(actions.undoMark()) }
  }

  function showToast(msg, error = false) {
    dispatch(actions.setToast({ msg, error }))
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b-2 border-accent flex-shrink-0">
        <div className="font-display text-2xl tracking-widest text-accent">
          MEME<span className="text-accent2">CUT</span> <span className="text-base">AI</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Video detection status badge */}
          <VideoStatusBadge />
          <div className="text-right text-[9px] text-muted leading-5">
            <div className="text-white font-bold">{state.sequence?.name || 'No Sequence'}</div>
            <div>{state.sequence ? `${state.sequence.width}×${state.sequence.height}` : '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      {state.progress.pct > 0 && state.progress.pct < 100 && (
        <div className="flex-shrink-0 bg-surface border-b border-border px-3 py-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted">{state.progress.status}</span>
            <span className="text-[9px] text-accent font-bold">{state.progress.pct}%</span>
          </div>
          <div className="h-1 bg-surface2 rounded overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300 rounded"
              style={{ width: `${state.progress.pct}%` }} />
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex bg-surface border-b border-border flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id}
            onClick={() => dispatch(actions.setTab(tab.id))}
            className={`flex-1 py-2 px-1 font-display text-[11px] tracking-wider transition-all border-b-2 whitespace-nowrap
              ${state.activeTab === tab.id
                ? 'text-accent border-accent'
                : 'text-muted border-transparent hover:text-white'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {state.activeTab === 'tagger'   && <TaggerTab />}
        {state.activeTab === 'memes'    && <MemeTab />}
        {state.activeTab === 'ai'       && <AITab />}
        {state.activeTab === 'captions' && <CaptionsTab />}
        {state.activeTab === 'shorts'   && <ShortsTab />}
        {state.activeTab === 'settings' && <SettingsTab />}
        {state.activeTab === 'export'   && <ExportTab />}
        {state.activeTab === 'debug'    && <DebugConsole onRefreshSeq={refreshSequence} />}
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {state.toast && (
        <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-50
          font-display text-sm tracking-wider px-4 py-2 rounded transition-all
          ${state.toast.error ? 'bg-accent2 text-white' : 'bg-accent text-black'}`}>
          {state.toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── VIDEO STATUS BADGE ────────────────────────────────────────────────────

function VideoStatusBadge() {
  const { state } = useStore()
  const [clipInfo, setClipInfo] = useState(null)
  const [checking, setChecking] = useState(false)

  // Re-check whenever playhead time changes (debounced by ~500ms)
  const timerRef = useRef(null)
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const clip = await resolveMediaPath()
        setClipInfo(clip)
      } catch {
        setClipInfo(null)
      }
    }, 500)
  }, [state.currentTime])

  if (!state.sequence) return null

  return (
    <div
      title={clipInfo ? `Clip: ${clipInfo.name}\n${clipInfo.mediaPath}` : 'No clip under playhead'}
      className={`text-[8px] px-1.5 py-0.5 rounded font-mono border ${
        clipInfo
          ? 'border-green-500/50 text-green-400 bg-green-500/10'
          : 'border-red-500/40 text-red-400 bg-red-500/10'
      }`}>
      {clipInfo ? `🎬 ${clipInfo.name?.slice(0,12) || 'clip'}` : '⚠ no clip'}
    </div>
  )
}

// ─── DEBUG CONSOLE ──────────────────────────────────────────────────────────

function DebugConsole({ onRefreshSeq }) {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all')
  const [testResult, setTestResult] = useState(null)
  const bottomRef = useRef(null)
  const { state } = useStore()

  // Sync from global log buffer on mount + listen for new entries
  useEffect(() => {
    setLogs([...(window.__memecutLog || [])])
    const handler = () => setLogs([...(window.__memecutLog || [])])
    window.addEventListener('memecut-log', handler)
    return () => window.removeEventListener('memecut-log', handler)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  async function testVideoFetch() {
    setTestResult(null)
    cepLog('info', '--- VIDEO FETCH TEST START ---')
    try {
      const clip = await resolveMediaPath()
      setTestResult({ ok: true, clip })
      cepLog('info', '--- VIDEO FETCH TEST ✅ PASSED ---', clip)
    } catch (e) {
      setTestResult({ ok: false, error: e.message })
      cepLog('error', '--- VIDEO FETCH TEST ❌ FAILED ---', e.message)
    }
  }

  async function testBackend() {
    cepLog('info', '--- BACKEND PING TEST ---')
    try {
      const res = await fetch('http://127.0.0.1:3001/api/settings')
      if (res.ok) cepLog('info', '✅ Backend reachable, status', res.status)
      else cepLog('error', '❌ Backend returned', res.status)
    } catch (e) {
      cepLog('error', '❌ Backend unreachable:', e.message, '— run start-backend.bat')
    }
  }

  const levelColor = { error: 'text-red-400', warn: 'text-yellow-400', info: 'text-green-300', debug: 'text-blue-300' }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-2 bg-surface border-b border-border flex-shrink-0 flex-wrap">
        <span className="font-display text-accent text-xs tracking-wider">🐛 DEBUG</span>
        <div className="flex gap-1 ml-1">
          {['all','info','warn','error','debug'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[9px] px-1.5 py-0.5 rounded border font-mono transition-all
                ${filter === f ? 'bg-accent text-black border-accent' : 'border-border text-muted hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={testVideoFetch}
            className="text-[9px] px-2 py-0.5 bg-surface2 border border-border text-white rounded hover:bg-border">
            🎬 Test Video Fetch
          </button>
          <button onClick={testBackend}
            className="text-[9px] px-2 py-0.5 bg-surface2 border border-border text-white rounded hover:bg-border">
            🔌 Test Backend
          </button>
          <button onClick={onRefreshSeq}
            className="text-[9px] px-2 py-0.5 bg-surface2 border border-border text-white rounded hover:bg-border">
            🔄 Re-fetch Seq
          </button>
          <button onClick={() => { window.__memecutLog = []; setLogs([]) }}
            className="text-[9px] px-2 py-0.5 bg-surface2 border border-red-900 text-red-400 rounded hover:bg-red-900/30">
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Test result banner */}
      {testResult && (
        <div className={`flex-shrink-0 px-3 py-2 text-[9px] font-mono border-b ${
          testResult.ok ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
          {testResult.ok
            ? `✅ Video found: ${testResult.clip.name} | ${testResult.clip.mediaPath}`
            : `❌ ${testResult.error}`}
        </div>
      )}

      {/* State summary */}
      <div className="flex-shrink-0 px-3 py-1.5 bg-surface border-b border-border text-[8px] font-mono text-muted flex gap-4 flex-wrap">
        <span>CSInterface: <span className={typeof CSInterface !== 'undefined' ? 'text-green-400' : 'text-red-400 font-bold'}>{typeof CSInterface !== 'undefined' ? '✅ loaded' : '❌ MISSING'}</span></span>
        <span>Sequence: <span className={state.sequence ? 'text-green-400' : 'text-red-400'}>{state.sequence?.name || 'NONE'}</span></span>
        <span>Time: <span className="text-white">{state.currentTime?.toFixed(2)}s</span></span>
        <span>Playing: <span className={state.isPlaying ? 'text-green-400' : 'text-muted'}>{state.isPlaying ? 'YES' : 'no'}</span></span>
        <span>Marks: <span className="text-white">{state.marks.length}</span></span>
        <span>Transcript: <span className={state.transcript ? 'text-green-400' : 'text-muted'}>{state.transcript ? `${state.transcript.length}c` : 'none'}</span></span>
        <span>Log entries: <span className="text-white">{logs.length}</span></span>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[9px] space-y-0.5">
        {filtered.length === 0 && (
          <div className="text-center text-muted py-8">No log entries yet.<br/>Use the test buttons above to diagnose issues.</div>
        )}
        {filtered.map((entry, i) => (
          <div key={i} className="flex gap-1.5 leading-4">
            <span className="text-muted shrink-0">{entry.ts}</span>
            <span className={`shrink-0 w-10 ${levelColor[entry.level] || 'text-white'}`}>{entry.level}</span>
            <span className="text-gray-200 break-all">{entry.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─── EXPORT TAB ────────────────────────────────────────────────────────────

function ExportTab() {
  const { state, dispatch } = useStore()
  async function doExport() {
    try {
      dispatch(actions.setToast({ msg: '🚀 Opening export dialog…' }))
      cepLog('info', 'ExportTab: calling exportSequence()')
      const res = await exportSequence()
      cepLog('info', 'exportSequence result:', res)
      if (res?.error) throw new Error(res.error)
    } catch(e) {
      cepLog('error', 'ExportTab error:', e.message)
      dispatch(actions.setToast({ msg: e.message, error: true }))
    }
  }
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="font-display text-lg text-accent tracking-wider">🚀 EXPORT</div>
      <p className="text-[9px] text-muted leading-5">
        Exports the full active sequence to Adobe Media Encoder.
        For clip exports (Shorts), use the Shorts tab → Export Clip on each viral moment.
      </p>
      <button onClick={doExport}
        className="w-full bg-accent text-black font-display font-bold py-2.5 rounded text-sm tracking-wider hover:bg-yellow-300 transition-colors">
        🚀 Export Full Sequence
      </button>
      {state.viralMoments?.length > 0 && (
        <div className="border border-border rounded p-3 bg-surface">
          <div className="text-[9px] text-muted uppercase tracking-widest mb-2">Clip Exports from Shorts</div>
          <p className="text-[9px] text-muted leading-5">
            Go to the <span className="text-accent font-bold">SHORTS tab</span> → click
            <span className="text-hype font-bold"> 🚀 Export Clip</span> next to any viral moment.
            This sets the sequence in/out points automatically and opens the export dialog.
          </p>
        </div>
      )}
    </div>
  )
}

function formatTime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function App() {
  return <StoreProvider><AppInner /></StoreProvider>
}
