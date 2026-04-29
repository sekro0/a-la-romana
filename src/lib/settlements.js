import { fmt } from './utils'

// Convierte split_data a mapa { userId: amountOwed }
export function computeSplits(expense, memberIds) {
  const { amount, paid_by, split_type, split_data } = expense
  const splits = {}
  memberIds.forEach(id => splits[id] = 0)

  if (split_type === 'equal') {
    const participants = (split_data.participants || []).filter(id => id in splits)
    if (!participants.length) return splits
    const share = amount / participants.length
    participants.forEach(id => splits[id] = Math.round(share * 100) / 100)

  } else if (split_type === 'exact') {
    Object.entries(split_data.amounts || {}).forEach(([id, v]) => {
      if (id in splits) splits[id] = parseFloat(v) || 0
    })

  } else if (split_type === 'percentage') {
    Object.entries(split_data.percentages || {}).forEach(([id, pct]) => {
      if (id in splits) splits[id] = Math.round(amount * (parseFloat(pct) || 0) / 100 * 100) / 100
    })

  } else if (split_type === 'items') {
    ;(split_data.items || []).forEach(item => {
      const assigned = (item.assigned || []).filter(id => id in splits)
      if (!assigned.length) return
      const share = (parseFloat(item.amount) || 0) / assigned.length
      assigned.forEach(id => splits[id] = Math.round((splits[id] + share) * 100) / 100)
    })

  } else if (split_type === 'consumption') {
    const totalConsumption = Object.values(split_data.consumption || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    if (totalConsumption > 0) {
      Object.entries(split_data.consumption || {}).forEach(([id, v]) => {
        if (id in splits) splits[id] = Math.round(amount * (parseFloat(v) || 0) / totalConsumption * 100) / 100
      })
    }
  }

  return splits
}

// Calcula balances netos y transacciones mínimas para saldar
export function calcSettlements(members, expenses) {
  const memberIds = members.map(m => m.id)
  const bal = {}
  memberIds.forEach(id => bal[id] = 0)

  expenses.forEach(exp => {
    if (!(exp.paid_by in bal)) return
    bal[exp.paid_by] = Math.round((bal[exp.paid_by] + exp.amount) * 100) / 100

    const splits = computeSplits(exp, memberIds)
    Object.entries(splits).forEach(([id, v]) => {
      if (id in bal) bal[id] = Math.round((bal[id] - v) * 100) / 100
    })
  })

  const debtors = members
    .filter(m => bal[m.id] < -0.01)
    .map(m => ({ ...m, b: bal[m.id] }))
    .sort((a, b) => a.b - b.b)

  const creditors = members
    .filter(m => bal[m.id] > 0.01)
    .map(m => ({ ...m, b: bal[m.id] }))
    .sort((a, b) => b.b - a.b)

  const txns = []
  while (debtors.length && creditors.length) {
    const deb = debtors[0], cred = creditors[0]
    const amount = Math.round(Math.min(-deb.b, cred.b) * 100) / 100
    if (amount > 0.01) txns.push({ from: { id: deb.id, name: deb.display_name }, to: { id: cred.id, name: cred.display_name }, amount })
    deb.b = Math.round((deb.b + amount) * 100) / 100
    cred.b = Math.round((cred.b - amount) * 100) / 100
    if (Math.abs(deb.b) < 0.01) debtors.shift()
    if (Math.abs(cred.b) < 0.01) creditors.shift()
  }

  return { txns, bal }
}

// Valida que un split_data sea correcto antes de guardar
export function validateSplit(splitType, splitData, totalAmount) {
  if (splitType === 'equal') {
    if (!splitData.participants?.length) return 'Seleccioná al menos una persona'
  } else if (splitType === 'exact') {
    const sum = Object.values(splitData.amounts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    if (Math.abs(sum - totalAmount) > 0.01) return `Los montos suman ${fmt(sum)}, pero el total es ${fmt(totalAmount)}`
  } else if (splitType === 'percentage') {
    const sum = Object.values(splitData.percentages || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
    if (Math.abs(sum - 100) > 0.01) return `Los porcentajes suman ${sum.toFixed(1)}%, deben sumar 100%`
  } else if (splitType === 'items') {
    if (!splitData.items?.length) return 'Agregá al menos un ítem'
    const unassigned = splitData.items.filter(it => !it.assigned?.length)
    if (unassigned.length) return 'Todos los ítems deben tener al menos una persona asignada'
    const sum = splitData.items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    if (Math.abs(sum - totalAmount) > 0.01) return `Los ítems suman ${fmt(sum)}, pero el total es ${fmt(totalAmount)}`
  } else if (splitType === 'consumption') {
    const vals = Object.values(splitData.consumption || {})
    if (!vals.some(v => parseFloat(v) > 0)) return 'Ingresá al menos un monto de consumo'
  }
  return null
}
