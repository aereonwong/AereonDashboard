// Loan maths, on made-up figures only (the repo is public).
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeLoan, validate } from '../lib/property-math.ts'

const loan = { id: 'x', name: 'X', location: null, bank: 'B', loan_type: null, rate_basis: 'BR', spread: 1, cycle_day: 5, loan_amount: null, tenure_months: null, first_month: '2024-01-01', notes: null, sort: 1 }
const rates = [{ bank: 'B', effective_date: '2020-01-01', base_rate: 3, sbr: null, source: null }]
const row = (month, outstanding, instalment = 1000) => ({ property_id: 'x', month, opening_balance: null, outstanding_balance: outstanding, instalment, interest_charged: null, status: 'normal', quality: 'statement', note: null })

test('a whole period inside a leap year divides by 366, and the rate stays the yearly rate', () => {
  const [, m] = computeLoan(loan, [row('2024-02-01', 100_000), row('2024-03-01', 99_500)], rates)
  assert.equal(m.days, 29)
  assert.equal(m.fullRate, Math.round((100_000 * 0.04 * 29 / 366) * 100) / 100)
  assert.equal(m.rate, 4)
})

test('an ordinary year divides by 365', () => {
  const [, m] = computeLoan(loan, [row('2025-02-01', 100_000), row('2025-03-01', 99_500)], rates)
  assert.equal(m.fullRate, Math.round((100_000 * 0.04 * 28 / 365) * 100) / 100)
  assert.equal(m.rate, 4)
})

test('a period across New Year uses each day its own year', () => {
  const [, m] = computeLoan(loan, [row('2024-12-01', 100_000), row('2025-01-01', 99_500)], rates)
  const want = 100_000 * 0.04 * (27 / 366 + 4 / 365)
  assert.equal(m.fullRate, Math.round(want * 100) / 100)
  assert.equal(m.rate, 4)
})

test('a cut mid-period weights the rate by days', () => {
  const r = [...rates, { bank: 'B', effective_date: '2025-07-15', base_rate: 2, sbr: null, source: null }]
  const [, m] = computeLoan(loan, [row('2025-07-01', 100_000), row('2025-08-01', 99_500)], r)
  assert.equal(m.rate, Math.round(((10 * 4 + 21 * 3) / 31) * 100) / 100)
})

test('paying above the full rate is not a negative saving, and it is still flagged', () => {
  const [, m] = computeLoan(loan, [row('2025-03-01', 100_000), row('2025-04-01', 100_000, 2000)], rates)
  assert.equal(m.interest, 2000)
  assert.equal(m.saved, 0)
  assert.ok(validate([m]).some(w => /above the full-rate/.test(w.msg)))
})

test('paying less than the full rate is a real saving', () => {
  const [, m] = computeLoan(loan, [row('2025-03-01', 100_000), row('2025-04-01', 99_900, 300)], rates)
  assert.equal(m.saved, Math.round((m.fullRate - 200) * 100) / 100)
})
