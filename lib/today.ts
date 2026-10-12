// Today as YYYY-MM-DD in MALAYSIA time — not the server's UTC date, which from midnight
// to 8am in KL is still yesterday. No imports, so client components can use it too.
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
