// Hash a string into a hue 0-359 for stable, varied colors per name
const hueFromString = (s = '') => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

const monogram = (name = '?') => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function Avatar({ name = '?', color, size = 'md', square = false }) {
  const sz = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }[size]

  const bg = color || `hsl(${hueFromString(name)} 65% 92%)`
  const fg = color
    ? '#ffffff'
    : `hsl(${hueFromString(name)} 60% 28%)`

  return (
    <div
      className={`${sz} ${square ? 'rounded-xl' : 'rounded-full'} flex items-center justify-center font-semibold flex-shrink-0 select-none tracking-tight`}
      style={{ background: bg, color: fg }}
    >
      {monogram(name)}
    </div>
  )
}
