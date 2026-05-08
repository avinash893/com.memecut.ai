import { useEffect, useMemo, useState } from 'react'
import {
  cepLog,
  mcpAddMarker,
  mcpBrowseMediaFiles,
  mcpFavoriteLocations,
  mcpImportFiles,
  mcpPing,
  mcpProjectInfo,
  mcpSetPlayhead,
  mcpTimelineState,
} from '../utils/cep.js'

const COMMANDS = [
  { id: 'ping', label: 'Ping Premiere', icon: '📡', description: 'Verify CEP can execute the MCP bridge.' },
  { id: 'project', label: 'Project Info', icon: '📁', description: 'Read project path and sequence list.' },
  { id: 'timeline', label: 'Timeline State', icon: '🎞️', description: 'Inspect tracks, clips, and durations.' },
]

export default function MCPTab() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [locations, setLocations] = useState([])
  const [browserPath, setBrowserPath] = useState('')
  const [mediaItems, setMediaItems] = useState([])
  const [markerName, setMarkerName] = useState('MemeCut MCP Marker')
  const [playheadSeconds, setPlayheadSeconds] = useState('0')

  useEffect(() => {
    runSilently(async () => {
      const res = await mcpFavoriteLocations()
      if (res?.success && Array.isArray(res.data?.locations)) {
        setLocations(res.data.locations)
        if (!browserPath && res.data.locations[0]?.path) setBrowserPath(res.data.locations[0].path)
      }
    })
  }, [])

  const timelineTracks = useMemo(() => {
    if (!result?.success || !Array.isArray(result.data?.tracks)) return []
    return result.data.tracks
  }, [result])

  async function runSilently(fn) {
    try { await fn() } catch (e) { cepLog('warn', 'MCP silent operation failed:', e.message) }
  }

  async function runCommand(id) {
    await withBusy(async () => {
      let res
      if (id === 'ping') res = await mcpPing()
      if (id === 'project') res = await mcpProjectInfo()
      if (id === 'timeline') res = await mcpTimelineState()
      setResult(res)
      cepLog(res?.success ? 'info' : 'error', `MCP ${id} result:`, res)
    })
  }

  async function browse(path = browserPath) {
    if (!path) return
    await withBusy(async () => {
      const res = await mcpBrowseMediaFiles(path)
      setResult(res)
      if (res?.success) {
        setBrowserPath(res.data.path)
        setMediaItems(res.data.items || [])
      }
      cepLog(res?.success ? 'info' : 'error', 'MCP browse result:', res)
    })
  }

  async function importItem(item) {
    if (!item?.path || item.isFolder) return
    await withBusy(async () => {
      const res = await mcpImportFiles([item.path])
      setResult(res)
      cepLog(res?.success ? 'info' : 'error', 'MCP import result:', res)
    })
  }

  async function addMarker() {
    await withBusy(async () => {
      const seconds = playheadSeconds === '' ? undefined : Number(playheadSeconds)
      const res = await mcpAddMarker(seconds, markerName, 'Created from MemeCut MCP tab')
      setResult(res)
      cepLog(res?.success ? 'info' : 'error', 'MCP marker result:', res)
    })
  }

  async function jumpPlayhead() {
    await withBusy(async () => {
      const seconds = Number(playheadSeconds || 0)
      const res = await mcpSetPlayhead(seconds)
      setResult(res)
      cepLog(res?.success ? 'info' : 'error', 'MCP set playhead result:', res)
    })
  }

  async function withBusy(fn) {
    setBusy(true)
    try { await fn() }
    catch (e) {
      const fail = { success: false, error: e.message }
      setResult(fail)
      cepLog('error', 'MCP tab operation failed:', e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="h-full overflow-y-auto bg-bg p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg text-accent tracking-wider">🧠 PREMIERE MCP</div>
          <p className="text-[9px] text-muted leading-5">
            MCP-inspired Premiere controls adapted from the working AdobePremiereProMCP extension.
            Use these tools for diagnostics, timeline inspection, markers, playhead moves, and media import.
          </p>
        </div>
        {busy && <div className="text-[9px] text-accent animate-pulse font-mono">running…</div>}
      </div>

      <section className="grid grid-cols-3 gap-2">
        {COMMANDS.map(cmd => (
          <button key={cmd.id} onClick={() => runCommand(cmd.id)} disabled={busy}
            className="bg-surface border border-border hover:border-accent rounded p-2 text-left transition-colors disabled:opacity-50">
            <div className="font-display text-xs text-white tracking-wider">{cmd.icon} {cmd.label}</div>
            <div className="text-[8px] text-muted leading-4 mt-1">{cmd.description}</div>
          </button>
        ))}
      </section>

      <section className="bg-surface border border-border rounded p-3 space-y-2">
        <div className="font-display text-sm text-accent tracking-wider">⚡ Quick Actions</div>
        <div className="grid grid-cols-[1fr_90px_90px] gap-2">
          <input value={markerName} onChange={e => setMarkerName(e.target.value)}
            className="bg-surface2 border border-border rounded px-2 py-1 text-[10px] text-white outline-none focus:border-accent"
            placeholder="Marker name" />
          <input value={playheadSeconds} onChange={e => setPlayheadSeconds(e.target.value)} type="number" step="0.1"
            className="bg-surface2 border border-border rounded px-2 py-1 text-[10px] text-white outline-none focus:border-accent"
            placeholder="Seconds" />
          <button onClick={addMarker} disabled={busy}
            className="bg-accent text-black font-display text-[10px] rounded hover:bg-yellow-300 disabled:opacity-50">Add Marker</button>
        </div>
        <button onClick={jumpPlayhead} disabled={busy}
          className="w-full bg-surface2 border border-border text-white font-display text-[10px] py-1.5 rounded hover:border-accent disabled:opacity-50">
          Move Playhead to {playheadSeconds || 0}s
        </button>
      </section>

      <section className="bg-surface border border-border rounded p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-display text-sm text-accent tracking-wider">🗂️ Media Browser</div>
          <select value={browserPath} onChange={e => browse(e.target.value)}
            className="max-w-[45%] bg-surface2 border border-border rounded px-2 py-1 text-[9px] text-white">
            <option value="">Favorites…</option>
            {locations.map(loc => <option key={loc.name} value={loc.path}>{loc.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input value={browserPath} onChange={e => setBrowserPath(e.target.value)}
            className="flex-1 bg-surface2 border border-border rounded px-2 py-1 text-[9px] text-white font-mono outline-none focus:border-accent"
            placeholder="Folder path" />
          <button onClick={() => browse()} disabled={busy || !browserPath}
            className="bg-accent text-black font-display text-[10px] px-3 rounded hover:bg-yellow-300 disabled:opacity-50">Browse</button>
        </div>
        <div className="max-h-48 overflow-y-auto border border-border rounded bg-bg divide-y divide-border/60">
          {mediaItems.length === 0 && <div className="text-[9px] text-muted text-center py-5">Browse a folder to list Premiere media.</div>}
          {mediaItems.map(item => (
            <div key={item.path} className="flex items-center gap-2 px-2 py-1.5 text-[9px]">
              <span className="w-5">{item.isFolder ? '📁' : '🎬'}</span>
              <button onClick={() => item.isFolder ? browse(item.path) : importItem(item)}
                className="flex-1 min-w-0 text-left text-white hover:text-accent truncate" title={item.path}>
                {item.name}
              </button>
              <span className="text-muted uppercase">{item.type}</span>
            </div>
          ))}
        </div>
      </section>

      {timelineTracks.length > 0 && (
        <section className="bg-surface border border-border rounded p-3 space-y-2">
          <div className="font-display text-sm text-accent tracking-wider">🎞️ Timeline Tracks</div>
          {timelineTracks.map(track => (
            <div key={`${track.type}-${track.index}`} className="bg-surface2 rounded border border-border p-2">
              <div className="text-[10px] text-white font-bold">{track.type.toUpperCase()} {track.index + 1} · {track.clipCount} clips</div>
              <div className="mt-1 space-y-1">
                {(track.clips || []).slice(0, 6).map(clip => (
                  <div key={clip.index} className="text-[8px] text-muted font-mono truncate">
                    #{clip.index} {clip.name} · {Number(clip.start).toFixed(2)}s–{Number(clip.end).toFixed(2)}s
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="bg-black/40 border border-border rounded p-2">
        <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Last MCP Result</div>
        <pre className={`text-[9px] whitespace-pre-wrap break-all font-mono ${result?.success ? 'text-green-300' : 'text-red-300'}`}>
          {result ? JSON.stringify(result, null, 2) : 'No command run yet.'}
        </pre>
      </section>
    </div>
  )
}
