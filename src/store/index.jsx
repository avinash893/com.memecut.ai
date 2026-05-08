// MemeCut AI - Global State Store (Zustand-like with React Context)
// Using plain React context + useReducer to avoid extra deps

import { createContext, useContext, useReducer, useCallback } from 'react'

const initialState = {
  // Sequence
  sequence: null,
  currentTime: 0,
  isPlaying: false,
  // Marks (tagged moments)
  marks: [],
  markIdCounter: 0,
  // Meme library
  memeLibrary: [],
  memeFolder: '',
  // Transcript
  transcript: null,
  words: [],
  segments: [],
  // AI results
  emotions: [],
  viralMoments: [],
  captions: [],
  chapters: [],
  silences: [],
  repetitions: [],
  // Settings
  settings: {
    geminiApiKey: '',
    silenceThreshold: -40,
    minSilenceDuration: 0.5,
    silencePadding: 0.1,
    defaultMemeDuration: 2,
    defaultZoomAmount: 1.15,
    captionFont: 'Arial Black',
    captionFontSize: 72,
    captionColor: '#FFFFFF',
    captionStroke: '#000000',
    autoRandomMeme: false,
  },
  // UI
  activeTab: 'tagger',
  progress: { task: '', status: '', pct: 0 },
  toast: null,
  selectedMemeForMark: null, // markId waiting for meme assignment
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SEQUENCE':     return { ...state, sequence: action.payload }
    case 'SET_TIME':         return { ...state, currentTime: action.payload }
    case 'SET_PLAYING':      return { ...state, isPlaying: action.payload }
    case 'SET_TAB':          return { ...state, activeTab: action.payload }
    case 'SET_PROGRESS':     return { ...state, progress: action.payload }
    case 'SET_TOAST':        return { ...state, toast: action.payload }
    case 'SET_MEME_LIBRARY': return { ...state, memeLibrary: action.payload }
    case 'SET_MEME_FOLDER':  return { ...state, memeFolder: action.payload }
    case 'SET_TRANSCRIPT':   return { ...state, transcript: action.payload.transcript, words: action.payload.words, segments: action.payload.segments }
    case 'SET_EMOTIONS':     return { ...state, emotions: action.payload }
    case 'SET_VIRAL':        return { ...state, viralMoments: action.payload }
    case 'SET_CAPTIONS':     return { ...state, captions: action.payload }
    case 'SET_CHAPTERS':     return { ...state, chapters: action.payload }
    case 'SET_SILENCES':     return { ...state, silences: action.payload }
    case 'SET_REPETITIONS':  return { ...state, repetitions: action.payload }
    case 'SET_SETTINGS':     return { ...state, settings: { ...state.settings, ...action.payload } }
    case 'SET_MEME_FOR_MARK':return { ...state, selectedMemeForMark: action.payload }

    case 'ADD_MARK': {
      const mark = { ...action.payload, id: state.markIdCounter + 1 }
      const marks = [...state.marks, mark].sort((a, b) => a.time - b.time)
      return { ...state, marks, markIdCounter: state.markIdCounter + 1 }
    }
    case 'REMOVE_MARK':
      return { ...state, marks: state.marks.filter(m => m.id !== action.payload) }
    case 'UPDATE_MARK':
      return { ...state, marks: state.marks.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) }
    case 'CLEAR_MARKS':
      return { ...state, marks: [], markIdCounter: 0 }
    case 'UNDO_MARK':
      return { ...state, marks: state.marks.slice(0, -1) }

    default: return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}

// Action creators
export const actions = {
  setTab:        (tab)     => ({ type: 'SET_TAB', payload: tab }),
  setSequence:   (seq)     => ({ type: 'SET_SEQUENCE', payload: seq }),
  setTime:       (t)       => ({ type: 'SET_TIME', payload: t }),
  setPlaying:    (v)       => ({ type: 'SET_PLAYING', payload: v }),
  setProgress:   (p)       => ({ type: 'SET_PROGRESS', payload: p }),
  setToast:      (t)       => ({ type: 'SET_TOAST', payload: t }),
  setMemeLib:    (lib)     => ({ type: 'SET_MEME_LIBRARY', payload: lib }),
  setMemeFolder: (f)       => ({ type: 'SET_MEME_FOLDER', payload: f }),
  setTranscript: (t)       => ({ type: 'SET_TRANSCRIPT', payload: t }),
  setEmotions:   (e)       => ({ type: 'SET_EMOTIONS', payload: e }),
  setViral:      (v)       => ({ type: 'SET_VIRAL', payload: v }),
  setCaptions:   (c)       => ({ type: 'SET_CAPTIONS', payload: c }),
  setChapters:   (c)       => ({ type: 'SET_CHAPTERS', payload: c }),
  setSilences:   (s)       => ({ type: 'SET_SILENCES', payload: s }),
  setRepetitions:(r)       => ({ type: 'SET_REPETITIONS', payload: r }),
  setSettings:   (s)       => ({ type: 'SET_SETTINGS', payload: s }),
  setMemeForMark:(id)      => ({ type: 'SET_MEME_FOR_MARK', payload: id }),
  addMark:       (m)       => ({ type: 'ADD_MARK', payload: m }),
  removeMark:    (id)      => ({ type: 'REMOVE_MARK', payload: id }),
  updateMark:    (m)       => ({ type: 'UPDATE_MARK', payload: m }),
  clearMarks:    ()        => ({ type: 'CLEAR_MARKS' }),
  undoMark:      ()        => ({ type: 'UNDO_MARK' }),
}
