import { Geist, Geist_Mono } from 'next/font/google'

// 👉 v3's type: Studio Standard's Geist, played straight, with Geist Mono for
// every figure. Loaded only by the v3 shell and the media kits, so v1 and v2
// never download them. (Contact Sheet's and Flight HUD's faces left with those
// worlds on 3 Oct 2026.)

const geist = Geist({ subsets: ['latin'], variable: '--f-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--f-geist-mono', display: 'swap' })

export const v3Fonts = [geist, geistMono].map(f => f.variable).join(' ')
