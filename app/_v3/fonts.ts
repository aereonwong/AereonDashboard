import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'

// 👉 v3's type: Studio Standard's Geist, played straight, with Geist Mono for
// every figure. Loaded only by the v3 shell and the media kits, so v1 and v2
// never download them. (Contact Sheet's and Flight HUD's faces left with those
// worlds on 3 Oct 2026.)

const geist = Geist({ subsets: ['latin'], variable: '--f-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--f-geist-mono', display: 'swap' })

// Instrument Serif: the Content Lab's headline face only — an editorial italic for the
// verdict, so the one sentence that matters reads like a magazine cover line. Not
// preloaded: only the Lab uses it, and swap keeps Geist in its place until it arrives.
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--f-serif', display: 'swap', preload: false })

export const v3Fonts = [geist, geistMono, serif].map(f => f.variable).join(' ')
