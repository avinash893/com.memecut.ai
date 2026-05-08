// MemeCut AI - Shorts Tab v1.1
// KEY CHANGE: Removed file picker. Uses active timeline clip + in/out export.
import { useState } from 'react'
import { useStore, actions } from '../store/index.jsx'
import { api, exportSequence, setInOutFromRange, clearInOut, resolveMediaPath } from '../utils/cep.js'

export default function ShortsTab() {
  const { state, dispatch } = useStore()
  const [results, setResults]         = useState(null)
  const [exportingIdx, setExportingIdx] = useState(null)

  async function analyzeForShorts() {
    if (!state.transcript) {
      dispatch(actions.setToast({ msg: 'Transcribe video in AI tab first!', error: true })); return
    }
    try {
      dispatch(actions.setProgress({ task: 'shorts', status: 'Finding viral moments…', pct: 15 }))
      const dur = state.sequence?.duration || 600
      const res = await api('/shorts/analyze', 'POST', { transcript: state.transcript || '', duration: dur })
      if (!res.ok) throw new Error(res.error)
      setResults(res)
      dispatch(actions.setViral(res.viral_moments || []))
      dispatch(actions.setToast({ msg: `✅ Found ${res.viral_moments?.length || 0} viral moments` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  function autoMarkViralMoments() {
    if (!state.viralMoments?.length) return
    state.viralMoments.forEach(m => {
      dispatch(actions.addMark({
        time: m.start,
        tag: m.emotion || 'hype',
        memePath: null,
        duration: state.settings.defaultMemeDuration || 2
      }))
    })
    dispatch(actions.setToast({ msg: `📌 Auto-marked ${state.viralMoments.length} viral moments in TAG tab` }))
  }

  /**
   * exportClip(moment)
   * Sets in/out points on the Premiere timeline to isolate this viral moment,
   * then opens the export dialog. No file picking — edits the real timeline.
   */
  async function exportClip(moment, idx) {
    setExportingIdx(idx)
    try {
      dispatch(actions.setProgress({ task: 'export', status: `Setting in/out: ${formatTime(moment.start)} → ${formatTime(moment.end)}…`, pct: 20 }))

      // Set in/out range on the Premiere timeline
      const inOutRes = await setInOutFromRange(moment.start, moment.end)
      if (inOutRes?.error) throw new Error(inOutRes.error)

      dispatch(actions.setProgress({ task: 'export', status: 'Opening export dialog…', pct: 60 }))

      // Open Premiere export (AME queue or export dialog)
      const expRes = await exportSequence()
      if (expRes?.error) throw new Error(expRes.error)

      dispatch(actions.setToast({ msg: `✅ Export dialog opened for: ${formatTime(moment.start)} → ${formatTime(moment.end)}` }))
    } catch(e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      setExportingIdx(null)
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function clearRange() {
    await clearInOut()
    dispatch(actions.setToast({ msg: 'In/Out points cleared' }))
  }

  function formatTime(sec) {
    if (!sec && sec !== 0) return '—'
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const score = results?.overall_virality_score
  const scoreColor = score >= 0.8 ? '#00e5a0' : score >= 0.5 ? '#f5c518' : '#ff4f4f'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Header */}
        <div className="bg-surface border border-border rounded p-3">
          <div className="font-display text-lg text-accent tracking-wider mb-1">📱 AUTO SHORTS</div>
          <p className="text-[9px] text-muted leading-5">
            Gemini analyzes your transcript and finds the best moments for TikTok / YouTube Shorts.
            Each viral moment can be exported directly — in/out points are set on the timeline automatically.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Btn primary onClick={analyzeForShorts}>🤖 Find Viral Moments</Btn>
          {state.viralMoments?.length > 0 && (
            <Btn onClick={autoMarkViralMoments}>📌 Auto-Mark All</Btn>
          )}
          {state.viralMoments?.length > 0 && (
            <Btn onClick={clearRange}>✖ Clear In/Out</Btn>
          )}
        </div>

        {/* Overall score */}
        {results && (
          <div className="bg-surface border border-border rounded p-3">
            <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Overall Virality Score</div>
            <div className="flex items-center gap-3">
              <div className="font-display text-4xl" style={{ color: scoreColor }}>
                {Math.round((score || 0) * 100)}%
              </div>
              <div className="flex-1 h-3 bg-surface2 rounded overflow-hidden">
                <div className="h-full rounded transition-all"
                  style={{ width: `${(score||0)*100}%`, background: scoreColor }} />
              </div>
            </div>
          </div>
        )}

        {/* Best short */}
        {results?.best_short_start !== undefined && (
          <div className="bg-surface border border-accent/30 rounded p-3">
            <div className="text-[9px] text-accent uppercase tracking-widest mb-2">⭐ Best Short Clip</div>
            <div className="flex items-center gap-3 text-[10px] mb-2">
              <span className="font-display text-accent text-lg">{formatTime(results.best_short_start)}</span>
              <span className="text-muted">→</span>
              <span className="font-display text-accent text-lg">{formatTime(results.best_short_end)}</span>
              <span className="text-muted">
                ({Math.round(results.best_short_end - results.best_short_start)}s)
              </span>
            </div>
            <Btn primary onClick={() => exportClip({ start: results.best_short_start, end: results.best_short_end }, -1)}>
              🚀 Export Best Short
            </Btn>
          </div>
        )}

        {/* Viral moments list */}
        {state.viralMoments?.length > 0 && (
          <div>
            <div className="text-[9px] text-muted uppercase tracking-widest mb-2">
              🔥 Viral Moments ({state.viralMoments.length})
            </div>
            <div className="space-y-2">
              {state.viralMoments.map((m, i) => (
                <div key={i} className="border border-border rounded p-2.5 bg-surface">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display text-accent text-sm">{formatTime(m.start)} → {formatTime(m.end)}</span>
                    <span className="text-[9px] text-hype font-bold">{Math.round((m.score||0)*100)}% viral</span>
                  </div>
                  {m.hook_text && <div className="text-[9px] text-white mb-1">"{m.hook_text}"</div>}
                  {m.suggested_caption && (
                    <div className="text-[9px] text-muted mb-1">Caption: {m.suggested_caption}</div>
                  )}
                  <div className="text-[9px] text-muted leading-4 mb-2">{m.reason}</div>

                  <div className="flex gap-2 flex-wrap">
                    {/* Mark on timeline */}
                    <button
                      onClick={() => dispatch(actions.addMark({ time: m.start, tag: m.emotion || 'hype',
                        memePath: null, duration: state.settings.defaultMemeDuration || 2 }))}
                      className="text-[9px] px-2 py-0.5 border border-accent/50 text-accent rounded hover:bg-accent/10 transition-colors">
                      📌 Mark
                    </button>

                    {/* Export this clip — sets in/out and opens export dialog */}
                    <button
                      onClick={() => exportClip(m, i)}
                      disabled={exportingIdx !== null}
                      className="text-[9px] px-2 py-0.5 border border-hype/50 text-hype rounded hover:bg-hype/10 transition-colors disabled:opacity-40">
                      {exportingIdx === i ? '⏳ Exporting…' : '🚀 Export Clip'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export formats info */}
        <div>
          <div className="text-[9px] text-muted uppercase tracking-widest mb-2">📐 Export Aspect Ratios</div>
          <div className="grid grid-cols-3 gap-2">
            {[['9:16','TikTok / Reels'],['1:1','Instagram'],['16:9','YouTube']].map(([ratio, label]) => (
              <div key={ratio} className="border border-border rounded p-2 text-center">
                <div className="font-display text-accent text-base">{ratio}</div>
                <div className="text-[8px] text-muted">{label}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-muted mt-2 leading-5">
            Select the format in the Premiere export dialog that opens after clicking Export Clip.
          </div>
        </div>

        {!state.transcript && (
          <div className="text-center py-4 text-muted text-[9px]">
            <div className="font-display text-3xl text-border mb-2">📱</div>
            Run AI → Transcribe first for best results.<br/>
            Gemini needs the transcript to find viral moments.
          </div>
        )}

      </div>
    </div>
  )
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
