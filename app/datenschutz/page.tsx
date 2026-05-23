import Link from 'next/link'
import { legalContact, legalMeta } from '@/lib/legal'

export const metadata = {
  title: 'Datenschutz | Terminfinder',
}

export default function DatenschutzPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Datenschutzhinweise</h1>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">1. Verantwortlicher</h2>
        <p>{legalContact.operatorName}</p>
        <p>
          E-Mail:{' '}
          <a className="underline underline-offset-2" href={`mailto:${legalContact.email}`}>
            {legalContact.email}
          </a>
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">2. Verarbeitete Daten</h2>
        <p>Bei der Nutzung der App können insbesondere folgende Daten verarbeitet werden:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Registrierungsdaten (z. B. E-Mail-Adresse, Anzeigename)</li>
          <li>Planungsdaten (Gruppen, Termine, Abstimmungs- und Verfügbarkeitsangaben)</li>
          <li>Technische Nutzungsdaten (z. B. Logdaten, Zeitstempel)</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">3. Zweck und Rechtsgrundlagen</h2>
        <p>Die Verarbeitung erfolgt zur Bereitstellung der Funktionen von {legalMeta.appName} und zur Erfüllung der Nutzungsbeziehung.</p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">4. Empfänger und Auftragsverarbeitung</h2>
        <p>Zur technischen Bereitstellung können externe Dienstleister eingesetzt werden (Hosting, Datenbank, E-Mail-Versand).</p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">5. Speicherdauer</h2>
        <p>Personenbezogene Daten werden nur so lange gespeichert, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen.</p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">6. Rechte betroffener Personen</h2>
        <p>Du hast grundsätzlich das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.</p>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <p>Stand: {legalMeta.lastUpdated}</p>
      </section>

      <div className="pt-2 text-sm">
        <Link className="underline underline-offset-2" href="/impressum">
          Zum Impressum
        </Link>
      </div>
    </div>
  )
}
