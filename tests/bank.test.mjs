// Unit tests for the bank cash-flow maths (lib/bank-math.ts). Run: npm test. All names and figures are invented.
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPayeeRules, coverage, flowKind, ruleKey, invoiceCash, matchDeposits, medianDaysToPay, monthly, outByKind, refsIn, sameParty } from '../lib/bank-math.ts'

let n = 0
const t = (over = {}) => ({
  id: ++n, account: '0000', statement: '2026-10-13', seq: n, txn_date: '2026-10-01', amount: 1000, balance: null,
  type: 'Cr Adv-Interbank GIRO at KLM', party: 'ACME SDN BHD', note: null, description: '', kind: null, invoice_ids: null, ...over,
})
const inv = (over = {}) => ({ id: 1, no: 'SYCP-202609-001', date: '2026-09-10', client: 'Acme Sdn Bhd', amount: 1000, currency: 'MYR', paid: false, issued: false, quote: null, ...over })

test('refsIn reads invoice numbers however the payer typed them', () => {
  assert.deepEqual(refsIn('INV SYCP-202611-007 MD Payment'), ['SYCP202611007'])
  assert.deepEqual(refsIn('SYCP202611007'), ['SYCP202611007'])
  assert.deepEqual(refsIn('SYCP 202501 004 Brand App'), ['SYCP202501004'])
  assert.deepEqual(refsIn('SYCP-202503-002 OUR 100200300'), ['SYCP202503002']) // not "…002O"
  assert.deepEqual(refsIn('SYCP-202604-009A - Gadget Co'), ['SYCP202604009A'])
  assert.ok(refsIn('SYCP-2023- 91').includes('SYCP202391'))
  assert.ok(refsIn('Overseas trip SYCP202399').includes('SYCP202399'))
  assert.deepEqual(refsIn('INV 202512 005 INV 202512 005'), ['SYCP202512005'])
  assert.deepEqual(refsIn('50PCT 202608 021'), ['SYCP202608021'])
  assert.deepEqual(refsIn('SYCP-Q-202510-03'), ['SYCPQ20251003'])
  // a bank's own reference is not an invoice number, and a cut-off SWIFT reference matches nothing
  assert.deepEqual(refsIn('20260101HLBBMYKL010XYZ10000000'), [])
  assert.deepEqual(refsIn('11111/ S Y C P - 2 0 2 6 0 1 - 0 0 SHA 100200300'), [])
})

test('sameParty tolerates suffixes and the bank cutting names short', () => {
  assert.ok(sameParty('BRIGHTWAVE STUDIO SDN. BHD.', 'Brightwave Studio'))
  assert.ok(sameParty('NORTHPEAK MEDIA SDN. B', 'Northpeak Media Sdn Bhd'))
  assert.ok(!sameParty('ACME SDN BHD', 'Other Co Sdn Bhd'))
  assert.ok(!sameParty(null, 'Acme'))
})

test('flowKind sorts money in and out', () => {
  assert.equal(flowKind(t()), 'client')
  assert.equal(flowKind(t({ type: 'Interest', party: null })), 'interest')
  assert.equal(flowKind(t({ party: 'WONG SENG YUE', type: 'Fund Trf fr CA to CA-Internet' })), 'owner')
  assert.equal(flowKind(t({ amount: -500, party: 'WONG SENG YUE', note: 'Oct26 Salary' })), 'salary')
  assert.equal(flowKind(t({ amount: -500, party: 'WONG SENG YUE', note: 'Claims - Dec23' })), 'claims')
  assert.equal(flowKind(t({ amount: -10, type: 'Serv Charge-IBG/TT/Rentas/Misc' })), 'bank')
  assert.equal(flowKind(t({ amount: -300, type: 'FPX B2B1', party: 'PERTUBUHAN KESELAMATAN SOSIAL' })), 'statutory')
  assert.equal(flowKind(t({ amount: -800, party: 'SOME CREW', note: 'job' })), 'supplier')
  assert.equal(flowKind(t({ amount: -800, kind: 'rent' })), 'rent') // owner override wins
})

test('a deposit naming the invoice settles it, whatever the payer is called', () => {
  const { byInvoice } = matchDeposits([t({ party: 'AGENCY X', note: 'SYCP-202609-001', txn_date: '2026-10-05' })], [inv()])
  const s = byInvoice.get(1)
  assert.equal(s.full, true)
  assert.equal(s.how, 'reference')
  assert.equal(s.lastPaid, '2026-10-05')
})

test('payer + exact amount settles the oldest open invoice of that client', () => {
  const invoices = [inv({ id: 1, date: '2026-08-01' }), inv({ id: 2, no: 'SYCP-202609-002', date: '2026-09-01' })]
  const { byInvoice } = matchDeposits([t({ txn_date: '2026-09-20' }), t({ txn_date: '2026-10-20' })], invoices)
  assert.equal(byInvoice.get(1).lastPaid, '2026-09-20')
  assert.equal(byInvoice.get(2).lastPaid, '2026-10-20')
})

test('wrong amount or another client stays unmatched; a labelled deposit counts as part', () => {
  const none = matchDeposits([t({ amount: 999 }), t({ party: 'OTHER CO' })], [inv()])
  assert.equal(none.byInvoice.size, 0)
  const part = matchDeposits([t({ amount: 500, note: '50% deposit' })], [inv()])
  assert.equal(part.byInvoice.get(1).full, false)
  assert.equal(part.byInvoice.get(1).received, 500)
  const both = matchDeposits([t({ amount: 500, note: '50% deposit' }), t({ amount: 500, note: 'balance', txn_date: '2026-10-09' })], [inv()])
  assert.equal(both.byInvoice.get(1).full, true) // the balance equals what is still owed
})

test('the owner’s pick wins; [] means not an invoice payment', () => {
  const picked = matchDeposits([t({ party: 'NOBODY', amount: 1, invoice_ids: [1] })], [inv()])
  assert.equal(picked.byInvoice.get(1).how, 'owner')
  const notInv = matchDeposits([t({ invoice_ids: [] })], [inv()])
  assert.equal(notInv.byInvoice.size, 0)
  assert.deepEqual(notInv.byTxn.get(n), [])
})

test('a foreign-currency invoice is settled by any reference payment, never by amount', () => {
  const usd = inv({ currency: 'USD', amount: 300 })
  assert.equal(matchDeposits([t({ amount: 300 })], [usd]).byInvoice.size, 0)
  assert.equal(matchDeposits([t({ amount: 1290.5, note: '/INV/SYCP-202609-001 OUR 1' })], [usd]).byInvoice.get(1).full, true)
})

test('invoiceCash states and the median time to pay', () => {
  const invoices = [inv({ id: 1 }), inv({ id: 2, no: 'B', paid: true }), inv({ id: 3, no: 'C' }), inv({ id: 4, no: 'D', date: '2021-01-01' })]
  const { byInvoice } = matchDeposits([t({ note: 'SYCP-202609-001', txn_date: '2026-09-30' })], invoices)
  const list = invoiceCash(invoices, byInvoice, '2022-10-14')
  const st = Object.fromEntries(list.map(i => [i.id, i.state]))
  assert.deepEqual(st, { 1: 'paid-bank', 2: 'marked-only', 3: 'unpaid', 4: 'before-bank' })
  assert.equal(list.find(i => i.id === 1).daysToPay, 20)
  assert.equal(medianDaysToPay(list), 20)
})

test('monthly keeps revenue and cash apart, and an uncovered month has no balance', () => {
  const cov = coverage([{ from: '2026-09-01', to: '2026-09-30' }])
  const months = monthly(
    [t({ txn_date: '2026-09-15', amount: 400, balance: 1400 }), t({ txn_date: '2026-09-20', amount: -100, balance: 1300, party: 'CREW' })],
    [inv({ date: '2026-09-02', amount: 1000 }), inv({ id: 9, date: '2026-10-02', amount: 50, currency: 'USD' })],
    cov,
  )
  const sep = months.find(m => m.month === '2026-09')
  assert.deepEqual([sep.invoiced, sep.cashIn, sep.clientIn, sep.out, sep.net, sep.closing], [1000, 400, 400, 100, 300, 1300])
  assert.equal(months.find(m => m.month === '2026-10')?.invoiced ?? 0, 0) // USD never added into RM
})

test('outByKind totals money out only', () => {
  const k = outByKind([t({ amount: -100, party: 'CREW' }), t({ amount: -50, party: 'CREW2' }), t({ amount: 999 })])
  assert.deepEqual(k, [{ kind: 'supplier', label: 'Crew & suppliers', total: 150, count: 2 }])
})

test('a foreign-currency invoice paid by deposit note stays part-paid', () => {
  const usd = inv({ id: 77, no: 'SYCP-202601-009', currency: 'USD', amount: 500 })
  const dep = t({ note: 'SYCP-202601-009 50% deposit', amount: 1100 })
  assert.equal(matchDeposits([dep], [usd]).byInvoice.get(77)?.full, false)
  const all = t({ note: 'SYCP-202601-009', amount: 2200 })
  assert.equal(matchDeposits([all], [usd]).byInvoice.get(77)?.full, true)
})

test('monthly marks each month full, part or no statement', () => {
  const cov = coverage([{ from: '2026-09-01', to: '2026-10-13' }])
  const rows = monthly([t({ txn_date: '2026-09-05' }), t({ txn_date: '2026-10-02' })], [inv({ date: '2026-11-02' })], cov)
  assert.deepEqual(rows.map(m => [m.month, m.bank]), [['2026-09', 'full'], ['2026-10', 'part'], ['2026-11', 'none']])
})

test('payee rules: one per direction, a line own kind wins, names never hard-coded', () => {
  const lines = [
    { id: 1, amount: -100, party: 'ACME  holdings', kind: null, type: 'CIB', note: 'March', description: '' },
    { id: 2, amount: -100, party: 'Acme Holdings', kind: 'salary', type: 'CIB', note: '', description: '' },
    { id: 3, amount: 50, party: 'ACME HOLDINGS', kind: null, type: 'CIB', note: '', description: '' },
    { id: 4, amount: -10, party: null, kind: null, type: 'CIB', note: '', description: '' },
  ]
  const rules = { [ruleKey(lines[0])]: 'rent', 'in:ACME HOLDINGS': 'rent' } // an out-kind on an in-rule is ignored
  const out = applyPayeeRules(lines, rules)
  assert.equal(flowKind(out[0]), 'rent')
  assert.equal(out[0].ruled, true)
  assert.equal(flowKind(out[1]), 'salary') // its own kind wins
  assert.equal(out[1].ruled, undefined)
  assert.equal(flowKind(out[2]), 'client') // the rule's kind is for money going out
  assert.equal(flowKind(out[3]), 'supplier') // no payee, no rule
})

test('EPF by its full name counts as statutory', () => {
  assert.equal(flowKind({ amount: -500, type: 'FPX B2B1', party: 'KUMPULAN WANG SIMPANAN PEKERJA', note: '123', description: '' }), 'statutory')
})
