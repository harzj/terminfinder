'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationLoadingBar() {
  const pathname = usePathname()
  const previousPathname = useRef(pathname)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 700)
    return () => window.clearTimeout(timer)
  }, [pathname])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[130] pointer-events-none">
      <div className="mx-auto h-1 w-full max-w-[560px] overflow-hidden bg-transparent">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/80 shadow-[0_0_16px_rgba(59,130,246,0.45)]" />
      </div>
    </div>
  )
}
