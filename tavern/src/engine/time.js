export function formatDuration(minutes, { short = true } = {}) {
  const safe = Math.max(0, Math.round(Number(minutes) || 0))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  const minuteLabel = short ? 'min' : 'minute'
  if (h <= 0) return `${m}${minuteLabel}`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}${minuteLabel}`
}
