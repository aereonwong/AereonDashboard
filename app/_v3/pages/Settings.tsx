import type { Version } from '@/lib/v3/catalog'
import type { Site } from '@/lib/v3/site'
import DemoToggle from '@/app/_components/DemoToggle'
import AccountPanel from '../AccountPanel'
import { VersionPicker, Theme, LandingSwitch, AccentPicker } from '../SettingsControls'

// 👉 v3 Settings: what you actually change, in the order you change it.
export default function Settings({ version, site, demo }: { version: Version; site: Site; demo: boolean }) {
  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Settings</h1>
          <p className="v3-lede">Version, look and data are saved on this device. The public landing page is saved for everyone.</p>
        </div>
      </header>

      <div className="v3-grid">
        <AccountPanel />

        <section className="v3-panel v3-span-12" aria-labelledby="t-ver">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-ver">
              App version
            </h2>
            <p className="v3-panel-note">All three read the same records; only the layout changes</p>
          </div>
          <VersionPicker version={version} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-accent">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-accent">
              Colour theme
            </h2>
            <p className="v3-panel-note">Saved on this device · each has a light and a dark shade</p>
          </div>
          <AccentPicker />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-theme">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-theme">
              Light or dark
            </h2>
          </div>
          <Theme />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-data">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-data">
              Data
            </h2>
          </div>
          <p className="v3-panel-note" style={{ marginBottom: 'var(--space-4)' }}>
            Switch between your real business and a made-up one. It never writes to your records.
          </p>
          <DemoToggle initial={demo} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-land">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-land">
              Public landing page
            </h2>
            <p className="v3-panel-note">What anyone opening the site&rsquo;s address sees</p>
          </div>
          <LandingSwitch landing={site.landing} kit={site.kit} />
        </section>
      </div>
    </div>
  )
}
