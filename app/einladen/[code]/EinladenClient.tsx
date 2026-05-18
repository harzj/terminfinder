'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

interface Props {
  groupName: string
  groupDescription: string | null
  inviteCode: string
}

export default function EinladenClient({ groupName, groupDescription, inviteCode }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">Du wurdest eingeladen!</CardTitle>
          <CardDescription>
            Tritt der Gruppe <strong>{groupName}</strong> bei
            {groupDescription && `: ${groupDescription}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href={`/registrieren?invite=${inviteCode}`} className={buttonVariants({ className: 'w-full' })}>
            Konto erstellen & beitreten
          </Link>
          <Link href={`/anmelden?invite=${inviteCode}`} className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            Bereits ein Konto? Anmelden
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
