import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcSettlements } from '../lib/settlements'
import { fmt, genInviteCode, AVATAR_COLORS } from '../lib/utils'
import Avatar from '../components/Avatar'
import ConfirmModal from '../components/ConfirmModal'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { ThemeToggle } from '../lib/theme'

export default function HomeScreen({ user, onSelectGroup, pendingJoin, onClearPendingJoin }) {
  const [groups, setGroups]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [groupName, setGroupName]   = useState('')
  const [isPermanent, setIsPermanent] = useState(false)
  const [joinCode, setJoinCode]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [pinned, setPinned]         = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('splitya_pinned') || '[]')) }
    catch { return new Set() }
  })
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem('splitya_install_dismissed') === '1'
  )

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  const dismissInstall = () => {
    setInstallDismissed(true)
    localStorage.setItem('splitya_install_dismissed', '1')
  }

  useEffect(() => { fetchGroups() }, [])

  useEffect(() => {
    if (pendingJoin) {
      setJoinCode(pendingJoin)
      setJoinOpen(true)
      onClearPendingJoin?.()
    }
  }, [pendingJoin])

  const fetchGroups = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, invite_code, created_at, archived, is_permanent)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
    setGroups((data || []).map(r => r.groups).filter(Boolean))
    setLoading(false)
  }

  const togglePin = (groupId) => {
    setPinned(p => {
      const n = new Set(p)
      n.has(groupId) ? n.delete(groupId) : n.add(groupId)
      localStorage.setItem('splitya_pinned', JSON.stringify([...n]))
      return n
    })
  }

  const activeGroups = groups.filter(g => !g.archived)
  const archivedGroups = groups.filter(g => g.archived)

  const sortedGroups = [...activeGroups].sort((a, b) => {
    const ap = pinned.has(a.id), bp = pinned.has(b.id)
    if (ap && !bp) return -1
    if (!ap && bp) return 1
    return 0
  })

  const createGroup = async () => {
    const name = groupName.trim()
    if (!name) { toast.error('Ingresá un nombre'); return }
    setSaving(true)
    let code, tries = 0
    while (tries < 5) {
      code = genInviteCode()
      const { data } = await supabase.from('groups').select('id').eq('invite_code', code).maybeSingle()
      if (!data) break
      tries++
    }
    const { data: group, error } = await supabase
      .from('groups').insert({ name, invite_code: code, created_by: user.id, is_permanent: isPermanent })
      .select().single()
    if (error || !group) { toast.error('Error al crear el grupo'); setSaving(false); return }
    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    setSaving(false)
    setCreateOpen(false)
    setGroupName('')
    setIsPermanent(false)
    onSelectGroup(group.id)
  }

  const joinGroup = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 6) { toast.error('El código tiene 6 caracteres'); return }
    setSaving(true)
    const { data: group } = await supabase.from('groups').select().eq('invite_code', code).maybeSingle()
    if (!group) { toast.error('Código incorrecto'); setSaving(false); return }
    const { data: existing } = await supabase.from('group_members')
      .select().eq('group_id', group.id).eq('user_id', user.id).maybeSingle()
    if (!existing) await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })
    setSaving(false)
    setJoinOpen(false)
    setJoinCode('')
    onSelectGroup(group.id)
  }

  return (
    <div className="min-h-[100dvh] bg-[#faf8f3] dark:bg-[#130f0c]">
      <header className="px-5 pt-8 pb-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brick-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.6"/>
                <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold tracking-extra-tight text-stone-950 dark:text-stone-50">a la romana</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <span className="text-sm text-stone-700 dark:text-stone-300 font-medium hidden sm:inline">{user.display_name}</span>
              <Avatar name={user.display_name} color={user.avatar_color} size="sm" />
            </button>
          </div>
        </div>

        <div className="anim-up-1">
          <p className="text-stone-400 dark:text-stone-500 text-sm font-medium tracking-tight">Hola, {user.display_name.split(' ')[0]}</p>
          <h1 className="text-[38px] leading-[1.0] tracking-[-0.03em] font-semibold text-stone-950 dark:text-stone-50 mt-0.5">
            Tus grupos
          </h1>
        </div>
      </header>

      <div className="px-5 max-w-2xl mx-auto pb-12">
        {installPrompt && !installDismissed && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 anim-up-1">
            <div className="w-8 h-8 rounded-xl bg-brick-600 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.6"/>
                <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-950 dark:text-stone-50 tracking-tight">Instalá la app</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Accedé rápido desde tu pantalla de inicio</p>
            </div>
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 rounded-xl bg-brick-600 dark:bg-brick-500 text-white text-xs font-medium hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.97] transition-all flex-shrink-0"
            >
              Instalar
            </button>
            <button
              onClick={dismissInstall}
              aria-label="Cerrar"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex-shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 mb-7 anim-up-2">
          {/* Primary: Nueva salida — pill with button-in-button */}
          <button
            onClick={() => setCreateOpen(true)}
            className="group flex items-center justify-between px-4 py-3.5 bg-brick-600 dark:bg-brick-500 text-white rounded-2xl font-medium hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.98] transition-all duration-500 ease-spring focus-ring"
          >
            <span className="text-[14px] tracking-tight">Nueva salida</span>
            <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-300 ease-spring">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 1V11M1 6H11" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          {/* Secondary: Unirme */}
          <button
            onClick={() => setJoinOpen(true)}
            className="group flex items-center justify-between px-4 py-3.5 bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 text-stone-950 dark:text-stone-50 rounded-2xl font-medium hover:border-stone-400 dark:hover:border-stone-600 active:scale-[0.98] transition-all duration-500 ease-spring focus-ring"
          >
            <span className="text-[14px] tracking-tight">Unirme</span>
            <span className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0 group-hover:bg-stone-200 dark:group-hover:bg-stone-700 group-hover:translate-x-0.5 transition-all duration-300 ease-spring">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>

        {loading ? (
          <SkeletonList />
        ) : sortedGroups.length === 0 && archivedGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {sortedGroups.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Activos</p>
                  <p className="text-xs font-medium text-stone-400 dark:text-stone-500 tnum">{sortedGroups.length}</p>
                </div>
                {sortedGroups.map((g, i) => (
                  <div key={g.id} className="stagger-item" style={{ '--i': i }}>
                    <GroupCard
                      group={g}
                      userId={user.id}
                      onSelect={onSelectGroup}
                      isPinned={pinned.has(g.id)}
                      onTogglePin={togglePin}
                    />
                  </div>
                ))}
              </section>
            )}

            {/* Overall balance across groups */}
            <OverallBalance groups={activeGroups} userId={user.id} />

            {/* Archived groups */}
            {archivedGroups.length > 0 && (
              <section>
                <button
                  onClick={() => setShowArchived(s => !s)}
                  className="flex items-center justify-between w-full px-1 mb-2 group"
                >
                  <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">Archivados ({archivedGroups.length})</p>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-stone-400 transition-transform ${showArchived ? 'rotate-180' : ''}`}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {showArchived && (
                  <div className="space-y-2.5">
                    {archivedGroups.map(g => (
                      <GroupCard
                        key={g.id}
                        group={g}
                        userId={user.id}
                        onSelect={onSelectGroup}
                        isPinned={false}
                        onTogglePin={() => {}}
                        archived
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva salida" subtitle="Dale un nombre y compartí el código">
        <div className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400 mb-2">Nombre del grupo</label>
            <input
              autoFocus
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3 text-stone-950 dark:text-stone-50 font-medium focus-ring focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors"
              placeholder="Ej: Bariloche, Cumple Nico..."
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              maxLength={40}
            />
          </div>
          {/* Permanent toggle */}
          <button
            onClick={() => setIsPermanent(p => !p)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${isPermanent ? 'border-stone-950 dark:border-stone-400 bg-stone-50 dark:bg-stone-800' : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'}`}
          >
            <div className="text-left">
              <p className="text-sm font-medium text-stone-950 dark:text-stone-50 tracking-tight">Grupo permanente</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Gastos recurrentes (depto, familia...) con ciclos mensuales</p>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${isPermanent ? 'bg-stone-950 dark:bg-stone-50' : 'bg-stone-200 dark:bg-stone-700'}`}>
              <div className={`w-4 h-4 rounded-full transition-transform ${isPermanent ? 'translate-x-4 bg-white dark:bg-stone-950' : 'translate-x-0 bg-white dark:bg-stone-400'}`} />
            </div>
          </button>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Vas a recibir un código de 6 caracteres. Compartilo con tus amigos para que se sumen.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Cancelar</button>
            <button
              onClick={createGroup}
              disabled={saving || !groupName.trim()}
              className="flex-1 py-3 rounded-2xl bg-brick-600 dark:bg-brick-500 text-white font-medium hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.99] transition-all disabled:opacity-30"
            >
              {saving ? 'Creando…' : 'Crear grupo'}
            </button>
          </div>
        </div>
      </Modal>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Unirme a un grupo" subtitle="Pediles el código a quien creó el grupo">
        <div className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400 mb-2">Código</label>
            <input
              autoFocus
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-4 font-mono text-stone-950 dark:text-stone-50 text-center text-3xl tracking-[0.4em] uppercase focus-ring focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors tnum"
              placeholder="------"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && joinGroup()}
              maxLength={6}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setJoinOpen(false)} className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Cancelar</button>
            <button
              onClick={joinGroup}
              disabled={saving || joinCode.length < 6}
              className="flex-1 py-3 rounded-2xl bg-brick-600 dark:bg-brick-500 text-white font-medium hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.99] transition-all disabled:opacity-30"
            >
              {saving ? 'Buscando…' : 'Unirme'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function GroupCard({ group, userId, onSelect, isPinned, onTogglePin, archived }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: membersData }, { data: expData }] = await Promise.all([
        supabase.from('group_members').select('profiles(id, display_name, avatar_color)').eq('group_id', group.id),
        supabase.from('expenses').select('amount, paid_by, split_type, split_data').eq('group_id', group.id),
      ])
      const members = (membersData || []).map(r => r.profiles).filter(Boolean)
      const expenses = expData || []
      const total = expenses.reduce((s, e) => s + e.amount, 0)
      const { txns, bal } = calcSettlements(members, expenses)
      const myBal = Math.round((bal[userId] || 0) * 100) / 100
      setStats({ total, pending: txns.length, myBal, members })
    }
    load()
  }, [group.id, userId])

  const myStatus = stats?.myBal > 0.01
    ? { label: 'te deben', value: fmt(stats.myBal), tone: 'pos' }
    : stats?.myBal < -0.01
      ? { label: 'debés', value: fmt(-stats.myBal), tone: 'neg' }
      : null

  return (
    <div className="group/card relative p-[3px] bg-stone-200/40 dark:bg-stone-700/25 rounded-[1.5rem] ring-1 ring-black/[0.04] dark:ring-white/[0.03]">
      <button
        onClick={() => onSelect(group.id)}
        className="w-full bg-white dark:bg-stone-900 rounded-[1.35rem] p-4 hover:bg-stone-50/80 dark:hover:bg-stone-800/40 active:scale-[0.995] transition-all duration-400 ease-spring text-left focus-ring shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex items-center gap-3.5">
          {stats?.members?.length ? (
            <div className="flex -space-x-2 flex-shrink-0">
              {stats.members.slice(0, 3).map(m => (
                <div key={m.id} className="ring-2 ring-white dark:ring-stone-900 rounded-full">
                  <Avatar name={m.display_name} color={m.avatar_color} size="md" />
                </div>
              ))}
              {stats.members.length > 3 && (
                <div className="ring-2 ring-white dark:ring-stone-900 rounded-full w-10 h-10 bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xs font-medium text-stone-700 dark:text-stone-300 tnum">
                  +{stats.members.length - 3}
                </div>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 skel rounded-full" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isPinned && (
                <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor" className="text-stone-400 dark:text-stone-500 flex-shrink-0">
                  <path d="M9 1L13 5L8 7L7 13L7 7L1 5L5 1L9 1Z"/>
                </svg>
              )}
              {group.is_permanent && !archived && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex-shrink-0">Perm.</span>
              )}
              {archived && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 flex-shrink-0">Archivado</span>
              )}
              <p className={`font-medium truncate tracking-tight ${archived ? 'text-stone-500 dark:text-stone-400' : 'text-stone-950 dark:text-stone-50'}`}>{group.name}</p>
            </div>
            {stats ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 tnum">
                {stats.members.length} persona{stats.members.length !== 1 ? 's' : ''}
                {stats.total > 0 && ` · ${fmt(stats.total)}`}
              </p>
            ) : (
              <div className="w-32 h-3 skel rounded mt-1" />
            )}
          </div>

          <div className="text-right flex-shrink-0">
            {stats ? (
              myStatus ? (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">{myStatus.label}</p>
                  <p className={`text-sm font-semibold tnum ${myStatus.tone === 'pos' ? 'text-emerald-700 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
                    {myStatus.value}
                  </p>
                </>
              ) : stats.total > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Saldado
                </span>
              ) : (
                <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">Sin gastos</span>
              )
            ) : <div className="w-16 h-3 skel rounded" />}
          </div>
        </div>
      </button>

      {/* Pin button — offset accounts for the 3px bezel shell */}
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin(group.id) }}
        aria-label={isPinned ? 'Desfijar' : 'Fijar arriba'}
        className={`absolute top-[15px] right-[15px] w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-300 ease-spring ${
          isPinned
            ? 'text-stone-950 dark:text-stone-50 bg-stone-100 dark:bg-stone-800'
            : 'text-stone-300 dark:text-stone-700 hover:text-stone-500 dark:hover:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover/card:opacity-100'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 1h4M7 1v2M3 3h8l-1 4H4L3 3zM5 7v5M9 7v5M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ open, onClose, user }) {
  const [name, setName]   = useState(user?.display_name || '')
  const [color, setColor] = useState(user?.avatar_color || AVATAR_COLORS[0])
  const [alias, setAlias] = useState(user?.payment_alias || '')
  const [saving, setSaving] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      setName(user?.display_name || '')
      setColor(user?.avatar_color || AVATAR_COLORS[0])
      setAlias(user?.payment_alias || '')
    }
  }, [open])

  const save = async () => {
    if (!name.trim()) { toast.error('El nombre no puede estar vacío'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      display_name: name.trim(),
      avatar_color: color,
      payment_alias: alias.trim() || null,
    }).eq('id', user.id)
    setSaving(false)
    if (error) { toast.error('No se pudo guardar'); return }
    toast.success('Perfil actualizado')
    onClose()
    setTimeout(() => window.location.reload(), 400)
  }

  const doLogout = () => {
    localStorage.removeItem('splitya_user_id')
    window.location.reload()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Mi perfil" subtitle="Editá tu nombre, color y alias de pago">
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl">
            <Avatar name={name || user?.display_name} color={color} />
            <div>
              <p className="font-medium text-stone-950 dark:text-stone-50 tracking-tight">{name || user?.display_name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Vista previa</p>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400 mb-2">Nombre</label>
            <input
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3 text-stone-950 dark:text-stone-50 font-medium focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors"
              placeholder="Cómo te dicen tus amigos"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-stone-950 dark:ring-stone-50 dark:ring-offset-stone-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400 mb-2">
              Alias Mercado Pago (opcional)
            </label>
            <input
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3 text-stone-950 dark:text-stone-50 font-medium focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors"
              placeholder="nombre.apellido"
              value={alias}
              onChange={e => setAlias(e.target.value)}
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-2xl bg-brick-600 dark:bg-brick-500 text-white font-medium hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.99] transition-all disabled:opacity-30">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          <div className="border-t border-stone-100 dark:border-stone-800 pt-4">
            <button
              onClick={() => setLogoutConfirm(true)}
              className="w-full text-xs text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 transition-colors py-1"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={logoutConfirm}
        title="Cerrar sesión"
        message="Tu perfil quedará guardado en este dispositivo. Podés volver a entrar con el mismo nombre."
        confirmLabel="Cerrar sesión"
        danger
        onConfirm={doLogout}
        onCancel={() => setLogoutConfirm(false)}
      />
    </>
  )
}

// ─── Overall Balance ──────────────────────────────────────────────────────────

function OverallBalance({ groups, userId }) {
  const [balances, setBalances] = useState(null)

  useEffect(() => {
    if (!groups.length) return
    const load = async () => {
      const results = await Promise.all(groups.map(async g => {
        const [{ data: membersData }, { data: expData }] = await Promise.all([
          supabase.from('group_members').select('profiles(id, display_name, avatar_color)').eq('group_id', g.id),
          supabase.from('expenses').select('amount, paid_by, split_type, split_data').eq('group_id', g.id).eq('archived', false),
        ])
        const members = (membersData || []).map(r => r.profiles).filter(Boolean)
        const { bal } = calcSettlements(members, expData || [])
        return bal[userId] || 0
      }))
      const total = Math.round(results.reduce((s, b) => s + b, 0) * 100) / 100
      setBalances(total)
    }
    load()
  }, [groups, userId])

  if (balances === null || Math.abs(balances) < 0.01) return null

  const pos = balances > 0
  return (
    <div className={`rounded-2xl px-4 py-3.5 flex items-center justify-between ${pos ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60' : 'bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-800/60'}`}>
      <div>
        <p className={`text-xs font-medium uppercase tracking-wider ${pos ? 'text-emerald-700 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
          Balance total en todos los grupos
        </p>
        <p className={`text-sm mt-0.5 ${pos ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {pos ? 'En total te deben' : 'En total debés'}
        </p>
      </div>
      <p className={`text-lg font-semibold tnum ${pos ? 'text-emerald-700 dark:text-emerald-500' : 'text-red-600 dark:text-red-400'}`}>
        {fmt(Math.abs(balances))}
      </p>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1 mb-2">
        <div className="h-3 w-14 skel rounded" />
        <div className="h-3 w-4 skel rounded" />
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="p-[3px] bg-stone-200/40 dark:bg-stone-700/25 rounded-[1.5rem] ring-1 ring-black/[0.04] dark:ring-white/[0.03]">
          <div className="bg-white dark:bg-stone-900 rounded-[1.35rem] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-3.5">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 skel rounded-full ring-2 ring-white dark:ring-stone-900" />
                <div className="w-10 h-10 skel rounded-full ring-2 ring-white dark:ring-stone-900" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-28 skel rounded" />
                <div className="h-3 w-16 skel rounded" />
              </div>
              <div className="w-14 h-3 skel rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="pt-6 pb-2 anim-up-3">
      {/* Ambient glow */}
      <div className="relative flex flex-col items-center text-center px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-brick-500/[0.07] dark:bg-brick-500/[0.1] blur-3xl pointer-events-none" />

        {/* Icon */}
        <div className="relative p-[3px] bg-stone-200/50 dark:bg-stone-700/30 rounded-[1.1rem] ring-1 ring-black/[0.05] dark:ring-white/[0.04] mb-6">
          <div className="w-12 h-12 bg-white dark:bg-stone-900 rounded-[calc(1.1rem-3px)] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#b54f2e" strokeWidth="1.5"/>
              <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="#b54f2e" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="14" cy="13" r="4" stroke="currentColor" className="text-stone-300 dark:text-stone-700" strokeWidth="1.5"/>
              <line x1="14" y1="10" x2="14" y2="16" stroke="currentColor" className="text-stone-300 dark:text-stone-700" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200/80 dark:border-stone-700/60 bg-stone-50 dark:bg-stone-900/60 mb-3">
          <div className="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500" />
          <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-stone-500 dark:text-stone-400">Sin grupos todavía</span>
        </div>

        <h3 className="text-[22px] font-semibold text-stone-950 dark:text-stone-50 tracking-[-0.03em] leading-tight">
          Empezá tu<br />primer grupo
        </h3>
        <p className="text-stone-500 dark:text-stone-400 text-[13px] mt-2 max-w-[220px] leading-relaxed">
          Usá los botones de arriba para crear una salida o unirte con un código.
        </p>
      </div>
    </div>
  )
}
