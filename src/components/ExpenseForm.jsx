import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'
import { fmt, genId, CATEGORIES } from '../lib/utils'
import { validateSplit } from '../lib/settlements'
import { toast } from './Toast'

const SPLIT_MODES = [
  { id: 'equal',       label: 'Igual',      hint: 'Mismo monto para todos' },
  { id: 'exact',       label: 'Exacto',     hint: 'Cada uno paga un monto fijo' },
  { id: 'percentage',  label: 'Por %',      hint: 'Asigná porcentajes' },
  { id: 'items',       label: 'Por ítems',  hint: 'Lo que pidió cada uno' },
  { id: 'consumption', label: 'Consumo',    hint: 'Proporcional a lo consumido' },
]

const TIP_PRESETS = [10, 15, 20]

export default function ExpenseForm({ members, expense, currentUserId, groupId, onSave, onClose }) {
  const [desc, setDesc]               = useState(expense?.description || '')
  const [amount, setAmount]           = useState(expense ? String(expense.split_data?._usd_amount ?? expense.amount) : '')
  const [paidBy, setPaidBy]           = useState(expense?.paid_by || currentUserId || members[0]?.id || '')
  const [splitType, setSplitType]     = useState(expense?.split_type || 'equal')
  const [splitData, setSplitData]     = useState(expense?.split_data || { participants: members.map(m => m.id) })
  const [receiptUrl, setReceiptUrl]   = useState(expense?.receipt_url || '')
  const [receiptOpen, setReceiptOpen] = useState(!!expense?.receipt_url)
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  // Multi-currency
  const [currency, setCurrency]       = useState(expense?.split_data?._currency || 'ARS')
  const [exchangeRate, setExchangeRate] = useState(expense?.split_data?._exchange_rate || '')
  // Propina
  const [tipPct, setTipPct]           = useState(expense?.split_data?._tip_percent || 0)
  const [customTip, setCustomTip]     = useState(false)
  // Categoría
  const [category, setCategory]       = useState(expense?.split_data?._category || '')

  const rawAmt = parseFloat(amount) || 0
  const exchRate = parseFloat(exchangeRate) || 0
  const arsAmt = currency === 'USD' ? (exchRate > 0 ? rawAmt * exchRate : 0) : rawAmt
  const amtNum = Math.round(arsAmt * (1 + tipPct / 100) * 100) / 100

  const setParticipants = (participants) => setSplitData(d => ({ ...d, participants }))
  const toggleParticipant = (id) =>
    setParticipants(
      (splitData.participants || []).includes(id)
        ? (splitData.participants || []).filter(x => x !== id)
        : [...(splitData.participants || []), id]
    )

  const setAmounts = (amounts) => setSplitData(d => ({ ...d, amounts }))
  const setPercentages = (percentages) => setSplitData(d => ({ ...d, percentages }))
  const setConsumption = (consumption) => setSplitData(d => ({ ...d, consumption }))

  const distributeEqual = () => {
    if (!amtNum || !members.length) return
    const base = parseFloat((amtNum / members.length).toFixed(2))
    const amounts = {}
    members.forEach((m, i) => {
      amounts[m.id] = i === members.length - 1
        ? String(Math.round((amtNum - base * (members.length - 1)) * 100) / 100)
        : String(base)
    })
    setAmounts(amounts)
  }

  const distributeEqualPct = () => {
    if (!members.length) return
    const base = parseFloat((100 / members.length).toFixed(1))
    const pcts = {}
    members.forEach((m, i) => {
      pcts[m.id] = i === members.length - 1
        ? String(Math.round((100 - base * (members.length - 1)) * 10) / 10)
        : String(base)
    })
    setPercentages(pcts)
  }

  const addItem = () => setSplitData(d => ({
    ...d,
    items: [...(d.items || []), { id: genId(), desc: '', amount: '', assigned: [] }]
  }))

  const updateItem = (idx, field, val) => setSplitData(d => ({
    ...d,
    items: d.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
  }))

  const toggleItemAssigned = (idx, userId) => {
    const item = (splitData.items || [])[idx]
    if (!item) return
    const assigned = item.assigned.includes(userId)
      ? item.assigned.filter(x => x !== userId)
      : [...item.assigned, userId]
    updateItem(idx, 'assigned', assigned)
  }

  const removeItem = (idx) => setSplitData(d => ({
    ...d,
    items: d.items.filter((_, i) => i !== idx)
  }))

  const handleFileUpload = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${groupId || 'general'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    setUploading(true)
    try {
      const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      setReceiptUrl(data.publicUrl)
      toast.success('Ticket adjuntado')
    } catch (err) {
      toast.error(err?.message || JSON.stringify(err) || 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  const participants = splitData.participants || []
  const sharePerPerson = amtNum && participants.length ? amtNum / participants.length : 0

  const exactSum = Object.values(splitData.amounts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const exactDiff = Math.round((amtNum - exactSum) * 100) / 100

  const pctSum = Object.values(splitData.percentages || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const pctDiff = Math.round((100 - pctSum) * 10) / 10

  const itemsSum = (splitData.items || []).reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
  const itemsDiff = Math.round((amtNum - itemsSum) * 100) / 100

  const itemsPerPerson = {}
  members.forEach(m => itemsPerPerson[m.id] = 0)
  ;(splitData.items || []).forEach(it => {
    const assigned = (it.assigned || []).filter(id => id in itemsPerPerson)
    if (!assigned.length) return
    const share = (parseFloat(it.amount) || 0) / assigned.length
    assigned.forEach(id => { itemsPerPerson[id] = Math.round((itemsPerPerson[id] + share) * 100) / 100 })
  })

  const save = async () => {
    if (!desc.trim()) return toast.error('Falta una descripción')
    if (!rawAmt || rawAmt <= 0) return toast.error('Ingresá un monto')
    if (currency === 'USD' && exchRate <= 0) return toast.error('Ingresá el tipo de cambio')
    if (!amtNum || amtNum <= 0) return toast.error('El monto final no puede ser 0')
    if (!paidBy) return toast.error('¿Quién pagó?')
    const err = validateSplit(splitType, splitData, amtNum)
    if (err) return toast.error(err)
    setSaving(true)
    const extraData = {}
    if (currency === 'USD') { extraData._currency = 'USD'; extraData._usd_amount = rawAmt; extraData._exchange_rate = exchRate }
    if (tipPct > 0) extraData._tip_percent = tipPct
    if (category) extraData._category = category
    const payload = {
      description: desc.trim(),
      amount: amtNum,
      paid_by: paidBy,
      split_type: splitType,
      split_data: { ...splitData, ...extraData },
    }
    if (receiptUrl) payload.receipt_url = receiptUrl
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Descripción + Monto */}
      <div className="space-y-3">
        <input
          autoFocus
          className="w-full text-stone-950 dark:text-stone-50 font-medium text-lg tracking-tight bg-transparent border-0 border-b border-stone-200 dark:border-stone-700 px-0 py-2 focus:border-stone-950 dark:focus:border-stone-400 transition-colors"
          placeholder="¿En qué fue el gasto?"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          maxLength={100}
        />
        {/* Categoría */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(cat => cat === c.id ? '' : c.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                category === c.id
                  ? 'bg-stone-950 border-stone-950 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-950'
                  : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
              }`}
            >
              <span>{c.glyph}</span>
              <span>{c.id}</span>
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 font-medium text-2xl tracking-tight">{currency === 'USD' ? 'U$D' : '$'}</span>
            <input
              className="w-full pl-10 pr-0 py-2 text-stone-950 dark:text-stone-50 font-semibold text-3xl tracking-tightest bg-transparent border-0 border-b border-stone-200 dark:border-stone-700 focus:border-stone-950 dark:focus:border-stone-400 transition-colors tnum"
              placeholder="0"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          {/* Currency toggle */}
          <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 flex-shrink-0 mb-1">
            {['ARS', 'USD'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${currency === c ? 'bg-stone-950 dark:bg-stone-50 text-white dark:text-stone-950' : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Exchange rate (USD only) */}
        {currency === 'USD' && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-2">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex-shrink-0">Tipo de cambio</span>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
              <input
                type="number" inputMode="decimal" placeholder="Ej: 1250"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                className="w-full pl-5 pr-2 py-1 bg-white dark:bg-stone-800 border border-amber-200 dark:border-amber-800/60 rounded-lg text-sm font-medium text-stone-950 dark:text-stone-50 focus:border-amber-500 dark:focus:border-amber-500 transition-colors tnum"
              />
            </div>
            {rawAmt > 0 && exchRate > 0 && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex-shrink-0 tnum">= {new Intl.NumberFormat('es-AR').format(Math.round(rawAmt * exchRate))}</span>
            )}
          </div>
        )}

        {/* Propina */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTipPct(tipPct > 0 ? 0 : 10); setCustomTip(false) }}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${tipPct > 0 ? 'bg-stone-950 dark:bg-stone-50 text-white dark:text-stone-950 border-stone-950 dark:border-stone-50' : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'}`}
          >+ Propina</button>
          {tipPct > 0 && (
            <>
              {TIP_PRESETS.map(p => (
                <button key={p} onClick={() => { setTipPct(p); setCustomTip(false) }}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${tipPct === p && !customTip ? 'bg-stone-950 dark:bg-stone-50 text-white dark:text-stone-950' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
                >{p}%</button>
              ))}
              <button onClick={() => setCustomTip(c => !c)}
                className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${customTip ? 'bg-stone-950 dark:bg-stone-50 text-white dark:text-stone-950' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
              >Otro</button>
              {customTip && (
                <div className="relative w-16">
                  <input type="number" inputMode="decimal" placeholder="%" min="0" max="100"
                    value={tipPct || ''}
                    onChange={e => setTipPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg pl-2 pr-5 py-1 text-xs font-medium text-stone-950 dark:text-stone-50 tnum"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">%</span>
                </div>
              )}
              {amtNum > 0 && arsAmt > 0 && (
                <span className="text-xs text-stone-500 dark:text-stone-400 tnum ml-auto">= {new Intl.NumberFormat('es-AR').format(amtNum)}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quién pagó */}
      <Section label="Pagó">
        <div className="flex flex-wrap gap-2">
          {members.map(m => {
            const sel = paidBy === m.id
            return (
              <button
                key={m.id}
                onClick={() => setPaidBy(m.id)}
                className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${
                  sel
                    ? 'bg-stone-950 border-stone-950 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-950'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                }`}
              >
                <Avatar name={m.display_name} color={m.avatar_color} size="xs" />
                <span className="text-sm font-medium tracking-tight">{m.display_name}</span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* Tipo de división */}
      <Section label="División">
        <div className="grid grid-cols-2 gap-2">
          {SPLIT_MODES.map(m => {
            const sel = splitType === m.id
            return (
              <button
                key={m.id}
                onClick={() => setSplitType(m.id)}
                className={`text-left px-3.5 py-2.5 rounded-xl border transition-all ${
                  sel
                    ? 'bg-stone-950 border-stone-950 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-950'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                }`}
              >
                <div className="text-sm font-medium tracking-tight">{m.label}</div>
                <div className={`text-[11px] mt-0.5 ${sel ? 'text-stone-600 dark:text-stone-500' : 'text-stone-500 dark:text-stone-400'}`}>{m.hint}</div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── EQUAL ── */}
      {splitType === 'equal' && (
        <Section label="Entre quiénes">
          <div className="space-y-1">
            {members.map(m => {
              const isIn = participants.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleParticipant(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isIn ? 'bg-stone-100 dark:bg-stone-800' : 'hover:bg-stone-50 dark:hover:bg-stone-800/60'
                  }`}
                >
                  <CheckBox checked={isIn} />
                  <Avatar name={m.display_name} color={m.avatar_color} size="sm" />
                  <span className="text-sm font-medium text-stone-950 dark:text-stone-50 tracking-tight">{m.display_name}</span>
                  {isIn && sharePerPerson > 0 && (
                    <span className="ml-auto text-xs font-medium text-stone-600 dark:text-stone-400 tnum">{fmt(sharePerPerson)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── EXACT ── */}
      {splitType === 'exact' && (
        <Section
          label="Monto por persona"
          action={<button onClick={distributeEqual} className="text-xs text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 font-medium">Distribuir igual</button>}
        >
          <div className="space-y-1.5">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-1">
                <Avatar name={m.display_name} color={m.avatar_color} size="sm" />
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300 flex-1 truncate tracking-tight">{m.display_name}</span>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                  <input
                    type="number" inputMode="decimal" placeholder="0"
                    value={(splitData.amounts || {})[m.id] || ''}
                    onChange={e => setAmounts({ ...(splitData.amounts || {}), [m.id]: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg pl-7 pr-2 py-1.5 text-sm font-medium text-right text-stone-950 dark:text-stone-50 focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors tnum"
                  />
                </div>
              </div>
            ))}
          </div>
          <SumIndicator
            ok={Math.abs(exactDiff) <= 0.01}
            current={fmt(exactSum)}
            target={fmt(amtNum)}
            message={Math.abs(exactDiff) <= 0.01 ? 'Cierra perfecto' : exactDiff > 0 ? `Faltan ${fmt(exactDiff)}` : `Sobran ${fmt(-exactDiff)}`}
          />
        </Section>
      )}

      {/* ── PERCENTAGE ── */}
      {splitType === 'percentage' && (
        <Section
          label="Porcentaje por persona"
          action={<button onClick={distributeEqualPct} className="text-xs text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 font-medium">Distribuir igual</button>}
        >
          <div className="space-y-1.5">
            {members.map(m => {
              const pct = parseFloat((splitData.percentages || {})[m.id]) || 0
              const myAmt = amtNum ? Math.round(amtNum * pct / 100 * 100) / 100 : 0
              return (
                <div key={m.id} className="flex items-center gap-3 px-1">
                  <Avatar name={m.display_name} color={m.avatar_color} size="sm" />
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300 flex-1 truncate tracking-tight">{m.display_name}</span>
                  {myAmt > 0 && <span className="text-xs text-stone-500 dark:text-stone-400 tnum">{fmt(myAmt)}</span>}
                  <div className="relative w-20">
                    <input
                      type="number" inputMode="decimal" placeholder="0" max="100"
                      value={(splitData.percentages || {})[m.id] || ''}
                      onChange={e => setPercentages({ ...(splitData.percentages || {}), [m.id]: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg pl-2 pr-6 py-1.5 text-sm font-medium text-right text-stone-950 dark:text-stone-50 focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors tnum"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">%</span>
                  </div>
                </div>
              )
            })}
          </div>
          <SumIndicator
            ok={Math.abs(pctDiff) <= 0.01}
            current={`${pctSum.toFixed(1)}%`}
            target="100%"
            message={Math.abs(pctDiff) <= 0.01 ? 'Suma 100%' : pctDiff > 0 ? `Faltan ${pctDiff.toFixed(1)}%` : `Sobran ${(-pctDiff).toFixed(1)}%`}
          />
        </Section>
      )}

      {/* ── ITEMS ── */}
      {splitType === 'items' && (
        <Section
          label="Ítems de la cuenta"
          action={
            <button onClick={addItem} className="text-xs text-stone-950 dark:text-stone-50 font-medium px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
              + Ítem
            </button>
          }
        >
          {!(splitData.items?.length) ? (
            <div className="border border-dashed border-stone-300 dark:border-stone-700 rounded-xl px-4 py-6 text-center bg-stone-50/40 dark:bg-stone-800/30">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Sin ítems aún</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                Ej: "Bife $3.000 → Nico", "Vino $4.500 → todos"
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(splitData.items || []).map((item, idx) => (
                <div key={item.id} className="bg-stone-50 dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 rounded-xl p-3 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      placeholder="Qué se pidió"
                      value={item.desc}
                      onChange={e => updateItem(idx, 'desc', e.target.value)}
                      className="flex-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-950 dark:text-stone-50 focus:border-stone-950 dark:focus:border-stone-400 transition-colors"
                    />
                    <div className="relative w-24 flex-shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                      <input
                        type="number" inputMode="decimal" placeholder="0"
                        value={item.amount}
                        onChange={e => updateItem(idx, 'amount', e.target.value)}
                        className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg pl-6 pr-2 py-1.5 text-sm font-medium text-right text-stone-950 dark:text-stone-50 focus:border-stone-950 dark:focus:border-stone-400 transition-colors tnum"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex-shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 4h10M5 4V2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V4M3.5 4l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-medium mb-1.5">Quién lo consumió</p>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map(m => {
                        const isIn = (item.assigned || []).includes(m.id)
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleItemAssigned(idx, m.id)}
                            className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                              isIn
                                ? 'bg-stone-950 border-stone-950 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-950'
                                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                            }`}
                          >
                            <Avatar name={m.display_name} color={m.avatar_color} size="xs" />
                            <span className="tracking-tight">{m.display_name}</span>
                          </button>
                        )
                      })}
                    </div>
                    {item.assigned?.length > 1 && parseFloat(item.amount) > 0 && (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5 tnum">
                        {fmt(parseFloat(item.amount) / item.assigned.length)} c/u entre {item.assigned.length}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {splitData.items?.length > 0 && (
            <>
              <SumIndicator
                ok={Math.abs(itemsDiff) <= 0.01}
                current={fmt(itemsSum)}
                target={fmt(amtNum)}
                message={Math.abs(itemsDiff) <= 0.01 ? 'Coincide con el total' : itemsDiff > 0 ? `Faltan ${fmt(itemsDiff)}` : `Sobran ${fmt(-itemsDiff)}`}
              />
              {Object.values(itemsPerPerson).some(v => v > 0) && (
                <div className="bg-stone-50 dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 rounded-xl p-3 mt-3">
                  <p className="text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-medium mb-2">Resumen por persona</p>
                  <div className="space-y-1.5">
                    {members.filter(m => itemsPerPerson[m.id] > 0).map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Avatar name={m.display_name} color={m.avatar_color} size="xs" />
                        <span className="text-xs font-medium text-stone-700 dark:text-stone-300 flex-1 truncate">{m.display_name}</span>
                        <span className="text-xs font-semibold text-stone-950 dark:text-stone-50 tnum">{fmt(itemsPerPerson[m.id])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* ── CONSUMPTION ── */}
      {splitType === 'consumption' && (
        <Section label="¿Cuánto consumió cada uno?">
          <div className="space-y-1.5">
            {members.map(m => {
              const val = parseFloat((splitData.consumption || {})[m.id]) || 0
              const totalC = Object.values(splitData.consumption || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
              const pct = totalC > 0 ? Math.round(val / totalC * 100) : 0
              const share = totalC > 0 ? Math.round(amtNum * val / totalC * 100) / 100 : 0
              return (
                <div key={m.id} className="flex items-center gap-3 px-1">
                  <Avatar name={m.display_name} color={m.avatar_color} size="sm" />
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300 flex-1 truncate tracking-tight">{m.display_name}</span>
                  {val > 0 && amtNum > 0 && <span className="text-xs text-stone-400 dark:text-stone-500 tnum">{pct}% · {fmt(share)}</span>}
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      value={(splitData.consumption || {})[m.id] || ''}
                      onChange={e => setConsumption({ ...(splitData.consumption || {}), [m.id]: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg pl-7 pr-2 py-1.5 text-sm font-medium text-right text-stone-950 dark:text-stone-50 focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors tnum"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 px-1">Ingresá cuánto consumió cada persona. Se dividirá en proporción.</p>
        </Section>
      )}

      {/* ── TICKET ── */}
      <div className="border-t border-stone-100 dark:border-stone-800 pt-4">
        <button
          onClick={() => setReceiptOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-50 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <circle cx="6" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 6h3M10 8h2M10 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {receiptUrl ? 'Ticket adjuntado' : 'Adjuntar ticket'}
          {receiptUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`ml-auto transition-transform ${receiptOpen ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {receiptOpen && (
          <div className="mt-3 space-y-2.5">
            {/* File upload */}
            <label className="flex items-center gap-3 px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-stone-500 dark:text-stone-400 flex-shrink-0">
                <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{uploading ? 'Subiendo…' : 'Subir foto'}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">JPG, PNG, WEBP</p>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploading}
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </label>

            {/* Or URL */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 dark:text-stone-500 font-medium">URL</span>
              <input
                type="url"
                placeholder="https://..."
                value={receiptUrl}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || v.startsWith('https://')) setReceiptUrl(v)
                }}
                className="w-full pl-10 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-950 dark:text-stone-50 focus:border-stone-950 dark:focus:border-stone-400 focus:bg-white dark:focus:bg-stone-700 transition-colors"
              />
            </div>

            {/* Preview */}
            {receiptUrl && (
              <div className="relative">
                <img
                  src={receiptUrl}
                  alt="Ticket"
                  className="w-full rounded-xl object-cover max-h-40 border border-stone-200 dark:border-stone-700"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <button
                  onClick={() => setReceiptUrl('')}
                  className="absolute top-2 right-2 w-6 h-6 bg-stone-950/70 text-white rounded-full flex items-center justify-center hover:bg-stone-950 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex gap-2 pt-2 sticky bottom-0 bg-white dark:bg-[#1e1610]">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl bg-brick-600 dark:bg-brick-500 text-white font-medium tracking-tight hover:bg-brick-700 dark:hover:bg-brick-600 active:scale-[0.99] transition-all disabled:opacity-30"
        >
          {saving ? 'Guardando…' : expense ? 'Guardar' : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

function Section({ label, action, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">{label}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function CheckBox({ checked }) {
  return (
    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
      checked
        ? 'bg-stone-950 border-stone-950 dark:bg-stone-100 dark:border-stone-100'
        : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600'
    }`}>
      {checked && (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-white dark:text-stone-950">
          <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )
}

function SumIndicator({ ok, current, target, message }) {
  return (
    <div className={`mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm ${
      ok
        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60'
    }`}>
      <div className="flex items-center gap-2">
        {ok ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7L6 11L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7 4v4M7 10v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        )}
        <span className="font-medium">{message}</span>
      </div>
      <span className="font-semibold tnum text-xs">{current} / {target}</span>
    </div>
  )
}
