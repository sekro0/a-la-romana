import { useState, useEffect, useRef } from 'react'

let listener = null
let counter = 0

export const toast = (message, type = 'info', opts = {}) => {
  if (!listener) return
  const id = ++counter
  listener({ id, message, type, duration: opts.duration ?? 3200 })
  return id
}
toast.success = (m, o) => toast(m, 'success', o)
toast.error   = (m, o) => toast(m, 'error', o)
toast.info    = (m, o) => toast(m, 'info', o)

export function ToastHost() {
  const [items, setItems] = useState([])
  const timers = useRef({})

  useEffect(() => {
    listener = (t) => {
      setItems(prev => [...prev, t])
      timers.current[t.id] = setTimeout(() => {
        setItems(prev => prev.filter(x => x.id !== t.id))
        delete timers.current[t.id]
      }, t.duration)
    }
    return () => {
      listener = null
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  const dismiss = (id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setItems(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map(t => {
        const styles = {
          success: 'bg-stone-950 text-white border-stone-800',
          error:   'bg-red-600 text-white border-red-700',
          info:    'bg-stone-950 text-white border-stone-800',
        }[t.type] || 'bg-stone-950 text-white'
        const icon = { success: '✓', error: '!', info: 'i' }[t.type] || ''
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border ${styles} shadow-card animate-slide-up max-w-md w-full sm:w-auto`}
          >
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/15 text-xs font-semibold flex-shrink-0">{icon}</span>
            <span className="text-sm font-medium tracking-tight text-left flex-1">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
