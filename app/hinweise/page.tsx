import Link from 'next/link'
import { legalMeta } from '@/lib/legal'

export const metadata = {
  title: 'Wichtige Hinweise | Terminfinder',
}

export default function HinweisePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Wichtige Hinweise</h1>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Nutzung der App</h2>
        <p>
          {legalMeta.appName} unterstuetzt bei der Terminabstimmung in Gruppen. Trotz sorgfaeltiger Entwicklung kann keine
          Gewaehr fuer staendige Verfuegbarkeit oder vollstaendige Fehlerfreiheit uebernommen werden.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Haftung fuer Inhalte</h2>
        <p>
          Die bereitgestellten Inhalte werden mit grosser Sorgfalt erstellt. Fuer die Richtigkeit, Vollstaendigkeit und
          Aktualitaet wird jedoch keine Gewaehr uebernommen.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Haftung fuer externe Links</h2>
        <p>
          Diese Website kann Verknuepfungen zu externen Diensten enthalten. Fuer deren Inhalte sind ausschliesslich die
          jeweiligen Betreiber verantwortlich.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Urheberrecht</h2>
        <p>
          Inhalte und Darstellungen auf dieser Website unterliegen dem geltenden Urheberrecht. Eine Nutzung ausserhalb
          der gesetzlichen Grenzen bedarf der vorherigen Zustimmung der Rechteinhaber.
        </p>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <p>Stand: {legalMeta.lastUpdated}</p>
        <p>Hinweis: Dies ist ein allgemeiner Mustertext und keine Rechtsberatung.</p>
      </section>

      <div className="pt-2 text-sm space-x-4">
        <Link className="underline underline-offset-2" href="/impressum">
          Impressum
        </Link>
        <Link className="underline underline-offset-2" href="/datenschutz">
          Datenschutz
        </Link>
      </div>
    </div>
  )
}
