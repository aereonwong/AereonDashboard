// 👉 Aereon's social channels, for the landing page and the media kits.
// Counts other than Instagram's were read off each public profile on 6 Oct 2026 until each
// platform has its own analytics; Instagram's comes live from the latest snapshot.
// Facebook shows only a rounded 30K and Xiaohongshu a 1,000+ bracket publicly;
// Xiaohongshu's 1.1K is Aereon's own figure.

export type Social = {
  key: 'instagram' | 'tiktok' | 'facebook' | 'threads' | 'youtube' | 'xhs'
  name: string
  handle: string
  url: string
  followers?: number
}

/** When the hand-typed counts were last checked — shown beside them. */
export const SOCIALS_AS_OF = '2026-10-06'

export const SOCIALS: Social[] = [
  { key: 'instagram', name: 'Instagram', handle: '@aereonwong', url: 'https://www.instagram.com/aereonwong/', followers: 53_000 },
  { key: 'tiktok', name: 'TikTok', handle: '@aereon.wong', url: 'https://www.tiktok.com/@aereon.wong', followers: 36_400 },
  { key: 'facebook', name: 'Facebook', handle: 'AereonAdventure', url: 'https://www.facebook.com/AereonAdventure/', followers: 30_000 },
  { key: 'threads', name: 'Threads', handle: '@aereonwong', url: 'https://www.threads.com/@aereonwong', followers: 9_699 },
  { key: 'xhs', name: 'Xiaohongshu', handle: 'RED', url: 'https://www.xiaohongshu.com/user/profile/63c313b40000000026011ec3', followers: 1_100 },
  { key: 'youtube', name: 'YouTube', handle: '@AereonWong', url: 'https://www.youtube.com/aereonwong', followers: 3_620 },
]

/** The channels with Instagram's live count swapped in when there is one. */
export function socials(igFollowers?: number): Social[] {
  return SOCIALS.map(s => (s.key === 'instagram' && igFollowers ? { ...s, followers: igFollowers } : s))
}

/** Follows added up across platforms. Someone who follows on two platforms counts
 *  twice, so this is "combined followers", never "people". */
export const combined = (list: Social[]) => list.reduce((t, s) => t + (s.followers ?? 0), 0)
