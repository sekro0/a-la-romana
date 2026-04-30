import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcSettlements } from '../lib/settlements'
import { fmt, fmtDate, expCategory, CATEGORIES } from '../lib/utils'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import ExpenseForm from '../components/ExpenseForm'
import { toast } from '../components/Toast'
import { ThemeToggle } from '../lib/theme'

export default function GroupScreen({ groupId, user, onBack }) {
  const [group, setGroup]         = useState(null)
  const [members, setMembers]     = useState([])
  const [memberRows, setMemberRows] = useState([])
  const [expenses, setExpenses]   = useState([])
  const [tab, setTab]             = useState('gastos')
  const [loading, setLoading]     = useState(true)
  const [confirm, setConfirm]     = useState(null)

  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('expenses').select('*').eq('group_id', groupId).eq('archived', false)
      .order('created_at', { ascending: false })
    setExpenses(data || [])
  }, [groupId])

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('group_members')
      .select('user_id, joined_at, profiles(id, display_name, avatar_color, avatar_url, payment_alias)')
      .eq('group_id', groupId)
    setMemberRows(data || [])
    setMembers((data || []).map(r => r.profiles).filter(Boolean))
  }, [groupId])

  useEffect(() => {
    const init = async () => {
      const { data: g } = await supabase.from('groups').select().eq('id', groupId).single()
      setGroup(g)
      await Promise.all([fetchMembers(), fetchExpenses()])
      setLoading(false)
    }
    init()

    const channel = supabase.channel(`group-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, fetchExpenses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, fetchMembers)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [groupId, fetchExpenses, fetchMembers])

  const isAdmin = group?.created_by === user.id

  const archiveGroup = () => setConfirm({
    title: 'Archivar grupo',
    message: 'Lo podés ver en "Archivados" pero no se podrán agregar gastos.',
    confirmLabel: 'Archivar',
    danger: true,
    onConfirm: async () => {
      const { error } = await supabase.from('groups').update({ archived: true }).eq('id', groupId)
      if (error) { toast.error('No se pudo archivar'); return }
      toast.success('Grupo archivado')
      onBack()
    },
  })

  const closeCycle = () => setConfirm({
    title: 'Cerrar ciclo',
    message: 'Los gastos se archivarán y el balance vuelve a cero.',
    confirmLabel: 'Cerrar ciclo',
    danger: false,
    onConfirm: async () => {
      const { error } = await supabase.from('expenses').update({ archived: true }).eq('group_id', groupId).eq('archived', false)
      if (error) { toast.error('No se pudo cerrar el ciclo'); return }
      toast.success('Ciclo cerrado — balance reiniciado')
      fetchExpenses()
    },
  })

  const removeMember = (memberId) => {
    const member = members.find(m => m.id === memberId)
    setConfirm({
      title: `Expulsar a ${member?.display_name || 'este miembro'}`,
      message: 'Esta persona no podrá ver los gastos del grupo.',
      confirmLabel: 'Expulsar',
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from('group_members').delete()
          .eq('group_id', groupId).eq('user_id', memberId)
        if (error) { toast.error('No se pudo expulsar al miembro'); return }
        toast.success(`${member?.display_name || 'Miembro'} eliminado`)
      },
    })
  }

  const leaveGroup = () => setConfirm({
    title: 'Salir del grupo',
    message: isAdmin
      ? 'Sos el admin y no podrás transferir ese rol.'
      : '¿Seguro que querés salir del grupo?',
    confirmLabel: 'Salir',
    danger: true,
    onConfirm: async () => {
      const { error } = await supabase.from('group_members').delete()
        .eq('group_id', groupId).eq('user_id', user.id)
      if (error) { toast.error('No se pudo salir del grupo'); return }
      toast.success('Saliste del grupo')
      onBack()
    },
  })

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const { txns } = loading ? { txns: [] } : calcSettlements(members, expenses)

  if (loading) return <GroupScreenSkeleton onBack={onBack} />

  const tabs = [
    { id: 'gastos',    label: 'Gastos',     count: expenses.length },
    { id: 'resultado', label: 'Resultado',  count: txns.length || null },
    { id: 'actividad', label: 'Actividad',  count: null },
    { id: 'miembros',  label: 'Miembros',   count: members.length },
  ]

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#faf8f3] dark:bg-[#130f0c]">
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200/60 dark:border-stone-800/60 flex-shrink-0">
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 text-sm font-medium transition-colors focus-ring rounded-md px-1 py-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Mis grupos
            </button>
            <ThemeToggle />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-[26px] leading-tight font-semibold text-stone-950 dark:text-stone-50 tracking-extra-tight truncate">{group?.name}</h1>
                {isAdmin && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-brick-600 dark:bg-brick-500 text-white flex-shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-stone-500 dark:text-stone-400 text-sm mt-0.5 tnum">
                {members.length} persona{members.length !== 1 ? 's' : ''}
                {total > 0 && <> · <span className="font-medium text-stone-700 dark:text-stone-300">{fmt(total)}</span></>}
              </p>
            </div>
            <InviteCodeButton code={group?.invite_code} />
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-5 pb-2">
          <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-0 px-2 py-2 text-[13px] font-medium rounded-lg tracking-tight transition-all whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-white dark:bg-stone-700 text-stone-950 dark:text-stone-50 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1 text-[11px] tnum font-normal text-stone-400 dark:text-stone-500">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-5 pb-12">
        {tab === 'gastos'    && <ExpensesTab members={members} expenses={expenses} user={user} groupId={groupId} onRefresh={fetchExpenses} isAdmin={isAdmin} />}
        {tab === 'resultado' && <ResultsTab members={members} expenses={expenses} userId={user.id} group={group} user={user} />}
        {tab === 'actividad' && <ActivityTab memberRows={memberRows} expenses={expenses} members={members} />}
        {tab === 'miembros'  && <MembersTab group={group} members={members} user={user} isAdmin={isAdmin} onRemoveMember={removeMember} onLeaveGroup={leaveGroup} onArchiveGroup={archiveGroup} onCloseCycle={closeCycle} />}
      </main>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => { confirm?.onConfirm(); setConfirm(null) }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

// ─── Invite Code Button ───────────────────────────────────────────────────────

function InviteCodeButton({ code }) {
  const copy = () => {
    if (!code) return
    navigator.clipboard?.writeText(code).then(() => toast.success('Código copiado'))
  }
  if (!code) return null
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors group focus-ring flex-shrink-0"
      aria-label="Copiar código de invitación"
    >
      <span className="font-mono text-xs font-semibold tracking-[0.2em] text-stone-700 dark:text-stone-300 tnum">{code}</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-stone-500 dark:text-stone-400 group-hover:text-stone-950 dark:group-hover:text-stone-50 transition-colors">
        <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 9V3a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    </button>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function GroupScreenSkeleton({ onBack }) {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#faf8f3] dark:bg-[#130f0c]">
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200/60 dark:border-stone-800/60 px-5 pt-4 pb-3">
        <button onClick={onBack} className="text-stone-400 dark:text-stone-500 text-sm mb-3">← Grupos</button>
        <div className="space-y-2">
          <div className="h-7 w-44 skel rounded" />
          <div className="h-3 w-32 skel rounded" />
        </div>
      </header>
      <div className="p-5 space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-16 skel rounded-2xl" />)}
      </div>
    </div>
  )
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ memberRows, expenses, members }) {
  const getMember = (id) => members.find(m => m.id === id)

  const events = [
    ...expenses.map(e => ({ type: 'expense', date: e.created_at, expense: e })),
    ...memberRows.map(r => ({ type: 'join', date: r.joined_at, profile: r.profiles, userId: r.user_id })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  if (!events.length) return (
    <div className="text-center py-16 text-stone-400 dark:text-stone-500">
      <p className="font-medium text-stone-950 dark:text-stone-50">Sin actividad todavía</p>
      <p className="text-sm mt-1">Los eventos del grupo aparecerán acá</p>
    </div>
  )

  return (
    <div className="space-y-1">
      {events.map((ev, i) => {
        if (ev.type === 'expense') {
          const payer = getMember(ev.expense.paid_by)
          const cat = expCategory(ev.expense.description, ev.expense.split_data?._category)
          return (
            <div key={`exp-${ev.expense.id}`} className="flex gap-3 py-3 border-b border-stone-100 dark:border-stone-800 last:border-0">
              <div className="w-9 h-9 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                {cat.glyph}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-950 dark:text-stone-50 tracking-tight">{ev.expense.description}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {payer?.display_name || '?'} pagó <span className="font-medium text-stone-700 dark:text-stone-300 tnum">{fmt(ev.expense.amount)}</span>
                </p>
              </div>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 flex-shrink-0 mt-0.5">{fmtDate(ev.date)}</p>
            </div>
          )
        }
        return (
          <div key={`join-${ev.userId}-${i}`} className="flex gap-3 py-3 border-b border-stone-100 dark:border-stone-800 last:border-0">
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 mt-0.5">
              {ev.profile
                ? <Avatar name={ev.profile.display_name} color={ev.profile.avatar_color} src={ev.profile.avatar_url} size="sm" />
                : <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-950 dark:text-stone-50 tracking-tight">
                {ev.profile?.display_name || 'Alguien'} <span className="font-normal text-stone-500 dark:text-stone-400">se unió al grupo</span>
              </p>
            </div>
            <p className="text-[11px] text-stone-400 dark:text-stone-500 flex-shrink-0 mt-0.5">{fmtDate(ev.date)}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ group, members, user, isAdmin, onRemoveMember, onLeaveGroup, onArchiveGroup, onCloseCycle }) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    if (!group?.invite_code) return
    const text = `Sumate al grupo "${group.name}" en a la romana: ${group.invite_code}`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      toast.success('Mensaje listo para compartir')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const shareCode = async () => {
    if (!group?.invite_code) return
    const text = `Sumate al grupo "${group.name}" en a la romana: ${group.invite_code}`
    if (navigator.share) {
      try { await navigator.share({ text, title: 'a la romana' }) } catch {}
    } else copyCode()
  }

  const shareLink = async () => {
    if (!group?.invite_code) return
    const url = `${window.location.origin}${window.location.pathname}?join=${group.invite_code}`
    const text = `Sumate al grupo "${group.name}" en a la romana`
    if (navigator.share) {
      try { await navigator.share({ url, title: text }) } catch {}
    } else {
      navigator.clipboard?.writeText(url)
      toast.success('Link copiado')
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800/80 overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400">Código de invitación</p>
          <p className="font-mono text-4xl font-semibold tracking-[0.3em] text-stone-950 dark:text-stone-50 mt-2 tnum">
            {group?.invite_code}
          </p>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-3 leading-relaxed">
            Compartilo con quienes quieras sumar. No hay límite de personas.
          </p>
        </div>
        <div className="grid grid-cols-3 border-t border-stone-100 dark:border-stone-800">
          <button onClick={copyCode} className="px-3 py-3 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5">
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
          <button onClick={shareCode} className="px-3 py-3 text-sm font-medium text-stone-950 dark:text-stone-50 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors border-x border-stone-100 dark:border-stone-800 flex items-center justify-center gap-1.5">
            Compartir
          </button>
          <button onClick={shareLink} className="px-3 py-3 text-sm font-medium text-stone-950 dark:text-stone-50 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5">
            Link
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between px-1 mb-3">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Miembros</p>
          <p className="text-xs font-medium text-stone-400 dark:text-stone-500 tnum">{members.length}</p>
        </div>
        <div className="p-[3px] bg-stone-200/40 dark:bg-stone-700/25 rounded-[1.5rem] ring-1 ring-black/[0.04] dark:ring-white/[0.03]">
          <div className="bg-white dark:bg-stone-900 rounded-[1.35rem] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {members.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < members.length - 1 ? 'border-b border-stone-100 dark:border-stone-800' : ''}`}>
                <Avatar name={m.display_name} color={m.avatar_color} src={m.avatar_url} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-950 dark:text-stone-50 truncate tracking-tight">{m.display_name}</p>
                    {m.id === group?.created_by && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">Admin</span>
                    )}
                  </div>
                  {m.id === user.id && <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Vos</p>}
                </div>
                {isAdmin && m.id !== user.id && (
                  <button
                    onClick={() => onRemoveMember(m.id)}
                    className="text-xs text-red-500 dark:text-red-400 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex-shrink-0"
                  >
                    Expulsar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="space-y-2">
          {group?.is_permanent && (
            <button
              onClick={onCloseCycle}
              className="w-full py-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            >
              Cerrar ciclo — reiniciar balance
            </button>
          )}
          <button
            onClick={onArchiveGroup}
            className="w-full py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Archivar grupo
          </button>
        </section>
      )}

      <section>
        <button
          onClick={onLeaveGroup}
          className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          Salir del grupo
        </button>
      </section>
    </div>
  )
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ members, expenses, user, groupId, onRefresh, isAdmin }) {
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [groupByDay, setGroupByDay] = useState(false)
  const [catFilter, setCatFilter] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const getExpCat = (exp) => expCategory(exp.description, exp.split_data?._category).label
  const uniqueCats = [...new Set(expenses.map(getExpCat))].filter(c => c !== 'Gasto')
  const filteredExpenses = catFilter ? expenses.filter(e => getExpCat(e) === catFilter) : expenses

  const saveExpense = async (data) => {
    if (editing) {
      const { error } = await supabase.from('expenses').update({ ...data }).eq('id', editing.id)
      if (error) { toast.error('No se pudo actualizar'); return }
      toast.success('Gasto actualizado')
    } else {
      const { error } = await supabase.from('expenses').insert({ ...data, group_id: groupId, created_by: user.id })
      if (error) { toast.error('No se pudo guardar'); return }
      toast.success('Gasto agregado')
    }
    setFormOpen(false)
    setEditing(null)
    onRefresh()
  }

  const deleteExpense = (id) => setDeleteConfirm(id)

  const doDelete = async () => {
    const { error } = await supabase.from('expenses').delete().eq('id', deleteConfirm)
    setDeleteConfirm(null)
    if (error) { toast.error('No se pudo eliminar'); return }
    toast.success('Gasto eliminado')
    onRefresh()
  }

  const getMember = (id) => members.find(m => m.id === id)

  const splitSummary = (exp) => {
    if (exp.split_type === 'equal') {
      const n = (exp.split_data.participants || []).length
      return `entre ${n} · ${fmt(exp.amount / (n || 1))} c/u`
    }
    if (exp.split_type === 'percentage') return 'por porcentaje'
    if (exp.split_type === 'items') {
      const n = (exp.split_data.items || []).length
      return `${n} ítem${n !== 1 ? 's' : ''}`
    }
    if (exp.split_type === 'consumption') return 'por consumo'
    return 'montos exactos'
  }

  const splitBadge = { equal: 'Igual', exact: 'Exacto', percentage: 'Porcentaje', items: 'Por ítems', consumption: 'Consumo' }

  const ExpenseItem = ({ exp, idx, total: totalCount }) => {
    const payer = getMember(exp.paid_by)
    const isMine = exp.paid_by === user.id || exp.created_by === user.id
    const canDelete = isMine || isAdmin
    const cat = expCategory(exp.description, exp.split_data?._category)
    return (
      <details className={`group/item ${idx < totalCount - 1 ? 'border-b border-stone-100 dark:border-stone-800' : ''}`}>
        <summary className="flex items-start gap-3.5 p-4 cursor-pointer hover:bg-stone-50/80 dark:hover:bg-stone-800/60 transition-colors">
          <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
            {cat.glyph}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-stone-950 dark:text-stone-50 truncate tracking-tight">{exp.description}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  <span className="font-medium text-stone-700 dark:text-stone-300">{payer?.display_name || '?'}</span> pagó · {splitSummary(exp)}
                </p>
              </div>
              <p className="font-semibold text-stone-950 dark:text-stone-50 text-[15px] tnum flex-shrink-0">{fmt(exp.amount)}</p>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-stone-400 dark:text-stone-500 font-medium">
              <span>{fmtDate(exp.created_at)}</span>
              <span>·</span>
              <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-md text-stone-600 dark:text-stone-400">{splitBadge[exp.split_type]}</span>
              {exp.split_data?._currency === 'USD' && (
                <>
                  <span>·</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">USD {exp.split_data._usd_amount}</span>
                </>
              )}
              {exp.split_data?._tip_percent > 0 && (
                <>
                  <span>·</span>
                  <span className="text-stone-500 dark:text-stone-400">Prop. {exp.split_data._tip_percent}%</span>
                </>
              )}
              {exp.receipt_url && (
                <>
                  <span>·</span>
                  <a
                    href={exp.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8.5 5.5L11 8.5H1.5L4.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Ticket
                  </a>
                </>
              )}
            </div>
          </div>
        </summary>
        {canDelete && (
          <div className="px-4 pb-3 flex gap-2">
            {isMine && (
              <button
                onClick={(e) => { e.preventDefault(); setEditing(exp); setFormOpen(true) }}
                className="text-xs text-stone-700 dark:text-stone-300 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Editar
              </button>
            )}
            <button
              onClick={(e) => { e.preventDefault(); deleteExpense(exp.id) }}
              className="text-xs text-red-600 dark:text-red-400 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              Eliminar
            </button>
          </div>
        )}
      </details>
    )
  }

  return (
    <div className="space-y-5">
      {expenses.length > 0 && (
        <section className="bg-brick-600 dark:bg-brick-700 text-white rounded-3xl p-6 grain relative overflow-hidden">
          <div className="flex items-baseline justify-between">
            <p className="text-brick-200 dark:text-brick-300 text-xs uppercase tracking-wider font-medium">Total del grupo</p>
            <p className="text-brick-200 dark:text-brick-300 text-xs tnum">{expenses.length} gasto{expenses.length !== 1 ? 's' : ''}</p>
          </div>
          <p className="text-5xl font-semibold tracking-tightest mt-2 tnum">{fmt(total)}</p>
          {members.length > 0 && (
            <div className="flex items-center gap-2 mt-4 text-brick-200 dark:text-brick-300 text-sm">
              <span className="tnum">{fmt(total / members.length)}</span>
              <span>·</span>
              <span>por persona</span>
            </div>
          )}
        </section>
      )}

      {members.length < 2 ? (
        <div className="border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl px-4 py-3 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-700 dark:text-amber-500 mt-0.5 flex-shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 5v3.5M8 11v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <p className="text-amber-800 dark:text-amber-400 text-sm leading-relaxed">
            Necesitás al menos 2 personas para agregar gastos. Compartí el código.
          </p>
        </div>
      ) : (
        <button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          className="group w-full py-3.5 bg-brick-600 dark:bg-brick-500 text-white rounded-full font-medium tracking-tight hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.99] transition-all duration-500 ease-spring flex items-center justify-between px-5 focus-ring"
        >
          <span className="text-[14px] tracking-tight">Agregar gasto</span>
          <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300 ease-spring">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
        </button>
      )}

      {expenses.length === 0 ? (
        <EmptyExpenses />
      ) : (
        <section>
          <div className="flex items-center justify-between px-1 mb-2.5">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Movimientos</p>
            <button
              onClick={() => setGroupByDay(g => !g)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              {groupByDay ? 'Ver todo' : 'Por día'}
            </button>
          </div>

          {uniqueCats.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide mb-3">
              {catFilter && (
                <button
                  onClick={() => setCatFilter(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap flex-shrink-0 bg-stone-950 border-stone-950 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-950 transition-all"
                >
                  ✕ Todos
                </button>
              )}
              {uniqueCats.map(cat => {
                const c = CATEGORIES.find(c => c.id === cat)
                const glyph = c?.glyph || '◇'
                return (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(f => f === cat ? null : cat)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                      catFilter === cat
                        ? 'bg-stone-950 border-stone-950 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-950'
                        : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                    }`}
                  >
                    <span>{glyph}</span>
                    <span>{cat}</span>
                  </button>
                )
              })}
            </div>
          )}

          {filteredExpenses.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-8">Sin gastos en esta categoría</p>
          ) : groupByDay ? (
            <div className="space-y-4">
              {Object.entries(
                filteredExpenses.reduce((acc, e) => {
                  const day = new Date(e.created_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
                  if (!acc[day]) acc[day] = []
                  acc[day].push(e)
                  return acc
                }, {})
              ).map(([day, dayExpenses]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider px-1 mb-1.5 capitalize">{day}</p>
                  <div className="p-[3px] bg-stone-200/40 dark:bg-stone-700/25 rounded-[1.5rem] ring-1 ring-black/[0.04] dark:ring-white/[0.03]">
                    <div className="bg-white dark:bg-stone-900 rounded-[1.35rem] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      {dayExpenses.map((exp, idx) => (
                        <ExpenseItem key={exp.id} exp={exp} idx={idx} total={dayExpenses.length} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-[3px] bg-stone-200/40 dark:bg-stone-700/25 rounded-[1.5rem] ring-1 ring-black/[0.04] dark:ring-white/[0.03]">
              <div className="bg-white dark:bg-stone-900 rounded-[1.35rem] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                {filteredExpenses.map((exp, idx) => (
                  <ExpenseItem key={exp.id} exp={exp} idx={idx} total={filteredExpenses.length} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        subtitle={editing ? 'Cambios en tiempo real para todos' : 'Quién pagó, cuánto y cómo se reparte'}
      >
        <ExpenseForm
          members={members}
          expense={editing}
          currentUserId={user.id}
          groupId={groupId}
          onSave={saveExpense}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm}
        title="Eliminar gasto"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

function EmptyExpenses() {
  return (
    <div className="relative flex flex-col items-center text-center pt-8 pb-4 px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-40 rounded-full bg-brick-500/[0.06] dark:bg-brick-500/[0.08] blur-3xl pointer-events-none" />

      <div className="relative p-[3px] bg-stone-200/50 dark:bg-stone-700/30 rounded-[1.1rem] ring-1 ring-black/[0.05] dark:ring-white/[0.04] mb-5">
        <div className="w-12 h-12 bg-white dark:bg-stone-900 rounded-[calc(1.1rem-3px)] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 4h11l3 3v13H5V4z" stroke="#b54f2e" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 11h6M9 15h4" stroke="#b54f2e" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200/80 dark:border-stone-700/60 bg-stone-50 dark:bg-stone-900/60 mb-3">
        <div className="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500" />
        <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-stone-500 dark:text-stone-400">Sin gastos</span>
      </div>

      <h3 className="text-[18px] font-semibold text-stone-950 dark:text-stone-50 tracking-[-0.03em] leading-tight">
        Primer gasto, primer paso
      </h3>
      <p className="text-stone-500 dark:text-stone-400 text-[13px] mt-2 max-w-[200px] leading-relaxed">
        Todos van a verlo en tiempo real.
      </p>
    </div>
  )
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({ members, expenses, userId, group, user }) {
  const storageKey = `splitya_paid_${group?.id}`

  const [paidIds, setPaidIds] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  const { txns, bal } = calcSettlements(members, expenses)
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const toggle = (key) => setPaidIds(p => {
    const n = new Set(p)
    n.has(key) ? n.delete(key) : n.add(key)
    localStorage.setItem(storageKey, JSON.stringify([...n]))
    return n
  })

  const resetPaid = () => {
    setPaidIds(new Set())
    localStorage.removeItem(storageKey)
  }

  const sendWhatsApp = (t) => {
    const isDebtor = t.from.id === userId
    const otherName = isDebtor ? t.to.name : t.from.name
    const msg = isDebtor
      ? `Che ${otherName}! Te recuerdo que te debo ${fmt(t.amount)} del grupo "${group?.name}". Cuando puedas me avisas!`
      : `Che ${otherName}! Te recuerdo que me debes ${fmt(t.amount)} del grupo "${group?.name}".`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const exportSummary = () => {
    const pending = txns.filter(t => !paidIds.has(`${t.from.id}>${t.to.id}>${t.amount}`))
    const lines = [
      `📊 ${group?.name}`,
      ``,
      `💰 Total: ${fmt(total)}`,
      `👥 Personas: ${members.length}`,
      ``,
      pending.length === 0
        ? '✅ ¡Todos al día! Sin deudas pendientes.'
        : `💸 Pagos pendientes (${pending.length}):`,
      ...pending.map(t => `  • ${t.from.name} → ${t.to.name}: ${fmt(t.amount)}`),
      ``,
      `Generado con a la romana`,
    ]
    const text = lines.join('\n')
    if (navigator.share) {
      navigator.share({ text, title: group?.name }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text)
      toast.success('Resumen copiado al portapapeles')
    }
  }

  if (!members.length) return (
    <div className="text-center py-16 text-stone-400 dark:text-stone-500">
      <p className="font-medium">Sin integrantes</p>
    </div>
  )

  if (!expenses.length) return (
    <div className="border border-dashed border-stone-300 dark:border-stone-700 rounded-3xl p-10 text-center bg-white/40 dark:bg-stone-900/30">
      <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 17l4-4 3 3 5-7 6 8" stroke="currentColor" className="text-stone-700 dark:text-stone-300" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <p className="font-medium text-stone-950 dark:text-stone-50 tracking-tight">Aún no hay resultados</p>
      <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">Agregá gastos para ver quién le debe a quién</p>
    </div>
  )

  const pending = txns.filter(t => !paidIds.has(`${t.from.id}>${t.to.id}>${t.amount}`))
  const maxAbs = Math.max(...members.map(m => Math.abs(bal[m.id] || 0)), 1)

  return (
    <div className="space-y-5">
      {/* Balance */}
      <section>
        <div className="flex items-baseline justify-between px-1 mb-2.5">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Balance</p>
          <p className="text-xs font-medium text-stone-400 dark:text-stone-500 tnum">{members.length} personas</p>
        </div>
        <div className="p-[3px] bg-stone-200/40 dark:bg-stone-700/25 rounded-[1.5rem] ring-1 ring-black/[0.04] dark:ring-white/[0.03]">
          <div className="bg-white dark:bg-stone-900 rounded-[1.35rem] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {members.map((m, i) => {
              const b = Math.round((bal[m.id] || 0) * 100) / 100
              const pos = b > 0.01, neg = b < -0.01
              const isMe = m.id === userId
              const pct = (Math.abs(b) / maxAbs) * 100
              return (
                <div key={m.id} className={`px-4 py-3.5 ${i < members.length - 1 ? 'border-b border-stone-100 dark:border-stone-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={m.display_name} color={m.avatar_color} src={m.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-stone-950 dark:text-stone-50 truncate tracking-tight text-sm">
                          {m.display_name}{isMe && <span className="text-stone-400 dark:text-stone-500 font-normal"> · vos</span>}
                        </p>
                        <p className={`text-sm font-semibold tnum flex-shrink-0 ${pos ? 'text-emerald-700 dark:text-emerald-500' : neg ? 'text-red-600 dark:text-red-400' : 'text-stone-400 dark:text-stone-500'}`}>
                          {pos ? '+' : neg ? '−' : ''}{fmt(Math.abs(b))}
                        </p>
                      </div>
                      {(pos || neg) && (
                        <div className="mt-1.5 h-1 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pos ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Personal summary */}
      {(() => {
        const iOwe = txns.filter(t => t.from.id === userId && !paidIds.has(`${t.from.id}>${t.to.id}>${t.amount}`))
        const owedToMe = txns.filter(t => t.to.id === userId && !paidIds.has(`${t.from.id}>${t.to.id}>${t.amount}`))
        const iOweTotal = iOwe.reduce((s, t) => s + t.amount, 0)
        const owedToMeTotal = owedToMe.reduce((s, t) => s + t.amount, 0)
        if (!iOweTotal && !owedToMeTotal) return null
        return (
          <section className="grid grid-cols-2 gap-3">
            {iOweTotal > 0 ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-800/60 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-wider font-medium text-red-500 dark:text-red-400">Debés</p>
                <p className="text-xl font-semibold text-red-700 dark:text-red-400 tnum mt-1">{fmt(iOweTotal)}</p>
                <p className="text-xs text-red-400 dark:text-red-500 mt-0.5">a {iOwe.length} persona{iOwe.length !== 1 ? 's' : ''}</p>
              </div>
            ) : <div />}
            {owedToMeTotal > 0 ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-wider font-medium text-emerald-600 dark:text-emerald-400">Te deben</p>
                <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-500 tnum mt-1">{fmt(owedToMeTotal)}</p>
                <p className="text-xs text-emerald-500 mt-0.5">{owedToMe.length} persona{owedToMe.length !== 1 ? 's' : ''}</p>
              </div>
            ) : <div />}
          </section>
        )
      })()}

      {/* Transactions */}
      <section>
        <div className="flex items-baseline justify-between px-1 mb-2.5">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            {txns.length === 0 ? 'Saldado' : 'Pagos sugeridos'}
          </p>
          <div className="flex items-center gap-3">
            {paidIds.size > 0 && (
              <button onClick={resetPaid} className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 transition-colors">
                Resetear
              </button>
            )}
            <button
              onClick={exportSummary}
              className="text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 flex items-center gap-1 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Exportar
            </button>
          </div>
        </div>

        {txns.length === 0 ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7L6 11L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-400 tracking-tight">Todos al día</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-500">Los gastos están equilibrados</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3 px-1">
              <span className="font-medium text-stone-950 dark:text-stone-50 tnum">{pending.length}</span> {pending.length === 1 ? 'transferencia pendiente' : 'transferencias pendientes'} · tocá para marcar como pagado
            </p>
            <div className="space-y-2">
              {txns.map(t => {
                const key = `${t.from.id}>${t.to.id}>${t.amount}`
                const isPaid = paidIds.has(key)
                const involvesMe = t.from.id === userId || t.to.id === userId
                const fromIsMe = t.from.id === userId
                return (
                  <div
                    key={key}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isPaid
                        ? 'bg-stone-50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-800 opacity-50'
                        : involvesMe
                          ? 'bg-white dark:bg-stone-900 border-stone-950 dark:border-stone-400 shadow-card'
                          : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800/80'
                    }`}
                  >
                    <button
                      onClick={() => toggle(key)}
                      className="w-full text-left focus-ring rounded-2xl"
                    >
                      <div className="flex items-center gap-3 p-3.5">
                        <Avatar name={t.from.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-medium text-stone-950 dark:text-stone-50 tracking-tight truncate">{t.from.name}</span>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-stone-400 dark:text-stone-500 flex-shrink-0">
                              <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="font-medium text-stone-950 dark:text-stone-50 tracking-tight truncate">{t.to.name}</span>
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {isPaid ? '✓ Marcado pagado' : involvesMe ? (fromIsMe ? 'Vos pagás' : 'Te pagan') : 'Tocá para marcar'}
                          </p>
                        </div>
                        <Avatar name={t.to.name} size="sm" />
                        <p className={`font-semibold text-base tnum ml-1 flex-shrink-0 ${isPaid ? 'text-stone-400 line-through' : involvesMe ? 'text-stone-950 dark:text-stone-50' : 'text-stone-700 dark:text-stone-300'}`}>
                          {fmt(t.amount)}
                        </p>
                      </div>
                    </button>
                    {!isPaid && (
                      <div className="px-3.5 pb-3 flex items-center gap-3 justify-end">
                        {/* MP link: show when debtor is me and creditor has alias */}
                        {t.from.id === userId && (() => {
                          const creditor = members.find(m => m.id === t.to.id)
                          const alias = creditor?.payment_alias
                          return alias ? (
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(alias).catch(() => {})
                                toast.success(`Alias copiado — transferí ${fmt(t.amount)} a ${alias}`)
                              }}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#00b1ea] hover:text-[#0097cc] transition-colors"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.022 14.16l-2.961-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.795.426z"/>
                              </svg>
                              Copiar alias
                            </button>
                          ) : null
                        })()}
                        <button
                          onClick={() => sendWhatsApp(t)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#25D366] hover:text-[#128C7E] transition-colors"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Recordatorio
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Footer stats */}
      <section className="border-t border-stone-200/80 dark:border-stone-800/80 pt-4 mt-2">
        <dl className="grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wider font-medium text-stone-400 dark:text-stone-500">Total</dt>
            <dd className="text-base font-semibold text-stone-950 dark:text-stone-50 tnum mt-0.5">{fmt(total)}</dd>
          </div>
          <div className="border-x border-stone-200/80 dark:border-stone-800/80">
            <dt className="text-[10px] uppercase tracking-wider font-medium text-stone-400 dark:text-stone-500">Promedio</dt>
            <dd className="text-base font-semibold text-stone-950 dark:text-stone-50 tnum mt-0.5">{fmt(total / members.length)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider font-medium text-stone-400 dark:text-stone-500">Pagos</dt>
            <dd className="text-base font-semibold text-stone-950 dark:text-stone-50 tnum mt-0.5">{txns.length}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
