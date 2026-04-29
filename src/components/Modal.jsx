import { useEffect } from 'react'

export default function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-stone-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-stone-900 w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] shadow-2xl animate-slide-up max-h-[92vh] flex flex-col border-t sm:border border-stone-200/60 dark:border-stone-800/60">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-stone-950 dark:text-stone-50 text-[19px] tracking-extra-tight">{title}</h3>
            {subtitle && <p className="text-stone-500 dark:text-stone-400 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-950 dark:hover:text-stone-50 transition-colors flex-shrink-0 -mr-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
