// 👉 Settings — how the app looks, and whether it shows your real business or a
// demo one. Appearance is per-device; demo mode is a cookie the server reads.
import { demoMode } from '@/lib/records'
import Appearance from '@/app/_components/Appearance'
import DemoToggle from '@/app/_components/DemoToggle'
import V3Settings from '@/app/_v3/pages/Settings'
import { readVersion, readIgView } from '@/lib/v3/version'
import { readSite } from '@/lib/v3/site'

export const dynamic = 'force-dynamic'

export default async function Settings() {
  const [demo, { version }, site, igView] = await Promise.all([demoMode(), readVersion(), readSite(), readIgView()])
  if (version === 'v3') return <V3Settings version={version} site={site} demo={demo} igView={igView} />
  return (
    <>
      <h1 className="ph">Settings ⚙️</h1>
      <p className="cap">Make it yours — colours, glass, and what data the tabs show.</p>

      <Appearance />

      <div className="set-section">
        <h2>Data</h2>
        <p className="sub">Switch the app between your real business and a made-up one.</p>
        <DemoToggle initial={demo} />
      </div>

      <div className="set-section">
        <h2>Good to know</h2>
        <p className="sub">
          Appearance is saved in this browser, so your phone and your Mac can look different. Demo mode is
          saved as a cookie for whoever is signed in on this device — it never changes what your Telegram
          bot or the 8:30am brief report, and it never writes to your database.
        </p>
      </div>
    </>
  )
}
