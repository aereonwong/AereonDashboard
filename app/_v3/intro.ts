// 👉 The landing intro, in Aereon's words (7 Oct 2026). The film's "Me" scene
// uses `chips` + `line`; the intro section under the film uses `lede`.
// `followersPlus` is the combined count across platforms (lib/socials.ts).

export type Intro = { chips: string[]; line: string; lede: string[] }

export const intro = (followersPlus: string): Intro => ({
  chips: ['Tech', 'Travel', 'Aerial', 'Events'],
  line: 'I cover what’s happening in Malaysia, review tech gadgets, share photography and videography tips and tricks, and make travel, car and drone content.',
  lede: [
    'Hi, I’m Aereon Wong.',
    'Product reviews · Car reviews · Hotels · Events · Aerial · Travel',
    `Based in Kuala Lumpur, with occasional travel reviews from Dubai, China, Singapore, Thailand, Indonesia and many more — sharing my experiences with ${followersPlus} followers across my social media.`,
  ],
})
