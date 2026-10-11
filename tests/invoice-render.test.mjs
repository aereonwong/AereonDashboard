// Unit tests for the invoice discount row's alignment. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOperations, printedLines } from '../lib/invoice-render.ts'

// Newlines the qty cell inserts between the line item's "1" and the discount's "1".
const gapOf = rec => {
  const op = buildOperations(rec).find(o => o.find_text === '1')
  return op ? op.replace_text.split('\n').length - 1 : 0
}

const rec = (deliverables, extra = {}) => ({
  title: 'x',
  amount: 2000,
  meta: {
    invoice_no: 'SYCP-202610-003',
    invoice_date: '2026-10-11',
    job: 'Drone Pilot & FPV Coverage',
    venue: 'Edu City Sports Complex, Johor',
    event_date_label: '3rd October 2026',
    event_time: '6PM to 11PM',
    list_price: 2300,
    discount: 300,
    deliverables,
    ...extra,
  },
})

test('word wrap matches what Canva printed on SYCP-202610-003', () => {
  assert.equal(printedLines('Drone pilot with normal drone + FPV coverage for the event', 46), 2)
  assert.equal(printedLines('All raw footage handed over to client (editing by client)', 46), 2)
  assert.equal(printedLines('2D1N hotel accommodation arranged by client', 46), 1)
  assert.equal(printedLines('Return transportation KL – Johor (RM300): Waived', 46), 2)
  assert.equal(printedLines('', 46), 1)
})

test('wrapped bullets push the discount row down (the SYCP-202610-003 case)', () => {
  const gap = gapOf(
    rec([
      'Drone pilot with normal drone + FPV coverage for the event',
      'All raw footage handed over to client (editing by client)',
      '2D1N hotel accommodation arranged by client',
      'Return transportation KL – Johor',
    ]),
  )
  // 4 head lines + blank + "Scope of Work:" + 2 + 2 + 1 + 1 — the gap fixed by hand on the live invoice.
  assert.equal(gap, 12)
})

test('short bullets keep the one-line-each gap', () => {
  assert.equal(gapOf(rec(['1 x IG Reel', '3 x IG Stories'])), 8)
  assert.equal(gapOf(rec(['1 x IG Reel'], { event_time: '-' })), 6)
})

test('no discount, no second qty line', () => {
  assert.equal(gapOf(rec(['1 x IG Reel'], { discount: 0 })), 0)
})
