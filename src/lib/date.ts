export function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

export function mondayIndex(jsDay: number) {
  // JS: 0=Sun..6=Sat -> Mon=0..Sun=6
  return (jsDay + 6) % 7
}

export function monthTitle(d: Date) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" })
}
