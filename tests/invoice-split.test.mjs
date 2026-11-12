// Unit tests for deposit + balance invoices (lib/invoice-split.ts). Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceBlock, balanceFigures, balanceLines, balanceOps, balanceRow, depositLines } from '../lib/invoice-split.ts'

const AT = { numberAndDate: 'N', qty: 'Q', lineAmount: 'A', subtotal: 'S', total: 'T', description: 'D' }
const lines = depositLines(2500, 30, 'MYR', '31 December 2026')

// SYCP-202610-004, as filed on 12 Nov 2026.
const deposit = {
  id: 1121,
  category: 'cash_in',
  status: 'waiting',
  amount: 750,
  meta: {
    invoice_no: 'SYCP-202610-004',
    invoice_date: '2026-10-23',
    job: 'AirAsia MOVE Campaign',
    customer: 'Super Creator Tech Pte Ltd',
    canva_design: 'DAHasXIYcI8',
    drive: { status: 'uploaded', file_id: 'x' },
    split: {
      part: 'deposit', percent: 30, contract_value: 2500, deposit_invoice: 'SYCP-202610-004', balance_invoice: null,
      terms_locator: 'TERMS', printed: { deposit: lines.deposit, balance: lines.balance },
    },
  },
}

test('deposit lines are the ones printed on SYCP-202610-004', () => {
  assert.equal(lines.contract, 'Contract value: MYR 2,500.00')
  assert.equal(lines.deposit, 'Deposit 30%: MYR 750.00 (payable on this invoice)')
  assert.equal(lines.balance, 'Balance 70%: MYR 1,750.00 (billed on a separate invoice, due by 31 December 2026)')
})

test('balance is contract minus deposit, and the two add up to the contract', () => {
  const f = balanceFigures(deposit)
  assert.equal(f.amount, 1750)
  assert.equal(f.percent, 70)
  assert.equal(f.amount + f.deposit, f.contract)
  // A third does not leave a cent behind.
  const third = { ...deposit, amount: 333.33, meta: { ...deposit.meta, split: { ...deposit.meta.split, percent: 33, contract_value: 1000 } } }
  assert.equal(balanceFigures(third).amount, 666.67)
})

test('only an open deposit with recorded lines can raise a balance', () => {
  assert.equal(balanceBlock(deposit), null)
  assert.match(balanceBlock({ ...deposit, meta: { ...deposit.meta, split: undefined } }), /Not a deposit/)
  assert.match(balanceBlock({ ...deposit, meta: { ...deposit.meta, split: { ...deposit.meta.split, balance_invoice: 'SYCP-202612-001' } } }), /already raised/)
  assert.match(balanceBlock({ ...deposit, meta: { ...deposit.meta, split: { ...deposit.meta.split, printed: undefined } } }), /split lines/)
  assert.match(balanceBlock({ ...deposit, meta: { ...deposit.meta, canva_design: undefined } }), /Canva/)
})

test('balance lines say whether the deposit was paid', () => {
  assert.equal(balanceLines(deposit).deposit, 'Less deposit (SYCP-202610-004): MYR 750.00')
  assert.equal(balanceLines(deposit).balance, 'Balance due 70%: MYR 1,750.00 (payable on this invoice)')
  const paid = { ...deposit, status: 'paid', meta: { ...deposit.meta, paid_on: '2026-11-20' } }
  assert.equal(balanceLines(paid).deposit, 'Less deposit paid (SYCP-202610-004) on 20/11/26: MYR 750.00')
})

test('Canva edits rewrite number, date, qty, amounts and the two split lines', () => {
  const ops = balanceOps(deposit, 'SYCP-202612-001', '2026-12-01', AT)
  const find = (loc, text) => ops.find(o => o.locator_id === loc && o.find_text === text)
  assert.equal(find('N', 'SYCP-202610-004').replace_text, 'SYCP-202612-001')
  assert.equal(find('N', 'Date: 23/10/26').replace_text, 'Date: 01/12/26')
  assert.equal(find('Q', '30%').replace_text, '70%')
  for (const loc of ['A', 'S', 'T']) assert.equal(find(loc, 'MYR 750.00').replace_text, 'MYR 1,750.00')
  assert.equal(find('TERMS', lines.deposit).replace_text, 'Less deposit (SYCP-202610-004): MYR 750.00')
  assert.equal(find('TERMS', lines.balance).replace_text, 'Balance due 70%: MYR 1,750.00 (payable on this invoice)')
  // The price cell (full contract) is left alone.
  assert.ok(!ops.some(o => o.locator_id === 'P'))
})

test('balance row keeps the client, drops the deposit payment and Drive state', () => {
  const row = balanceRow({ ...deposit, status: 'paid', meta: { ...deposit.meta, paid_on: '2026-11-20' } }, 'SYCP-202612-001', '2026-12-01', { id: 'DNEW', url: 'u' }, 'now')
  assert.equal(row.amount, 1750)
  assert.equal(row.status, 'waiting')
  assert.equal(row.meta.customer, 'Super Creator Tech Pte Ltd')
  assert.equal(row.meta.invoice_no, 'SYCP-202612-001')
  assert.equal(row.meta.drive, undefined)
  assert.equal(row.meta.paid_on, undefined)
  assert.equal(row.meta.payment_tracked, true)
  assert.equal(row.meta.canva_design, 'DNEW')
  assert.deepEqual(
    { part: row.meta.split.part, deposit: row.meta.split.deposit_invoice, balance: row.meta.split.balance_invoice },
    { part: 'balance', deposit: 'SYCP-202610-004', balance: 'SYCP-202612-001' },
  )
})

test('read-back check passes only when the balance really printed', async () => {
  const { balanceCheck, checkDrawn } = await import('../lib/invoice-split.ts')
  const check = balanceCheck(deposit, 'SYCP-202612-001', '2026-12-01')
  const el = t => ({ textRegions: [{ characters: t }] })
  const good = { page: { elements: [
    el('INVOICE No. SYCP-202612-001\nDate: 01/12/26'), el('70%'), el('MYR 1,750.00'),
    el('Contract value: MYR 2,500.00\nLess deposit (SYCP-202610-004): MYR 750.00\nBalance due 70%: MYR 1,750.00 (payable on this invoice)'),
  ] } }
  assert.equal(checkDrawn(good, check), null)
  // A find that matched nothing leaves the deposit's line in place.
  const stale = { page: { elements: [...good.page.elements, el(lines.deposit)] } }
  assert.match(checkDrawn(stale, check), /still printing/)
  assert.match(checkDrawn({ page: { elements: [el('INVOICE No. SYCP-202610-004')] } }, check), /missing/)
  assert.match(checkDrawn({}, check), /no text/)
  // Composio's copy of the tool names the text `text`.
  const viaText = { pages: [{ richtexts: good.page.elements.map(e => ({ regions: [{ text: e.textRegions[0].characters }] })) }] }
  assert.equal(checkDrawn(viaText, check), null)
})

test('an untracked deposit gives an untracked balance; a discounted one is refused', () => {
  const issued = { ...deposit, status: 'issued', meta: { ...deposit.meta, payment_tracked: false } }
  const row = balanceRow(issued, 'SYCP-202612-001', '2026-12-01', { id: 'DNEW', url: 'u' }, 'now')
  assert.equal(row.status, 'issued')
  assert.equal(row.meta.payment_tracked, false)
  assert.match(balanceBlock({ ...deposit, meta: { ...deposit.meta, discount: 100 } }), /discount/)
})
