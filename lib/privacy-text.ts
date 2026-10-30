// Pure text scrubbing for privacy mode (lib/privacy.ts) — no server imports, so tests can load it.

// "RM 1,234.50", "USD 2.5K", "$1,200", "HK$78", "€230" inside free text (titles, notes, meta strings).
// Text can't be scaled sensibly, so its money is blanked to 0 (the screen masks it as RM ***** anyway).
const MONEY_TEXT = /\b(RM|MYR|USD|SGD|EUR|RMB|CNY|GBP|AUD|JPY)\s?[-−]?\d[\d,]*(?:\.\d+)?[KkMm]?/g
const SYMBOL_TEXT = /((?:\b(?:US|S|HK|A|NZ|C))?\$|€|£|¥)\s?[-−]?\d[\d,]*(?:\.\d+)?[KkMm]?/g
export const scrubText = (s: string) => s.replace(MONEY_TEXT, '$1 0').replace(SYMBOL_TEXT, '$1 0')

// For notes and issue text, also: bare two-decimal amounts ("1,234.50"), comma-grouped
// thousands ("5,000"), and a bare number after a money word ("deposit 5000", "rent: 1800").
const TWO_DECIMALS = /\d[\d,]*\.\d{2}\b/g
const GROUPED = /\b\d{1,3}(?:,\d{3})+\b/g
const AFTER_WORD = /\b(deposit|rent|rental|paid|pay|fee|fees|price|cost|costs|balance|total|amount|owe|owes|owed|budget|loan|instal(?:l)?ment|salary)(\s*[:=]?\s*)\d[\d,]*(?:\.\d+)?(?![\w.])/gi
export const scrubAmounts = (s: string | null) =>
  s == null ? s : scrubText(s).replace(AFTER_WORD, '$1$20').replace(TWO_DECIMALS, '0.00').replace(GROUPED, '0')
