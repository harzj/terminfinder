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
        <p>Bei der Nutzung der App werden folgende Daten verarbeitet:</p>

        <h3 className="font-medium pt-1">Konto- und Profildaten</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>E-Mail-Adresse und Anzeigename (Registrierung und Anmeldung)</li>
          <li>BoardGameGeek-Benutzername und Spielesammlung (optional, nur bei Angabe)</li>
          <li>Bevorzugte Verfügbarkeitszeiten (optional)</li>
        </ul>

        <h3 className="font-medium pt-1">Planungsdaten</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gruppen, Terminvorschläge und Abstimmungsergebnisse</li>
          <li>Verfügbarkeitsangaben (Tage, Uhrzeiten, Status)</li>
        </ul>

        <h3 className="font-medium pt-1">Kalender-Integration (optional)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>ICS-Kalender-URLs, die du hinterlegst — diese können Authentifizierungstoken enthalten und werden in der Datenbank gespeichert</li>
          <li>Bei manuellem oder automatischem Kalenderimport: Ereignis-Titel und Zeitangaben aus deinem Kalender zur Berechnung von Verfügbarkeiten</li>
          <li>Beim Auto-Sync (Beta): tägliche automatische Verarbeitung der hinterlegten Kalender; Zeitstempel der letzten Synchronisierung sowie ein Fingerabdruck der importierten Ereignisse werden gespeichert</li>
          <li>Protokolleinträge der Auto-Sync-Aktionen (Datum, Aktion, Ereignis-Titel) zur Anzeige im Dashboard</li>
        </ul>

        <h3 className="font-medium pt-1">Push-Benachrichtigungen (optional)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Bei Aktivierung: technische Subscription-Daten (Endpunkt-URL, kryptographische Schlüssel gemäß Web-Push-Standard)</li>
        </ul>

        <h3 className="font-medium pt-1">Technische Daten</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Zeitstempel von Aktionen, Server-Logs der Infrastruktur</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">3. Zweck und Rechtsgrundlagen</h2>
        <p>
          Die Verarbeitung erfolgt ausschließlich zur Bereitstellung der Funktionen von {legalMeta.appName}
          (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO). Optionale Funktionen wie Kalender-Integration
          und Push-Benachrichtigungen werden nur auf ausdrückliche Aktivierung durch dich verarbeitet
          (Einwilligung, Art. 6 Abs. 1 lit. a DSGVO).
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">4. Externe Dienstleister (Auftragsverarbeitung)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase Inc.</strong> (USA) — Datenbank und Authentifizierung; Daten werden verschlüsselt gespeichert (AES-256); Standardvertragsklauseln gem. Art. 46 DSGVO</li>
          <li><strong>Vercel Inc.</strong> (USA) — Hosting und serverlose Funktionen; Standardvertragsklauseln gem. Art. 46 DSGVO</li>
          <li><strong>Resend Inc.</strong> (USA) — E-Mail-Versand (z. B. Einladungen, Passwort-Reset)</li>
          <li><strong>BoardGameGeek</strong> — öffentliche API-Abfragen für Spieledaten (nur bei hinterlegtem BGG-Nutzernamen)</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">5. Speicherdauer</h2>
        <p>
          Daten werden gelöscht, sobald sie für den jeweiligen Zweck nicht mehr benötigt werden oder du
          dein Konto löschst. Auto-Sync-Protokolleinträge werden nach 90 Tagen automatisch entfernt.
          Gesetzliche Aufbewahrungsfristen bleiben unberührt.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">6. Datensicherheit</h2>
        <p>
          Alle Verbindungen sind TLS-verschlüsselt. Daten in der Datenbank werden durch
          Verschlüsselung auf Infrastrukturebene (AES-256) geschützt. Der Zugriff auf eigene Daten
          wird durch Row-Level-Security auf Datenbankebene durchgesetzt.
          ICS-Kalender-URLs werden im Klartext gespeichert — wir empfehlen, nur URLs zu hinterlegen,
          die du bei Bedarf in deinem Kalender-Anbieter widerrufen kannst.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">7. Rechte betroffener Personen</h2>
        <p>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
          (Art. 21 DSGVO). Bei Einwilligungen kannst du diese jederzeit mit Wirkung für die Zukunft
          widerrufen (z. B. Kalender-Integration oder Push-Benachrichtigungen in den Profileinstellungen
          deaktivieren). Anfragen richtest du an:{' '}
          <a className="underline underline-offset-2" href={`mailto:${legalContact.email}`}>
            {legalContact.email}
          </a>.
          Du hast zudem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
        </p>
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
