export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white dark:bg-stone-900 w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[24px] shadow-2xl animate-slide-up border-t sm:border border-stone-200/60 dark:border-stone-800/60 px-6 pt-6 pb-8">
        <div className="mb-4">
          <h3 className="font-semibold text-stone-950 dark:text-stone-50 text-[17px] tracking-tight">{title}</h3>
          {message && <p className="text-stone-500 dark:text-stone-400 text-[13px] mt-1.5 leading-relaxed">{message}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium text-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl font-medium text-sm text-white active:scale-[0.99] transition-all ${
              danger
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                : 'bg-brick-600 hover:bg-brick-700 dark:bg-brick-500 dark:hover:bg-brick-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
