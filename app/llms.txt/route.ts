import { llmsTxt } from '@/lib/agent-site'

// llms.txt — what this site is for and when an agent should use it (llmstxt.org format).
export function GET() {
  return new Response(llmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
