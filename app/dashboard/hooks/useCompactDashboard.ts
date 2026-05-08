'use client'

import { useLayoutEffect, useState } from 'react'

/** Narrow viewport or installed PWA — simplified shell focused on listing + fulfillment. */
export function useCompactDashboard() {
  const [compact, setCompact] = useState(false)

  useLayoutEffect(() => {
    const mqWidth = window.matchMedia('(max-width: 820px)')
    const mqStandalone = window.matchMedia('(display-mode: standalone)')

    const update = () => {
      setCompact(mqWidth.matches || mqStandalone.matches)
    }

    update()
    mqWidth.addEventListener('change', update)
    mqStandalone.addEventListener('change', update)
    return () => {
      mqWidth.removeEventListener('change', update)
      mqStandalone.removeEventListener('change', update)
    }
  }, [])

  return compact
}
