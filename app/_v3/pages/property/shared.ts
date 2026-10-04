// Formatting and dates shared by the Property pages. No imports: usable from server and client components.

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const mon = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
export const monthName = (iso: string) => `${FULL[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
export const dmy = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
export const sen = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const rm = (n: number | null | undefined) => (n == null ? '—' : `RM ${sen(n)}`)
export const plural = (n: number, w: string) => `${n} ${n === 1 ? w : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`}`
/** Today's date in Malaysia (YYYY-MM-DD), not the server's. */
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
export const thisYear = () => today().slice(0, 4)
