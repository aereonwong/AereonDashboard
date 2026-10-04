import Image from 'next/image'
import { googleConfigured } from '@/lib/google-auth'
import { passcodeLoginOn } from '@/lib/session'
import { v3Fonts } from '@/app/_v3/fonts'
import '@/app/_v3/v3.css'
import './login.css'
import LoginForm from './LoginForm'

// The lock screen, in Studio Standard: a KLCC photograph beside a quiet sign-in.
// Excluded from the gate in proxy.ts (you can't log in through a locked login page).
// Server wrapper: it knows which doors are open and passes that on.
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className={`v3 ${v3Fonts} lg`} data-world="canon">
      <aside className="lg-art" aria-hidden="true">
        <Image src="/img/klcc-merdeka.jpg" alt="" fill priority sizes="(max-width: 860px) 100vw, 60vw" className="lg-photo" />
        <div className="lg-art-copy">
          <p className="lg-kicker">Aereon Wong · Tech &amp; travel creator</p>
          <p className="lg-line">Invoices, clients and Instagram, in one private place.</p>
        </div>
      </aside>
      <section className="lg-pane">
        <div className="lg-box">
          <LoginForm google={googleConfigured()} passcode={passcodeLoginOn()} initialError={error ?? ''} />
        </div>
        <p className="lg-foot">Only approved accounts can sign in. <a href="/">Back to site</a></p>
      </section>
    </main>
  )
}
