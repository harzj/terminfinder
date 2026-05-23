import Image from 'next/image'
import BottomNav from '@/components/BottomNav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="shrink-0 border-b border-border bg-background">
        <Image
          src="/header.png"
          alt="Terminfinder"
          width={1600}
          height={400}
          priority
          className="block h-auto w-full"
        />
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
