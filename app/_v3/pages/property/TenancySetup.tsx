import Icon from '@/app/_components/Icon'

// Shown on the Tenancy and Costs pages until supabase/tenancy.sql has been run (it is safe to run twice,
// so the same panel also asks for the upgrade when a newer version of the file adds columns).
export default function TenancySetup({ sql, sqlUrl }: { sql: string; sqlUrl: string | null }) {
  return (
    <section className="v3-panel" aria-labelledby="t-tenancy-setup">
      <div className="v3-panel-head">
        <h2 className="v3-panel-title" id="t-tenancy-setup">
          One step switches this on
        </h2>
      </div>
      <p className="v3-lede" style={{ marginTop: 0 }}>
        Paste this into Supabase&rsquo;s SQL editor and press Run. It only adds tables and columns and is safe to run again.
      </p>
      <pre className="v3-sql">{sql}</pre>
      {sqlUrl ? (
        <a className="v3-btn v3-btn-primary" href={sqlUrl} target="_blank" rel="noreferrer" style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}>
          Open the Supabase SQL editor <Icon name="external" />
        </a>
      ) : null}
    </section>
  )
}
