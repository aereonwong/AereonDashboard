// Types for Instagram posts linked to invoices — plain data, safe for client components.

/** A post as stored on the invoice (`meta.ig_posts`): enough to show it even after
 *  it drops out of the latest 40 posts. */
export type LinkedPost = { id: string; permalink: string; timestamp: string; type: string; caption: string }
/** A post in the picker. */
export type PickPost = LinkedPost & { thumb?: string; reach?: number }
/** A linked post as Invoice Details shows it, with its latest stored reach. */
export type ShownPost = LinkedPost & { reach?: number }
