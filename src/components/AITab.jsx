// MemeCut AI - AI Tab v1.2
// FIXED: Added cepLog import, proper error logging in refreshActiveClip and all helpers.

import { useState } from 'react'
import { useStore, actions } from '../store/index.jsx'
import { api, rippleDeleteRange, addZoomKeyframes, resolveAudioPath, resolveMediaPath,
         exportSequence, setInOutFromRange, cepLog } from '../utils/cep.js'

export default function AITab() {
  const { state, dispatch } = useStore()
  const [activeSection, setActiveSection] = useState(null)
  // activeClipInfo: shown in header so user can see what clip is detected
  const [activeClipInfo, setActiveClipInfo] = useState(null)

  // ── HELPERS ────────────────────────────────────────────────────────────────

  /**
   * getVideoPath()
   * Resolves the media path from the active timeline clip.
   * Shows a clear error if the playhead isn't over a clip.
   */
  async function getVideoPath() {
    try {
      const clip = await resolveMediaPath()
      setActiveClipInfo(clip)
      return clip.mediaPath
    } catch(e) {
      dispatch(actions.setToast({ msg: '⚠️ ' + e.message, error: true }))
      return null
    }
  }

  async function getAudioPath() {
    try {
      const clip = await resolveAudioPath()
      setActiveClipInfo(clip)
      return clip.mediaPath
    } catch(e) {
      dispatch(actions.setToast({ msg: '⚠️ ' + e.message, error: true }))
      return null
    }
  }

  // Refresh the active clip display
  async function refreshActiveClip() {
    cepLog('info', 'AITab: refreshActiveClip called')
    try {
      const clip = await resolveMediaPath()
      setActiveClipInfo(clip)
    } catch(e) {
      cepLog('warn', 'AITab: refreshActiveClip — no clip detected:', e.message)
      setActiveClipInfo(null)
    }
  }

  // ── AI ACTIONS ─────────────────────────────────────────────────────────────

  async function runTranscribe() {
    const videoPath = await getVideoPath()
    if (!videoPath) return
    try {
      dispatch(actions.setProgress({ task: 'transcribe', status: 'Starting transcription…', pct: 5 }))
      const res = await api('/gemini/transcribe', 'POST', { videoPath })
      if (!res.ok) throw new Error(res.error)
      dispatch(actions.setTranscript({
        transcript: res.transcript.segments?.map(s => s.text).join(' ') || '',
        words: res.transcript.words || [],
        segments: res.transcript.segments || []
      }))
      dispatch(actions.setToast({ msg: `✅ Transcribed ${res.transcript.words?.length || 0} words` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function runEmotions() {
    if (!state.segments?.length) { dispatch(actions.setToast({ msg: 'Transcribe first!', error: true })); return }
    try {
      dispatch(actions.setProgress({ task: 'emotions', status: 'Detecting emotions…', pct: 10 }))
      const res = await api('/gemini/emotions', 'POST', { transcript: state.transcript, segments: state.segments })
      if (!res.ok) throw new Error(res.error)
      dispatch(actions.setEmotions(res.moments || []))
      res.moments?.forEach(m => {
        dispatch(actions.addMark({ time: m.time, tag: m.emotion, memePath: null,
          duration: state.settings.defaultMemeDuration || 2 }))
      })
      dispatch(actions.setToast({ msg: `✅ Found ${res.moments?.length || 0} emotional moments → auto-marked!` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function runSilenceRemoval() {
    const audioPath = await getAudioPath()
    if (!audioPath) return
    const threshold   = state.settings.silenceThreshold || -40
    const minDuration = state.settings.minSilenceDuration || 0.5
    const padding     = state.settings.silencePadding || 0.1
    try {
      dispatch(actions.setProgress({ task: 'silences', status: 'Detecting silences with FFmpeg…', pct: 10 }))
      const res = await api('/ffmpeg/silences', 'POST', { videoPath: audioPath, threshold, minDuration })
      if (!res.ok) throw new Error(res.error)
      dispatch(actions.setSilences(res.silences))
      dispatch(actions.setProgress({ task: 'silences', status: `Found ${res.silences.length} silences. Cutting timeline…`, pct: 60 }))

      // Apply ripple deletes in REVERSE order (descending start time) so timeline offsets don't break subsequent cuts
      const sortedSilences = [...res.silences].sort((a, b) => b.start - a.start)
      for (const s of sortedSilences) {
        const cutStart = s.start + padding
        const cutEnd   = s.end   - padding
        if (cutEnd > cutStart) {
          await rippleDeleteRange(cutStart, cutEnd, 0)
        }
      }
      dispatch(actions.setToast({ msg: `✅ Removed ${res.silences.length} silences from timeline` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function runFillerWords() {
    if (!state.words?.length) { dispatch(actions.setToast({ msg: 'Transcribe first!', error: true })); return }
    try {
      dispatch(actions.setProgress({ task: 'fillers', status: 'Finding filler words…', pct: 30 }))
      const fillers = (state.words || []).filter(w =>
        ['um','uh','like','basically','literally','you know','kind of','sort of','i mean','actually']
        .includes(w.word?.toLowerCase().replace(/[.,!?]/g,''))
      )
      dispatch(actions.setProgress({ task: 'fillers', status: `Removing ${fillers.length} filler words from timeline…`, pct: 60 }))
      // Reverse order to avoid offset shift
      const sorted = [...fillers].sort((a,b) => b.start - a.start)
      for (const fw of sorted) {
        await rippleDeleteRange(fw.start, fw.end, 0)
      }
      dispatch(actions.setToast({ msg: `✅ Removed ${fillers.length} filler words from timeline` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function runAutoZooms() {
    if (!state.emotions?.length) { dispatch(actions.setToast({ msg: 'Run emotion detection first!', error: true })); return }
    const zoomAmount = state.settings.defaultZoomAmount || 1.15
    let count = 0
    for (const e of state.emotions) {
      if (e.confidence > 0.7) {
        await addZoomKeyframes(e.time - 1, e.time, e.end_time || e.time + 1, 0, zoomAmount)
        count++
      }
    }
    dispatch(actions.setToast({ msg: `✅ Added ${count} auto zooms to timeline` }))
  }

  async function runRepetitions() {
    if (!state.segments?.length) { dispatch(actions.setToast({ msg: 'Transcribe first!', error: true })); return }
    try {
      dispatch(actions.setProgress({ task: 'reps', status: 'Finding repetitions…', pct: 20 }))
      const res = await api('/gemini/repetitions', 'POST', { segments: state.segments })
      if (!res.ok) throw new Error(res.error)
      dispatch(actions.setRepetitions(res.repetitions || []))
      dispatch(actions.setToast({ msg: `✅ Found ${res.repetitions?.length || 0} repetitions — review below` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function deleteRepetition(r) {
    const dup = r.duplicate
    if (!dup) return
    await rippleDeleteRange(dup.start, dup.end, 0)
    dispatch(actions.setRepetitions(state.repetitions.filter(x => x !== r)))
    dispatch(actions.setToast({ msg: '✅ Removed duplicate from timeline' }))
  }

  async function runChapters() {
    if (!state.transcript) { dispatch(actions.setToast({ msg: 'Transcribe first!', error: true })); return }
    try {
      dispatch(actions.setProgress({ task: 'chapters', status: 'Generating chapters…', pct: 20 }))
      const dur = state.sequence?.duration || 600
      const res = await api('/gemini/chapters', 'POST', { transcript: state.transcript, duration: dur })
      if (!res.ok) throw new Error(res.error)
      dispatch(actions.setChapters(res.chapters || []))
      dispatch(actions.setToast({ msg: `✅ Generated ${res.chapters?.length || 0} chapters` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function exportChaptersYT() {
    const res = await api('/captions/export-youtube', 'POST', { chapters: state.chapters })
    if (res.ok) {
      navigator.clipboard.writeText(res.text).catch(() => {})
      dispatch(actions.setToast({ msg: '📋 YouTube chapters copied to clipboard!' }))
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────

  async function handleExport() {
    try {
      dispatch(actions.setToast({ msg: '🚀 Opening export dialog…' }))
      const res = await exportSequence()
      if (res?.error) throw new Error(res.error)
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const Section = ({ id, title, children }) => (
    <div className="border border-border rounded mb-2 overflow-hidden">
      <button onClick={() => setActiveSection(activeSection === id ? null : id)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface hover:bg-surface2 transition-colors text-left">
        <span className="font-display text-sm tracking-wider text-accent">{title}</span>
        <span className="text-muted text-xs">{activeSection === id ? '▲' : '▼'}</span>
      </button>
      {activeSection === id && <div className="p-3 border-t border-border bg-bg">{children}</div>}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── ACTIVE CLIP INDICATOR (replaces file picker) ── */}
      <div className="flex-shrink-0 p-3 bg-surface border-b border-border">

        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted uppercase tracking-widest">Active Timeline Clip</span>
          <button onClick={refreshActiveClip}
            className="text-[9px] text-accent hover:underline">↻ Refresh</button>
        </div>

        {activeClipInfo ? (
          <div className="bg-surface2 border border-border rounded px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-hype">●</span>
              <span className="text-[10px] text-white truncate flex-1 font-mono">
                {activeClipInfo.name || activeClipInfo.mediaPath?.split(/[/\\]/).pop()}
              </span>
              <span className="text-[8px] text-muted flex-shrink-0">
                {formatTime(activeClipInfo.start)}→{formatTime(activeClipInfo.end)}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-surface2 border border-dashed border-border rounded px-2 py-2 text-center">
            <div className="text-[9px] text-muted leading-5">
              📍 Place your playhead over a clip on the timeline,<br/>
              then click ↻ Refresh — or just run any action below.
            </div>
          </div>
        )}

        {!state.settings.geminiApiKey && (
          <div className="mt-2 text-[9px] text-accent2 bg-accent2/10 border border-accent2/30 rounded px-2 py-1.5">
            ⚠ Set your Gemini API key in Settings tab first!
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">

        <Section id="transcribe" title="🎙 TRANSCRIBE (Required for most AI features)">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Uses Gemini to transcribe the clip under your playhead with word-level timestamps.
            Required before silence removal, emotion detection, or captions.
          </p>
          <Btn primary onClick={runTranscribe}>▶ Run Transcription</Btn>
          {state.words?.length > 0 && (
            <div className="mt-2 text-[9px] text-hype">
              ✅ {state.words.length} words · {state.segments?.length} segments transcribed
            </div>
          )}
        </Section>

        <Section id="silences" title="✂️ REMOVE SILENCES">
          <div className="space-y-2 mb-3">
            <label className="flex items-center justify-between text-[9px] text-muted">
              Silence threshold (dB)
              <input type="number" value={state.settings.silenceThreshold} min={-80} max={-10}
                onChange={e => dispatch(actions.setSettings({ silenceThreshold: parseFloat(e.target.value) }))}
                className="w-16 bg-surface2 border border-border text-white px-1 py-0.5 rounded text-[9px] text-center" />
            </label>
            <label className="flex items-center justify-between text-[9px] text-muted">
              Min silence duration (s)
              <input type="number" value={state.settings.minSilenceDuration} min={0.1} max={5} step={0.1}
                onChange={e => dispatch(actions.setSettings({ minSilenceDuration: parseFloat(e.target.value) }))}
                className="w-16 bg-surface2 border border-border text-white px-1 py-0.5 rounded text-[9px] text-center" />
            </label>
            <label className="flex items-center justify-between text-[9px] text-muted">
              Padding before/after (s)
              <input type="number" value={state.settings.silencePadding} min={0} max={1} step={0.05}
                onChange={e => dispatch(actions.setSettings({ silencePadding: parseFloat(e.target.value) }))}
                className="w-16 bg-surface2 border border-border text-white px-1 py-0.5 rounded text-[9px] text-center" />
            </label>
          </div>
          <Btn primary onClick={runSilenceRemoval}>✂️ Detect & Remove Silences</Btn>
          {state.silences?.length > 0 && (
            <div className="mt-2 text-[9px] text-muted">Removed {state.silences.length} silences last run</div>
          )}
        </Section>

        <Section id="fillers" title="🗣 REMOVE FILLER WORDS">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Removes: um, uh, like, basically, literally, you know, kind of, sort of, i mean, actually.
            Transcribe first for accurate word timestamps.
          </p>
          <Btn primary onClick={runFillerWords}>✂️ Remove Filler Words</Btn>
        </Section>

        <Section id="emotions" title="😱 EMOTION DETECTION + AUTO MARKS">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Gemini analyzes transcript and finds emotional peaks. Auto-creates marks in the TAG tab.
          </p>
          <Btn primary onClick={runEmotions}>🤖 Detect Emotions</Btn>
          {state.emotions?.length > 0 && (
            <div className="mt-2 space-y-1">
              {state.emotions.slice(0,5).map((e,i) => (
                <div key={i} className="flex items-center gap-2 text-[9px]">
                  <span className="text-accent font-display">{formatTime(e.time)}</span>
                  <span className="text-white">{e.emotion.toUpperCase()}</span>
                  <span className="text-muted truncate flex-1">{e.text?.slice(0,40)}</span>
                  <span className="text-muted">{Math.round(e.confidence*100)}%</span>
                </div>
              ))}
              {state.emotions.length > 5 && <div className="text-[9px] text-muted">+{state.emotions.length - 5} more…</div>}
            </div>
          )}
        </Section>

        <Section id="zooms" title="🔍 AUTO ZOOMS">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Adds punch zoom keyframes at emotional peaks on the timeline. Run emotion detection first.
          </p>
          <label className="flex items-center justify-between text-[9px] text-muted mb-3">
            Zoom amount (1.0–2.0)
            <input type="number" value={state.settings.defaultZoomAmount} min={1} max={2} step={0.05}
              onChange={e => dispatch(actions.setSettings({ defaultZoomAmount: parseFloat(e.target.value) }))}
              className="w-16 bg-surface2 border border-border text-white px-1 py-0.5 rounded text-[9px] text-center" />
          </label>
          <Btn primary onClick={runAutoZooms}>🔍 Apply Auto Zooms to Timeline</Btn>
        </Section>

        <Section id="repetitions" title="🔄 REMOVE REPETITIONS">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Detects repeated takes and duplicate sentences. Review before applying cuts.
          </p>
          <Btn primary onClick={runRepetitions}>🤖 Find Repetitions</Btn>
          {state.repetitions?.length > 0 && (
            <div className="mt-3 space-y-2">
              {state.repetitions.map((r,i) => (
                <div key={i} className="border border-border rounded p-2 text-[9px]">
                  <div className="flex justify-between mb-1">
                    <span className="text-accent">Original: {formatTime(r.first_occurrence?.start)}</span>
                    <span className="text-accent2">Dupe: {formatTime(r.duplicate?.start)}</span>
                    <span className="text-muted">{Math.round((r.similarity||0)*100)}% match</span>
                  </div>
                  <div className="text-muted truncate mb-2">{r.first_occurrence?.text?.slice(0,60)}</div>
                  <Btn onClick={() => deleteRepetition(r)}>🗑 Remove Duplicate from Timeline</Btn>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section id="chapters" title="📚 AUTO CHAPTERS">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Generates YouTube chapter timestamps from your transcript.
          </p>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Btn primary onClick={runChapters}>🤖 Generate Chapters</Btn>
            {state.chapters?.length > 0 && <Btn onClick={exportChaptersYT}>📋 Copy for YouTube</Btn>}
          </div>
          {state.chapters?.length > 0 && (
            <div className="space-y-1">
              {state.chapters.map((c,i) => (
                <div key={i} className="flex items-center gap-2 text-[9px]">
                  <span className="text-accent font-display w-12">{formatTime(c.time)}</span>
                  <span className="text-white">{c.title}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── EXPORT SECTION ── */}
        <Section id="export" title="🚀 EXPORT">
          <p className="text-[9px] text-muted mb-3 leading-5">
            Export your edited sequence directly from Premiere.
            Opens Adobe Media Encoder with your sequence ready to render.
          </p>
          <Btn primary onClick={handleExport}>🚀 Export Sequence</Btn>
          <p className="text-[9px] text-muted mt-2 leading-5">
            To export a specific short: go to the Shorts tab → select a viral moment → Export Clip.
          </p>
        </Section>

      </div>
    </div>
  )
}

function formatTime(sec) {
  if (!sec && sec !== 0) return '—'
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function Btn({ children, onClick, primary }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] px-3 py-1.5 border rounded font-mono transition-all active:scale-95
        ${primary ? 'bg-accent text-black border-accent hover:bg-yellow-300 font-bold'
                  : 'bg-surface2 text-white border-border hover:bg-border'}`}>
      {children}
    </button>
  )
}
