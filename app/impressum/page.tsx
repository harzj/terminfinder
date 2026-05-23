import Link from 'next/link'
import { legalContact, legalMeta } from '@/lib/legal'

export const metadata = {
  title: 'Impressum | Terminfinder',
}

export default function ImpressumPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Impressum</h1>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Angaben gemaess Paragraph 5 TMG</h2>
        <p>{legalContact.operatorName}</p>
        <p>{legalContact.street}</p>
        <p>{legalContact.postalCode} {legalContact.city}</p>
        <p>{legalContact.country}</p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a className="underline underline-offset-2" href={`mailto:${legalContact.email}`}>
            {legalContact.email}
          </a>
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Verantwortlich fuer den Inhalt</h2>
        <p>{legalContact.operatorName}</p>
        <p>{legalContact.street}, {legalContact.postalCode} {legalContact.city}</p>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <p>App: {legalMeta.appName}</p>
        <p>Website: {legalMeta.appUrl}</p>
        <p>Stand: {legalMeta.lastUpdated}</p>
      </section>

      <div className="pt-2 text-sm">
        <Link className="underline underline-offset-2" href="/hinweise">
          Zu den wichtigen Hinweisen
        </Link>
      </div>
    </div>
  )
}
