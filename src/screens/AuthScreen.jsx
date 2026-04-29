import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AVATAR_COLORS } from '../lib/utils'
import { toast } from '../components/Toast'
import { ThemeToggle } from '../lib/theme'

export default function AuthScreen({ onAuth }) {
  const [name, setName]       = useState('')
  const [color, setColor]     = useState(AVATAR_COLORS[0])
  const [loading, setLoading] = useState(false)

  const create = async () => {
    const n = name.trim()
    if (!n) { toast.error('Ingresá tu nombre primero'); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .insert({ display_name: n, avatar_color: color })
      .select()
      .single()
    if (error || !data) {
      toast.error(error?.message || 'No pudimos crear el perfil. Probá de nuevo.')
      setLoading(false)
      return
    }
    localStorage.setItem('splitya_user_id', data.id)
    onAuth(data)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#faf8f3] dark:bg-[#130f0c] relative overflow-hidden grain-fixed">
      <div className="absolute top-0 right-0 w-[420px] h-[420px] rounded-full bg-brick-500/[0.07] dark:bg-brick-500/[0.11] blur-3xl pointer-events-none" />
      <div className="absolute bottom-16 -left-20 w-[320px] h-[320px] rounded-full bg-brick-400/[0.05] dark:bg-brick-400/[0.09] blur-3xl pointer-events-none" />

      <header className="px-6 pt-10 flex items-center justify-between relative z-10 anim-up">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-medium text-[15px] tracking-extra-tight text-stone-950 dark:text-stone-50">a la romana</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col sm:flex-row sm:items-center px-6 sm:px-12 lg:px-20 pt-8 pb-12 sm:py-0 max-w-5xl w-full mx-auto relative z-10 gap-12 sm:gap-16 lg:gap-24">
        {/* Left: hero */}
        <div className="sm:flex-1 anim-up-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brick-200/70 dark:border-brick-800/50 bg-brick-50/90 dark:bg-brick-950/30 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-brick-500 dark:bg-brick-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-brick-600 dark:text-brick-400">
              División entre amigos
            </span>
          </div>
          <h1 className="text-[52px] sm:text-[72px] lg:text-[88px] leading-[0.9] tracking-[-0.04em] font-semibold text-stone-950 dark:text-stone-50">
            <span className="block whitespace-nowrap">Dividir</span>
            <span className="block whitespace-nowrap">la cuenta,</span>
            <span className="block whitespace-nowrap text-stone-400 dark:text-stone-600">sin peleas.</span>
          </h1>
        </div>

        {/* Right: form */}
        <div className="sm:w-[340px] lg:w-[360px] flex-shrink-0 space-y-4 anim-up-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-semibold flex-shrink-0 transition-all duration-500 ease-spring"
              style={{ background: color }}
            >
              {name.trim() ? (
                <span className="text-base">{name.trim().charAt(0).toUpperCase()}</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.6" />
                  <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500 mb-0.5">Tu nombre</p>
              <p className="text-stone-950 dark:text-stone-50 font-medium tracking-tight text-[15px] leading-tight">
                {name.trim() || 'Elegí tu nombre'}
              </p>
            </div>
          </div>

          <div className="p-[3px] bg-stone-200/70 dark:bg-stone-700/50 rounded-[1.2rem] ring-1 ring-black/[0.05] dark:ring-white/[0.04]">
            <div className="bg-white dark:bg-stone-900 rounded-[calc(1.2rem-3px)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500 px-4 pt-3 pb-0.5">
                Nombre
              </label>
              <input
                autoFocus
                className="w-full bg-transparent px-4 pb-3.5 text-stone-950 dark:text-stone-50 font-medium text-base tracking-tight placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none"
                placeholder="Cómo te dicen tus amigos"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
                maxLength={24}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500 flex-shrink-0 mr-0.5">Color</span>
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`w-7 h-7 rounded-full flex-shrink-0 transition-all duration-300 ease-spring ${
                  color === c
                    ? 'ring-2 ring-offset-2 ring-stone-950 dark:ring-stone-50 ring-offset-[#faf8f3] dark:ring-offset-[#130f0c] scale-110'
                    : 'opacity-50 hover:opacity-90 hover:scale-105'
                }`}
                style={{ background: c }}
              />
            ))}
            <label
              aria-label="Color personalizado"
              className={`w-7 h-7 rounded-full flex-shrink-0 cursor-pointer overflow-hidden relative transition-all duration-300 ease-spring hover:scale-105 ${
                !AVATAR_COLORS.includes(color)
                  ? 'ring-2 ring-offset-2 ring-stone-950 dark:ring-stone-50 ring-offset-[#faf8f3] dark:ring-offset-[#130f0c] scale-110'
                  : 'opacity-50 hover:opacity-90'
              }`}
              style={{ background: !AVATAR_COLORS.includes(color) ? color : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
            >
              <input type="color" className="absolute opacity-0 w-full h-full cursor-pointer" value={color} onChange={e => setColor(e.target.value)} />
            </label>
          </div>

          <button
            onClick={create}
            disabled={loading || !name.trim()}
            className="group w-full flex items-center justify-between px-5 py-4 rounded-full bg-brick-600 dark:bg-brick-500 text-white hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.98] transition-all duration-500 ease-spring disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
          >
            <span className="font-medium text-[15px] tracking-tight">
              {loading ? 'Creando perfil…' : 'Empezar'}
            </span>
            <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-400 ease-spring">
              {loading ? <Spinner /> : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>

          <p className="text-xs text-stone-400 dark:text-stone-500 text-center leading-relaxed">
            Sin contraseñas. Tu perfil queda guardado en este dispositivo.
          </p>
        </div>
      </main>
    </div>
  )
}

function Logo() {
  return (
    <div className="w-7 h-7 rounded-lg bg-brick-600 flex items-center justify-center">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.6" />
        <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
