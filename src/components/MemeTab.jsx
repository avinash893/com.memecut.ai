// MemeCut AI - Meme Browser Tab
import { useEffect, useState } from 'react'
import { useStore, actions } from '../store/index.jsx'
import { getFolderDialog, api } from '../utils/cep.js'

const TAG_COLORS = {
  funny:'#f5c518', angry:'#ff4f4f', sad:'#4fa3ff', surprised:'#b44fff',
  cringe:'#ff8c00', hype:'#00e5a0', fail:'#ff4f4f', rage:'#ff2020',
  victory:'#00e5a0', confusion:'#b44fff', sus:'#ff8c00', emotional:'#4fa3ff', all:'#f5c518'
}
const ALL_TAGS = ['all','funny','angry','sad','surprised','cringe','hype','fail','rage','victory','confusion','sus','emotional']

export default function MemeTab() {
  const { state, dispatch } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [stats, setStats]   = useState(null)

  const filtered = state.memeLibrary.filter(m =>
    (filter === 'all' || m.tag === filter) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  )

  useEffect(() => {
    if (state.memeFolder) loadStats()
  }, [state.memeFolder, state.memeLibrary])

  async function loadStats() {
    try {
      const res = await api('/memes/stats')
      if (res.ok) setStats(res.stats)
    } catch {}
  }

  async function selectFolder() {
    const folder = await getFolderDialog()
    if (!folder) return
    dispatch(actions.setMemeFolder(folder))
    dispatch(actions.setProgress({ task: 'memes', status: 'Scanning…', pct: 20 }))
    try {
      const res = await api('/memes/scan', 'POST', { folderPath: folder })
      if (res.ok) {
        dispatch(actions.setMemeLib(res.library))
        dispatch(actions.setToast({ msg: `✅ Loaded ${res.count} memes` }))
      } else {
        dispatch(actions.setToast({ msg: res.error || 'Scan failed', error: true }))
      }
    } catch (e) {
      dispatch(actions.setToast({ msg: e.message, error: true }))
    } finally {
      dispatch(actions.setProgress({ task: '', status: '', pct: 0 }))
    }
  }

  async function reload() {
    if (!state.memeFolder) { dispatch(actions.setToast({ msg: 'Select folder first', error: true })); return }
    await api('/memes/clear-cache', 'POST')
    await selectFolder()
  }

  function assignMeme(meme) {
    if (state.selectedMemeForMark !== null) {
      dispatch(actions.updateMark({ id: state.selectedMemeForMark, memePath: meme.path }))
      dispatch(actions.setMemeForMark(null))
      dispatch(actions.setTab('tagger'))
      dispatch(actions.setToast({ msg: `✅ Assigned: ${meme.name}` }))
    } else {
      dispatch(actions.setToast({ msg: 'Go to TAG tab → click 🎭 on a mark first' }))
    }
  }

  const isAssigning = state.selectedMemeForMark !== null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Assignment banner */}
      {isAssigning && (
        <div className="flex-shrink-0 bg-accent text-black text-[10px] font-bold px-3 py-2 text-center">
          👆 CLICK A MEME BELOW TO ASSIGN IT TO MARK #{state.selectedMemeForMark}
          <button className="ml-3 underline" onClick={() => dispatch(actions.setMemeForMark(null))}>Cancel</button>
        </div>
      )}

      {/* Folder selector */}
      <div className="flex-shrink-0 p-3 bg-surface border-b border-border">
        <div className="flex gap-2 items-center mb-1.5">
          <div className={`flex-1 text-[9px] px-2 py-1.5 bg-surface2 border border-border rounded truncate
            ${state.memeFolder ? 'text-white' : 'text-muted'}`}>
            {state.memeFolder || 'No folder — select your Memes/ folder'}
          </div>
          <Btn primary onClick={selectFolder}>📁 Browse</Btn>
          <Btn onClick={reload}>↻</Btn>
        </div>
        <div className="text-[9px] text-muted">
          Folder structure: <span className="text-white">Memes/funny/</span> · <span className="text-white">Memes/angry/</span> · etc.
        </div>

        {/* Stats row */}
        {stats && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {Object.entries(stats.byTag).map(([tag, count]) => (
              <div key={tag} className="text-[9px] px-2 py-0.5 rounded-full border"
                style={{ borderColor: TAG_COLORS[tag]+'66', color: TAG_COLORS[tag] }}>
                {tag}: {count}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex-shrink-0 p-2 border-b border-border space-y-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search memes…"
          className="w-full bg-surface2 border border-border text-white text-[10px] px-2 py-1.5 rounded font-mono outline-none focus:border-accent" />
        <div className="flex flex-wrap gap-1">
          {ALL_TAGS.map(tag => (
            <button key={tag} onClick={() => setFilter(tag)}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-all font-mono
                ${filter === tag ? 'text-black' : 'text-muted hover:text-white'}`}
              style={filter === tag
                ? { background: TAG_COLORS[tag], borderColor: TAG_COLORS[tag] }
                : { borderColor: '#2e2e36' }}>
              {tag.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Meme grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <div className="font-display text-4xl text-border mb-2">🗂</div>
            {state.memeLibrary.length === 0
              ? 'Select your Memes folder.\nStructure: Memes/funny/*.gif'
              : 'No memes match filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(meme => (
              <MemeCard key={meme.id} meme={meme} onAssign={assignMeme} isAssigning={isAssigning} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MemeCard({ meme, onAssign, isAssigning }) {
  const [hovered, setHovered] = useState(false)
  const isVideo = meme.type === 'video'
  const isSound = meme.type === 'sound'
  const fileUrl = `file:///${meme.path.replace(/\\/g,'/')}`

  return (
    <div
      onClick={() => onAssign(meme)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-surface border rounded overflow-hidden cursor-pointer transition-all
        ${isAssigning ? 'border-accent/50 hover:border-accent hover:scale-105' : 'border-border hover:border-accent/50'}`}>

      {/* Preview */}
      <div className="h-20 bg-surface2 overflow-hidden">
        {isSound ? (
          <div className="h-full flex items-center justify-center text-3xl">🔊</div>
        ) : isVideo ? (
          <video src={fileUrl} className="w-full h-full object-cover"
            muted loop preload="metadata"
            ref={el => { if (el) { hovered ? el.play().catch(()=>{}) : el.pause() } }} />
        ) : (
          <img src={fileUrl} className="w-full h-full object-cover" loading="lazy"
            onError={e => { e.target.style.background='#333'; e.target.style.display='flex' }} />
        )}
      </div>

      {/* Info */}
      <div className="flex items-center justify-between px-1.5 py-1">
        <span className="text-[8px] text-white truncate flex-1">{meme.name}</span>
        <span className="text-[7px] px-1.5 py-0.5 rounded-full font-display ml-1 flex-shrink-0"
          style={{ background: (TAG_COLORS[meme.tag]||'#666')+'33', color: TAG_COLORS[meme.tag]||'#fff' }}>
          {meme.tag}
        </span>
      </div>

      {/* Type badge */}
      <div className="absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded bg-black/60 text-white">
        {isSound ? '🔊' : isVideo ? '🎬' : '🖼'}
      </div>

      {/* Assign overlay */}
      {isAssigning && (
        <div className="absolute inset-0 bg-accent/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="font-display text-accent text-lg">ASSIGN</span>
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, primary }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] px-2.5 py-1.5 border rounded font-mono transition-all active:scale-95 flex-shrink-0
        ${primary ? 'bg-accent text-black border-accent hover:bg-yellow-300 font-bold'
                  : 'bg-surface2 text-white border-border hover:bg-border'}`}>
      {children}
    </button>
  )
}
