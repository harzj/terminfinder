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
          {legalMeta.appName} unterstützt bei der Terminabstimmung in Gruppen. Trotz sorgfältiger Entwicklung kann keine
          Gewähr für ständige Verfügbarkeit oder vollständige Fehlerfreiheit übernommen werden.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Haftung für Inhalte</h2>
        <p>
          Die bereitgestellten Inhalte werden mit großer Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität wird jedoch keine Gewähr übernommen.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Haftung für externe Links</h2>
        <p>
          Diese Website kann Verknüpfungen zu externen Diensten enthalten. Für deren Inhalte sind ausschließlich die
          jeweiligen Betreiber verantwortlich.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Urheberrecht</h2>
        <p>
          Inhalte und Darstellungen auf dieser Website unterliegen dem geltenden Urheberrecht. Eine Nutzung außerhalb
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
