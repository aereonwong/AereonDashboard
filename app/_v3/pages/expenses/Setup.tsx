import Icon from '@/app/_components/Icon'

// Shown on the Expenses pages until supabase/expenses.sql has been run (it is safe to run twice).
export default function ExpensesSetup({ sql, sqlUrl }: { sql: string; sqlUrl: string | null }) {
  return (
    <section className="v3-panel" aria-labelledby="t-expenses-setup">
      <div className="v3-panel-head">
        <h2 className="v3-panel-title" id="t-expenses-setup">
          One step switches Expenses on
        </h2>
      </div>
      <p className="v3-lede" style={{ marginTop: 0 }}>
        Paste this into Supabase&rsquo;s SQL editor and press Run. It only adds one table and is safe to run again.
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
