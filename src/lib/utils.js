export const genId = () => crypto.randomUUID()

export const genInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

// Money — keeps thousands separators, hides decimals when round
export const fmt = (n) => {
  const abs = Math.abs(n)
  const hasDec = Math.abs(abs - Math.round(abs)) > 0.005
  const str = abs.toLocaleString('es-AR', {
    minimumFractionDigits: hasDec ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `$${str}`
}

// Compact money — for very large numbers in tight spaces (eg "$1,2M")
export const fmtCompact = (n) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 10_000) return `$${Math.round(abs / 1000)}k`
  return fmt(n)
}

export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  const isYest = d.toDateString() === yest.toDateString()
  if (isToday) return 'Hoy'
  if (isYest) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export const CATEGORIES = [
  { id: 'Comida',      glyph: '🍝' },
  { id: 'Bebida',      glyph: '🍷' },
  { id: 'Transporte',  glyph: '🚖' },
  { id: 'Combustible', glyph: '⛽' },
  { id: 'Mercado',     glyph: '🛒' },
  { id: 'Alojamiento', glyph: '🏠' },
  { id: 'Entradas',    glyph: '🎟️' },
  { id: 'Café',        glyph: '☕' },
  { id: 'Postre',      glyph: '🍰' },
  { id: 'Delivery',    glyph: '📦' },
  { id: 'Playa',       glyph: '🏖️' },
  { id: 'Otro',        glyph: '◇' },
]

// Refined category icon — minimal SVG glyphs (kept emojis for fallback variety)
export const expCategory = (desc = '', override = null) => {
  if (override) {
    const c = CATEGORIES.find(c => c.id === override)
    if (c) return { glyph: c.glyph, label: c.id }
  }
  const d = desc.toLowerCase()
  if (/pizza|comida|cena|almuerzo|restaurant|resto|sushi|hambur|parrilla|asado/.test(d)) return { glyph: '🍝', label: 'Comida' }
  if (/uber|taxi|remis|auto|viaje|cole|transfer/.test(d)) return { glyph: '🚖', label: 'Transporte' }
  if (/nafta|gasolina|combustible/.test(d)) return { glyph: '⛽', label: 'Combustible' }
  if (/birra|cerveza|fernet|trago|drink|bar|boliche|vino|gin|whisky/.test(d)) return { glyph: '🍷', label: 'Bebida' }
  if (/super|almacen|mercado|compra|fiambre|verdura/.test(d)) return { glyph: '🛒', label: 'Mercado' }
  if (/hotel|airbnb|alojamiento|hostel|cabaña|cabin/.test(d)) return { glyph: '🏠', label: 'Alojamiento' }
  if (/entrada|cine|show|evento|ticket|teatro|concierto/.test(d)) return { glyph: '🎟️', label: 'Entradas' }
  if (/cafe|coffee|desayuno|medialuna/.test(d)) return { glyph: '☕', label: 'Café' }
  if (/helado|postre|dulce/.test(d)) return { glyph: '🍰', label: 'Postre' }
  if (/delivery|pedidos|rappi/.test(d)) return { glyph: '📦', label: 'Delivery' }
  if (/playa|sol|pileta|bronceador/.test(d)) return { glyph: '🏖️', label: 'Playa' }
  return { glyph: '◇', label: 'Gasto' }
}

// Refined avatar palette — desaturated, harmonious
export const AVATAR_COLORS = [
  '#0c0a09', // ink
  '#7c2d12', // earth
  '#9a3412', // rust
  '#b45309', // amber
  '#3f6212', // moss
  '#065f46', // pine
  '#0e7490', // teal
  '#1e40af', // navy
  '#5b21b6', // plum
  '#9d174d', // wine
]
