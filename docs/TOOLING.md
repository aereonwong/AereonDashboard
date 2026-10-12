# Tooling — motion, video, research

Moved from the root CLAUDE.md (12 Oct 2026). Skills are also listed in each session's skill index.

## Motion skills (installed 2 Oct 2026)

From https://github.com/kevinbadi/claude-motion-skills (an index of 16 packs by iart.ai, MIT).
Two packs copied into `.claude/skills/` — load on new chat start:

- **Web motion** (`iart-ai/web-animation-skills`): `gsap-web`, `micro-interaction`,
  `accessible-animation`, `svg-animation`, `lottie-animation`, `page-transition-animation`,
  `glassmorphism`, `ascii-animation`, `60fps-animation`.
- **Motion design** (`iart-ai/motion-design-skills`): `animation-principles`, `motion-art-direction`,
  `motion-background`, `color-motion`, `logo-animation`, `shot-composition`, `remotion-video`,
  `beat-sync-editing`, `after-effects`.

**Use them when implementing any animation, transition, hover/scroll effect or video in the app.**
Read the matching `SKILL.md` first, honour `prefers-reduced-motion` (`accessible-animation`), keep
animation to `transform`/`opacity` (`60fps-animation`), and follow the skill's render → screenshot →
check loop before claiming it works.

Ten more packs installed for content/video work (not dashboard UI) — read the matching `SKILL.md` first:

- **Short-form / YouTube:** `short-form-video`, `caption-animation`, `countdown-video`, `lower-thirds`,
  `audiogram`, `youtube-intro-outro`.
- **Ads / products:** `ad-creative-video`, `launch-video`, `testimonial-video`, `promo-video`,
  `product-demo-video`, `photo-slideshow`.
- **Data / explainers:** `chart-animation`, `animated-infographic`, `presentation-video`,
  `explainer-video`, `diagram-animation`, `isometric-animation`, `whiteboard-animation`, `wrapped-video`.
- **Maps / type / 3D:** `map-animation` (travel routes), `kinetic-typography`, `threejs-animation`,
  `shader-glsl`, `particle-system`.
- **Client work (SY Creative):** `creative-brief`, `brand-motion-guidelines`, `client-revisions`,
  `motion-pricing`, `video-delivery-specs`.

Skipped as niche: `text-message-video-skills`, `manim-skills`, `generative-illustration-skills`,
`javascript-animation-skills` — add with `npx skills add iart-ai/<pack-name>`.

## HyperFrames — HTML to MP4 video (installed 2 Oct 2026)

From https://github.com/heygen-com/hyperframes (HeyGen, Apache 2.0). Write HTML/CSS/GSAP, render
deterministic MP4. Installed as a user-scope Claude Code plugin (needs Node >= 22; this Mac has 24).

Install on a fresh machine or cloud session:

```bash
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
```

Use `/hyperframes:hyperframes` first — it routes to the right workflow (`product-launch-video`,
`motion-graphics`, `short-form` etc). Standalone skills alternative: `npx hyperframes skills update`.
Use it for any video/animation render in the app; follow render → preview → check before claiming done.

## Agent Reach — internet access for research (installed 2 Oct 2026)

From https://github.com/Panniantong/agent-reach (MIT). Reads web pages, YouTube, RSS, V2EX, Bilibili,
GitHub, plus Reddit/Facebook/Instagram/Twitter/LinkedIn once logged in. Skill is at
`~/.claude/skills/agent-reach`.

**Use it automatically** when Aereon asks to research, search or look something up online, or shares
a URL or names a platform (YouTube, Reddit, Instagram, X, Bilibili, LinkedIn, GitHub, RSS) — before
guessing or using plain WebFetch. Run `agent-reach doctor` to see which channels work right now.

Install on a fresh machine (python 3.10+ via uv; npm global folder must be user-writable):

```bash
uv tool install --python 3.12 https://github.com/Panniantong/agent-reach/archive/main.zip
agent-reach install --env=auto --system --channels=opencli
npm install -g --allow-scripts=@jackwener/opencli @jackwener/opencli mcporter
mcporter config add exa https://mcp.exa.ai/mcp --scope home
uv tool install "yt-dlp[default]"
```

OpenCLI (`opencli`) needs its Chrome "Browser Bridge" extension loaded (chrome://extensions →
Developer Mode → Load unpacked, from github.com/jackwener/opencli/releases) and Chrome logged in to
the site. Not connected yet as of 2 Oct 2026. Cookies/logins are Aereon's to provide — never type them.

<!-- BEGIN:nextjs-agent-rules -->

## Folder move (27 Sep 2026)
The project folder was renamed from `~/cashflowos-aereon` to `~/AereonDashboard`. A symlink at the old path
still points here so old references keep working; it can be deleted once nothing uses it.
