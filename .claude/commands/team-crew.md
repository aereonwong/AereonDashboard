---
description: "Write the joining message for your teammates — filled in with your real app link and bot name, ready to paste into WhatsApp."
---

# /team-crew — the message you send your team

You are running inside Claude Code, in the **owner's** Aereon Dashboard repo. The teammates don't
have Claude Code and never will — they just need to get in.

Your job: confirm 3 things, then write one message that can be pasted straight into WhatsApp.
**You are not setting anything up here** (that is `/team-owner`). You're writing the invite.

**How people get in on this install:** each person signs in to the web app with **their own
Google account**, after the owner has added that email on the Users page. There is no shared
passcode. The Telegram bot lets a person in by their numeric Telegram ID.

---

## VOICE

- Casual, direct, Malaysian energy.
- Every sentence on its own line. Blank line between sentences.
- The message you produce is for people who are NOT technical. No jargon at all: no "OAuth",
  "env", "deploy", "viewer role".

---

## 🔒 HARD RULES

- **Never put a passcode, a key, a token or a sign-in code in the message.** Not once, not "for
  convenience." A secret in a WhatsApp thread lives forever and gets screenshotted. If asked,
  say no in one line and explain that.
- **Never promise something that is switched off.** If the bot is paused or the daily message
  isn't scheduled, leave those parts out of the message.
- **Never send the message yourself.** You write it; the owner pastes it.
- **Never include another teammate's email or Telegram ID** in the message.

---

## FIRST, FIND WHAT YOU CAN YOURSELF

Don't ask for things you can look up.

- **Live app URL** — https://aereonwong.com (root `CLAUDE.md`, "Live"). Confirm with
  `.vercel/project.json` / `vercel ls --prod` if in doubt.
- **Business name** — `jarvis/config.ts` (`businessName`); if empty, use the root `CLAUDE.md`.
- **Bot handle** — root `CLAUDE.md`, "Telegram bot".
- **Is the bot on?** — root `CLAUDE.md` says whether it is paused. **Is the daily message
  scheduled?** — `vercel.json` has a `/api/cron-daily` line or it doesn't.

Show what you found and ask if it's right, rather than asking cold.

---

## THE 3 QUESTIONS

### Q1 — Confirm the link
> "This is your live app link — right?
>
> `<the URL you found>`"

### Q2 — The bot
> "Are they getting the Telegram bot too, or just the app?
>
> And is this still the bot — `@<handle you found>`?"

### Q3 — Look or change
> "Will they just be looking, or changing things too?"

Looking only → the message says "you can see everything, you can't change anything — that's on
purpose." Changing → leave that line out.

---

## THEN WRITE THE MESSAGE

Output it in ONE code block so it copies in one tap. Use the real business name, link and bot
handle. Include block 3 only if they get the bot **and** the bot is on; include the "every
morning" paragraph only if the daily message is scheduled.

```
Hey — you're getting access to our <business name> dashboard.

Takes 2 minutes, all on your phone. No apps to install.

1️⃣ Send me the Google email you want to sign in with (your Gmail is fine).
   I'll add it on my side. Nothing works until I've done that.

2️⃣ Once I say you're in: open <their URL> on your phone.
   Tap "Sign in with Google" and pick that same account.
   Then Share → Add to Home Screen. Now it's an app icon.

3️⃣ For the bot: open Telegram, search @userinfobot, press Start.
   It replies with a number. Send me that number.
   (That's what lets our bot talk to you and not to strangers.)
   When I say go, search @<their bot> and message it: who are you?
   That chat is private to you. Try: what needs my attention today?

From tomorrow morning our group gets one message a day — something like
"RM8,400 overdue across 3 invoices" — with ✅ Approve and ❌ Reject buttons.

Whoever sees it first, handles it. If someone already tapped it you'll get
"already handled" — that's normal, not a bug.

Don't understand something? Tap ❌ Reject and ask in the group.
Rejecting costs nothing. Approving something you didn't read can cost a customer.

It will never message our customers. That's not a setting — it's not in the code.
```

A good app-only, look-only message is just this:

```
Hey — you're getting access to our SY Creative dashboard.

Takes 2 minutes, all on your phone. No apps to install.

1️⃣ Send me the Google email you want to sign in with (your Gmail is fine).
   I'll add it on my side. Nothing works until I've done that.

2️⃣ Once I say you're in: open https://aereonwong.com on your phone.
   Tap "Sign in with Google" and pick that same account.
   Then Share → Add to Home Screen. Now it's an app icon.

You can see everything. You can't change anything — that's on purpose.
```

---

## FINISH LIKE THIS

> 📋 Copy that, send it to your team.
>
> 📧 When their Google emails come back, add each one on the **Users** page.
>
> ⏳ When their Telegram numbers come back, run **`/team-owner`** to add them to the bot.
