import { supabase, supabaseConfigured } from './supabase'

// 👉 One tiny key-value store for config that changes independently of code —
// a Drive folder id, an export format — so updating it is "change a value",
// not "open a PR". Reuses the `records` table (category: 'doc', a fixed
// `title` per key) rather than a new table to migrate; same trick already
// used by the invoice interview's draft storage in lib/invoice-intake.ts.

const titleFor = (key: string) => `setting:${key}`

/** Read a setting, or `fallback` if it's never been set (or Supabase is down). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!supabaseConfigured) return fallback
  const { data } = await supabase
    .from('records')
    .select('meta')
    .eq('category', 'doc')
    .eq('status', 'setting')
    .eq('title', titleFor(key))
    .limit(1)
  return (data?.[0]?.meta?.value as T) ?? fallback
}

/** Write a setting, creating its row the first time it's set. */
export async function setSetting(key: string, value: unknown): Promise<void> {
  if (!supabaseConfigured) return
  const { data } = await supabase
    .from('records')
    .select('id')
    .eq('category', 'doc')
    .eq('status', 'setting')
    .eq('title', titleFor(key))
    .limit(1)
  if (data?.[0]) {
    await supabase.from('records').update({ meta: { value } }).eq('id', data[0].id)
  } else {
    await supabase.from('records').insert({
      category: 'doc',
      status: 'setting',
      title: titleFor(key),
      amount: 0,
      notes: `App setting: ${key}`,
      meta: { value },
    })
  }
}
