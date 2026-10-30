# Voice-over — /voice

<!-- Moved out of the root CLAUDE.md on 30 Oct 2026 so it loads only when needed. Unchanged text. -->

## Voice-over (19 Oct 2026)

`/voice` (v3 Studio group): a script in Aereon's cloned voice. The BROWSER calls VoiceStudio on Aereon's Mac
(`http://127.0.0.1:3900`, `/health`, `/profiles`, `/generate`, `/transcribe`) — no server route, nothing stored, works only on that
Mac in Chrome with the VoiceStudio app open. VoiceStudio answers only origins in `OMNIVOICE_ALLOWED_ORIGINS`
(set with `launchctl setenv` before the app starts; keep its defaults `localhost:3901`, `tauri://…`, `app://voicestudio`
in the list). Recipe, tuned by ear, in `lib/voice-recipe.ts` (tested): profile `11673efe` "Aereon Wong v3", first
sentence = intro at speed 0.88, rest at 0.92, 32 steps, no `instruct` (VoiceStudio 0.5.6 rejects moods for clones);
parts are trimmed, volume-matched to the body and joined with a 0.22 s gap in the browser. To test locally, run the
app on port 3901 — VoiceStudio trusts that origin by default.
**Auto-check (20 Oct 2026):** "Check each take" (on by default) reads every part back with VoiceStudio's speech-to-text
and measures it (`judge()` in `lib/voice-recipe.ts`): words ≥ 85%, every `BRANDS` name heard right, pace 2.2–4.5
words/s on lines of 8+ words, no pause over 1.2 s, no clipping. Failed takes fold under "Didn't pass" with the reason.
`BRANDS`: `say` = spelling sent to the voice (KLCC → K-L-C-C, Aereon → Aerion — both picked by ear), `heard` = how speech-to-text writes it when said right
(it hears a good "Aereon" as "Arian"). Same rules and list as `~/Desktop/VoiceStudio/tools/check.py` + `brands.json`
(Claude skill `voice-over`) — change both together.
Sign-off, by ear (20 Oct 2026): "Alright, let's go!" or "So let's go!" — "So... let's go!" and CAPS "GO" sound unnatural.


