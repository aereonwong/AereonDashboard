# Privacy mode (money hidden on the server)

<!-- Moved out of the root CLAUDE.md on 30 Oct 2026 so it loads only when needed. Unchanged text. -->

- **Privacy mode — real money is hidden by default, on the SERVER** (13–17 Oct 2026, `lib/privacy.ts`): while hidden,
`getRecords()`, `readProperty()`, `readSubmeter()`, the paid-reach read and `/approvals` multiply every amount by one
secret factor (0.35–0.95, fixed per signed-in person: HMAC of who under the session secret, so reloads can't average it away) and blank money in free text, so no real figure reaches the browser —
not in the HTML, not in DevTools — while charts, shares, rankings, growth and sentences stay true. Limit: proportions
are real, so knowing one exact amount would reveal that page's factor. Panels built on fixed money bands (Invoice
sizes, "Under 1K") show a `.v3-locked` card while hidden — any NEW absolute-threshold panel must do the same.
**Only the owner can show amounts** (`canRevealMoney()`: role owner — passcode, ADMIN_EMAILS, open door); for admins
and viewers the reveal cookie is ignored, the switch is locked, and money saves are refused.
Only signed-in app requests are gated: `proxy.ts` adds `x-cfo-money: gate`; the bot, crons and public pages never
carry it and read real figures. The switch is **"Show amounts"** (`MoneyToggle.tsx`): off/grey by default, green when
on; it sets cookie `cfo-reveal` (expiry ms, pushed forward by activity incl. mouse movement, 30 min idle) and reloads. Money-saving actions
and the invoice PDF routes refuse while hidden (a form drawn hidden holds disguised figures). On screen `MoneyMask.tsx`
draws amounts as `RM *****` (bare money numbers need `data-money`; `data-money-off` exempts); for the owner a click
on a figure or a `data-money-edit` control shows amounts. Any NEW loader that reads money must disguise it when
`moneyHidden()` is true.
