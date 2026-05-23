This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Domain And Mail Setup

This app is being moved from personal mail/Gmail to a custom domain and Resend-based sending.

Recommended setup:

1. Use `lass-treffen.de` as the public brand domain.
2. Configure DNS for Resend:
	- SPF record
	- DKIM record(s)
	- DMARC record
3. Set Supabase Auth SMTP to the Resend SMTP credentials.
4. Set `NEXT_PUBLIC_SITE_URL` to the production app URL.
5. Use `RESEND_FROM_EMAIL` for all outgoing system mail, e.g. `Terminfinder <noreply@lass-treffen.de>`.

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SITE_URL=https://lass-treffen.de

RESEND_API_KEY=
RESEND_FROM_EMAIL="Terminfinder <noreply@lass-treffen.de>"
RESEND_REPLY_TO_EMAIL=
```

Planned notification types:

1. Neuer Termin zur Abstimmung
2. Erinnerung an Spieleabend
3. Jemand hat seine Meinung geändert

The code now contains a reusable Resend helper in [lib/email/resend.ts](lib/email/resend.ts) and starter templates in [lib/email/templates.ts](lib/email/templates.ts).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
