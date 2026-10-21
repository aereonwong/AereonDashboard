// Unit tests for the Expenses maths (lib/expenses-math.ts). Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  KINDS, applyExpenseFilters, byKind, byMonth, expensesCsv, monthlyRunRate, needsReceipt, parseExpenseFilters,
  receiptFilename, receiptState, summarise, topVendors, trips,
} from '../lib/expenses-math.ts'

const e = (over = {}) => ({
  id: 1, spent_on: '2026-10-05', kind: 'hotel', vendor: 'Trip.com', description: null, amount: 100, currency: 'MYR',
  original_amount: null, paid_with: null, reference: null, trip: null, recurring: null, source: 'manual', source_ref: null,
  receipt: null, notes: null, ...over,
})
const TODAY = '2026-10-21'

test('every kind has a label', () => assert.equal(KINDS.length, 8))

test('receipt state: missing, filed, waived, failed, and a stuck upload counts as failed', () => {
  const now = Date.parse('2026-10-21T10:00:00Z')
  assert.equal(receiptState(e(), now), 'missing')
  assert.equal(receiptState(e({ receipt: { status: 'filed', url: 'x' } }), now), 'filed')
  assert.equal(receiptState(e({ receipt: { status: 'waived' } }), now), 'waived')
  assert.equal(receiptState(e({ receipt: { status: 'uploading', started_at: '2026-10-21T09:59:00Z' } }), now), 'uploading')
  assert.equal(receiptState(e({ receipt: { status: 'uploading', started_at: '2026-10-21T09:00:00Z' } }), now), 'failed')
  assert.ok(needsReceipt(e(), now) && needsReceipt(e({ receipt: { status: 'failed' } }), now))
  assert.ok(!needsReceipt(e({ receipt: { status: 'waived' } }), now) && !needsReceipt(e({ receipt: { status: 'filed' } }), now))
})

test('filters: year defaults to this year, a month fixes its year, kind and receipt narrow', () => {
  assert.equal(parseExpenseFilters({}, TODAY).year, '2026')
  assert.equal(parseExpenseFilters({ year: 'all' }, TODAY).year, '')
  assert.equal(parseExpenseFilters({ month: '2025-03' }, TODAY).year, '2025')
  assert.equal(parseExpenseFilters({ kind: 'nope', month: 'x' }, TODAY).kind, '')
  const rows = [e({ id: 1 }), e({ id: 2, kind: 'flight', receipt: { status: 'filed' } }), e({ id: 3, spent_on: '2025-01-01' })]
  const f = (sp) => applyExpenseFilters(rows, parseExpenseFilters(sp, TODAY)).map(r => r.id)
  assert.deepEqual(f({}), [1, 2])
  assert.deepEqual(f({ year: 'all' }), [1, 2, 3])
  assert.deepEqual(f({ kind: 'flight' }), [2])
  assert.deepEqual(f({ receipt: 'missing', year: 'all' }), [1, 3])
  assert.deepEqual(f({ receipt: 'filed' }), [2])
  assert.deepEqual(applyExpenseFilters([e({ vendor: 'KLIA Ekspres', reference: 'AB12' })], parseExpenseFilters({ q: 'ab12' }, TODAY)).length, 1)
})

test('totals round to the sen and group by kind, vendor and trip', () => {
  const rows = [e({ amount: 34.6, kind: 'transport', vendor: 'KLIA Ekspres' }), e({ id: 2, amount: 34.6, kind: 'transport', vendor: 'KLIA Ekspres' }), e({ id: 3, amount: 531.16, trip: 'HK' })]
  const k = byKind(rows)
  assert.equal(k[0].kind, 'hotel')
  assert.equal(k.find(x => x.kind === 'transport').total, 69.2)
  assert.equal(topVendors(rows)[0].vendor, 'Trip.com')
  assert.equal(trips(rows)[0].trip, 'HK')
})

test('byMonth gives twelve months ending now, empty months included', () => {
  const m = byMonth([e({ spent_on: '2026-10-05', amount: 50 }), e({ id: 2, spent_on: '2025-11-30', amount: 25 })], TODAY, 12)
  assert.equal(m.length, 12)
  assert.equal(m[0].month, '2025-11')
  assert.equal(m[11].month, '2026-10')
  assert.equal(m[0].total, 25)
  assert.equal(m[5].total, 0)
})

test('summary: this year only, compared with the same stretch of last year, missing receipts counted', () => {
  const rows = [
    e({ id: 1, spent_on: '2026-03-01', amount: 200 }),
    e({ id: 2, spent_on: '2026-10-10', amount: 100, receipt: { status: 'filed' } }),
    e({ id: 3, spent_on: '2025-03-01', amount: 150 }),
    e({ id: 4, spent_on: '2025-12-01', amount: 999 }), // after this day last year: not in the comparison
  ]
  const s = summarise(rows, TODAY)
  assert.equal(s.ytd, 300)
  assert.equal(s.lastYtd, 150)
  assert.equal(s.thisMonth, 100)
  assert.deepEqual(s.missing, { count: 1, amount: 200 })
  assert.equal(summarise([e({ spent_on: '2024-01-01' })], TODAY).lastYtd, null)
})

test('subscription run rate: latest charge once per plan, yearly over 12, cancelled plans drop out', () => {
  const rows = [
    e({ id: 1, kind: 'subscription', vendor: 'Cloud', description: 'Storage', amount: 40, recurring: 'monthly', spent_on: '2026-08-10' }),
    e({ id: 2, kind: 'subscription', vendor: 'Cloud', description: 'Storage', amount: 49, recurring: 'monthly', spent_on: '2026-10-10' }),
    e({ id: 3, kind: 'subscription', vendor: 'Domain', description: 'aereon', amount: 120, recurring: 'yearly', spent_on: '2026-02-01' }),
    e({ id: 4, kind: 'subscription', vendor: 'Old tool', description: null, amount: 99, recurring: 'monthly', spent_on: '2026-03-01' }), // stopped
  ]
  assert.deepEqual(monthlyRunRate(rows, TODAY), { perMonth: 59, series: 2 })
})

test('CSV: header, one line per payment, quotes escaped, receipt link or "not needed"', () => {
  const csv = expensesCsv([e({ description: 'Hotel, "Grand"', amount: 12.5, receipt: { status: 'filed', url: 'https://d/x' } }), e({ id: 2, receipt: { status: 'waived' } })])
  const lines = csv.trim().split('\r\n')
  assert.equal(lines.length, 3)
  assert.ok(lines[0].startsWith('Date,Kind,Vendor'))
  assert.ok(csv.includes('"Hotel, ""Grand"""'))
  assert.ok(csv.includes('https://d/x') && csv.includes('not needed'))
})

test('receipt file names are safe and carry date, vendor, what and amount', () => {
  assert.equal(receiptFilename({ spent_on: '2026-10-15', vendor: 'Trip.com', description: 'Bali Bay/Urban: Haven', amount: 531.1 }, 'PDF'), '2026-10-15 - Trip.com - Bali Bay Urban Haven - RM 531.10.pdf')
  assert.equal(receiptFilename({ spent_on: '2026-10-15', vendor: 'KLIA', description: null, amount: 34.6 }, '.jpg'), '2026-10-15 - KLIA - RM 34.60.jpg')
})

test('CSV: text that starts like a formula is defused, numbers are left alone', () => {
  const csv = expensesCsv([e({ vendor: '=HYPERLINK("http://x")', description: '+cmd', amount: 5, reference: '@a', trip: '-b' })])
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`))
  assert.ok(csv.includes("'+cmd") && csv.includes("'@a") && csv.includes("'-b"))
  assert.ok(csv.includes(',5.00,'))
})

test('summary ignores rows dated after today, so the year-to-date compares like with like', () => {
  const s = summarise([e({ id: 1, spent_on: '2026-10-10', amount: 100 }), e({ id: 2, spent_on: '2026-12-20', amount: 900 })], TODAY)
  assert.equal(s.ytd, 100)
  assert.equal(s.count, 1)
})
