'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'

// 👉 Sub-meter writes. Entering a reading or a bill that already exists for the same unit/date (or bill
// date) replaces it, which is how a mistake is corrected. Rows are deleted from the tables on the page.

type Result = { ok: true } | { ok: false; error: string }

const num = (v: FormDataEntryValue | null, max = 100_000_000): number | null | 'bad' => {
  const s = String(v ?? '').replace(/[,\sRM]/gi, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n < max ? Math.round(n * 100) / 100 : 'bad'
}
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
const text = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max) || null
const missing = 'Run supabase/submeter.sql first (the Sub-meter page shows the one step).'

async function guard(propertyId: string): Promise<Result | null> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on — switch it off in Settings to record real figures.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const { data: loan } = await supabase.from('property_loan').select('id').eq('id', propertyId).maybeSingle()
  return loan ? null : { ok: false, error: 'Unknown property' }
}

const done = (error: { message: string } | null): Result => {
  revalidatePath('/property', 'layout')
  return error ? { ok: false, error: /does not exist|schema cache/.test(error.message) ? missing : error.message } : { ok: true }
}

/** One reading date, every unit at once: fields `unit`, `reading` and `tenant` come in matching sets; a blank reading skips that unit.
 *  The tenant is who the usage since the unit's previous reading is billed to. */
export async function addSubmeterReadings(form: FormData): Promise<Result> {
  const propertyId = String(form.get('property_id') ?? '')
  const blocked = await guard(propertyId)
  if (blocked) return blocked
  const date = String(form.get('read_on') ?? '')
  if (!isDate(date)) return { ok: false, error: 'Pick the date you read the meters' }
  const rateRaw = num(form.get('rate'), 10)
  if (rateRaw === 'bad' || rateRaw == null || rateRaw <= 0) return { ok: false, error: 'The rate must be an amount in RM per kWh, e.g. 0.50' }
  const units = form.getAll('unit').map(String)
  const values = form.getAll('reading')
  const tenants = form.getAll('tenant')
  const kinds = form.getAll('kind').map(String)
  const note = text(form.get('note'), 300)
  const rows: { property_id: string; unit: string; read_on: string; reading: number; rate: number | null; legacy: false; note: string | null; tenant_name?: string; kind?: string }[] = []
  for (let i = 0; i < units.length; i++) {
    const v = num(values[i] ?? null)
    if (v === 'bad') return { ok: false, error: `${units[i]}: type the meter reading, e.g. 7945` }
    if (v == null) continue
    const unit = units[i].trim().slice(0, 60)
    if (!unit) return { ok: false, error: 'Every reading needs a unit name' }
    // A meter only counts up: compare with the reading just before and just after this date.
    const [before, after] = await Promise.all([
      supabase.from('submeter_reading').select('reading, read_on').eq('property_id', propertyId).eq('unit', unit).lt('read_on', date).order('read_on', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('submeter_reading').select('reading, read_on').eq('property_id', propertyId).eq('unit', unit).gt('read_on', date).order('read_on').limit(1).maybeSingle(),
    ])
    if (before.data && v < Number(before.data.reading)) return { ok: false, error: `${unit}: ${v} is lower than the ${before.data.reading} read on ${before.data.read_on}. A meter only counts up — check the photo.` }
    if (after.data && v > Number(after.data.reading)) return { ok: false, error: `${unit}: ${v} is higher than the ${after.data.reading} read on ${after.data.read_on}.` }
    const tenant = text(tenants[i] ?? null, 80)
    const kind = kinds[i] === 'move_in' || kinds[i] === 'move_out' ? kinds[i] : 'reading'
    if (kind === 'move_in' && !tenant) return { ok: false, error: `${unit}: pick the tenant moving in` }
    // A move-in reading is a starting number, not a charge, so it carries no rate.
    rows.push({ property_id: propertyId, unit, read_on: date, reading: v, rate: kind === 'move_in' ? null : rateRaw, legacy: false, note, ...(tenant ? { tenant_name: tenant } : {}), ...(kind !== 'reading' ? { kind } : {}) })
  }
  if (!rows.length) return { ok: false, error: 'Type at least one meter reading' }
  // Every row says its kind, so re-typing a date as a regular reading also clears a mistaken move-in. Before the kind
  // column exists, plain readings still save without it.
  const typed = rows.map(r => ({ ...r, kind: r.kind ?? 'reading' }))
  const first = await supabase.from('submeter_reading').upsert(typed, { onConflict: 'property_id,unit,read_on' })
  if (first.error && /kind/.test(first.error.message) && rows.every(r => !r.kind)) return done((await supabase.from('submeter_reading').upsert(rows, { onConflict: 'property_id,unit,read_on' })).error)
  return done(first.error)
}

/** A TNB bill (issued on the 12th). kWh is what TNB billed; kW and kVARh are kept for reference. */
export async function addSubmeterBill(form: FormData): Promise<Result> {
  const propertyId = String(form.get('property_id') ?? '')
  const blocked = await guard(propertyId)
  if (blocked) return blocked
  const date = String(form.get('bill_date') ?? '')
  const amount = num(form.get('amount'))
  const kwh = num(form.get('kwh'))
  const kw = num(form.get('kw'))
  const kvarh = num(form.get('kvarh'))
  if (!isDate(date)) return { ok: false, error: 'Pick the date of the bill (the 12th)' }
  if (amount === 'bad' || amount == null) return { ok: false, error: 'Type the bill amount, e.g. 275.35' }
  if (kwh === 'bad' || kw === 'bad' || kvarh === 'bad') return { ok: false, error: 'kWh, kW and kVARh must be numbers' }
  return done(
    (await supabase.from('submeter_bill').upsert({ property_id: propertyId, bill_date: date, amount, kwh, kw, kvarh, note: text(form.get('note'), 300) }, { onConflict: 'property_id,bill_date' })).error,
  )
}

/** Re-tag who one reading's usage is billed to; a blank name clears it. */
export async function setReadingTenant(id: number, tenant: string): Promise<Result> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: 'Bad request' }
  return done((await supabase.from('submeter_reading').update({ tenant_name: tenant.trim().slice(0, 80) || null }).eq('id', id)).error)
}

/** Record when the tenant paid one reading's charge (null = not paid yet). With `earlier`, the same tenant's unpaid
 *  charges on the same unit before this reading are marked paid on the same date — for catching up on a backlog. */
export async function setReadingPaid(id: number, paidOn: string | null, earlier = false): Promise<Result & { marked?: number }> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: 'Bad request' }
  if (paidOn != null) {
    if (!isDate(paidOn)) return { ok: false, error: 'Pick the date the tenant paid' }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
    if (paidOn > today) return { ok: false, error: 'The payment date can’t be in the future' }
  }
  const { data: row, error } = await supabase.from('submeter_reading').select('property_id, unit, tenant_name, read_on').eq('id', id).maybeSingle()
  if (error) return done(error)
  if (!row) return { ok: false, error: 'Reading not found' }
  if (paidOn != null && paidOn < row.read_on) return { ok: false, error: `The payment date can’t be before the reading on ${row.read_on}` }
  const one = await supabase.from('submeter_reading').update({ paid_on: paidOn }).eq('id', id)
  if (one.error || !earlier || paidOn == null) return done(one.error)
  // The same charges the popup counted: this tenant, this unit, before this reading, unpaid, with a rate and a
  // charge above zero. Charges are worked out from consecutive readings, so the unit's first reading never qualifies.
  const all = await supabase.from('submeter_reading').select('id, read_on, reading, rate, tenant_name, paid_on').eq('property_id', row.property_id).eq('unit', row.unit).order('read_on')
  if (all.error) return done(all.error)
  const rows = all.data ?? []
  const ids = rows
    .filter((r, i) => i > 0 && r.read_on < row.read_on && r.paid_on == null && (r.tenant_name ?? null) === (row.tenant_name ?? null) && r.rate != null && (Number(r.reading) - Number(rows[i - 1].reading)) * Number(r.rate) > 0)
    .map(r => r.id)
  if (!ids.length) return done(null)
  const more = await supabase.from('submeter_reading').update({ paid_on: paidOn }).in('id', ids).select('id')
  const r = done(more.error)
  return r.ok ? { ok: true, marked: (more.data?.length ?? 0) + 1 } : r
}

async function remove(table: 'submeter_reading' | 'submeter_bill', id: number): Promise<Result> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: 'Bad request' }
  return done((await supabase.from(table).delete().eq('id', id)).error)
}

export async function deleteSubmeterReading(id: number): Promise<Result> {
  return remove('submeter_reading', id)
}

export async function deleteSubmeterBill(id: number): Promise<Result> {
  return remove('submeter_bill', id)
}
