'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Tab } from '../types'

type StepId = 'connect' | 'list' | 'fulfill'

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function GettingStartedChecklist({
  connected,
  hasOrders,
  hasAwaiting,
  onGo,
}: {
  connected: boolean
  hasOrders: boolean
  hasAwaiting: boolean
  onGo: (tab: Tab) => void
}) {
  const storageKey = 'stackpilot:getting_started:v1'
  const dismissKey = 'stackpilot:getting_started:dismissed:v1'
  const [dismissed, setDismissed] = useState(false)
  const [manual, setManual] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setDismissed(readLocal(dismissKey) === '1')
    const raw = readLocal(storageKey)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, boolean>
        setManual(parsed || {})
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    writeLocal(storageKey, JSON.stringify(manual))
  }, [manual])

  const steps = useMemo(() => {
    const connectDone = connected
    const listDone = Boolean(manual.list)
    const fulfillDone = Boolean(manual.fulfill)

    const doneCount = [connectDone, listDone, fulfillDone].filter(Boolean).length
    const total = 3

    const rows: Array<{
      id: StepId
      title: string
      done: boolean
      actionLabel: string
      action: () => void
    }> = [
      {
        id: 'connect',
        title: connectDone ? 'eBay connected' : 'Connect eBay',
        done: connectDone,
        actionLabel: connectDone ? 'Settings' : 'Connect',
        action: () => onGo('settings'),
      },
      {
        id: 'list',
        title: listDone ? 'Listed a product' : 'List your first product',
        done: listDone,
        actionLabel: listDone ? 'Mark un-done' : 'Start',
        action: () => {
          if (listDone) setManual((prev) => ({ ...prev, list: false }))
          else onGo('product')
        },
      },
      {
        id: 'fulfill',
        title: fulfillDone ? 'Fulfilled an order' : 'Fulfill an order',
        done: fulfillDone,
        actionLabel: fulfillDone ? 'Mark un-done' : hasAwaiting ? 'Ship' : 'Orders',
        action: () => {
          if (fulfillDone) setManual((prev) => ({ ...prev, fulfill: false }))
          else onGo(hasAwaiting ? 'fulfillment' : 'orders')
        },
      },
    ]

    return { doneCount, total, rows }
  }, [connected, hasAwaiting, manual.fulfill, manual.list, onGo])

  if (dismissed) return null

  return (
    <section className="gs-card" aria-label="Getting started">
      <div className="gs-card__head">
        <div>
          <div className="gs-card__title">Getting started</div>
          <div className="gs-card__sub">
            {steps.doneCount}/{steps.total} done
            {hasOrders ? ' · Orders synced' : ''}
          </div>
        </div>
        <button
          type="button"
          className="gs-card__dismiss"
          onClick={() => {
            setDismissed(true)
            writeLocal(dismissKey, '1')
          }}
          aria-label="Dismiss getting started"
        >
          Close
        </button>
      </div>

      <div className="gs-card__rows">
        {steps.rows.map((row) => (
          <div key={row.id} className="gs-row">
            <div className={`gs-row__check${row.done ? ' is-done' : ''}`} aria-hidden />
            <div className="gs-row__main">
              <div className="gs-row__title">{row.title}</div>
              {row.id !== 'connect' && !row.done ? (
                <button
                  type="button"
                  className="gs-row__mark"
                  onClick={() => setManual((prev) => ({ ...prev, [row.id]: true }))}
                >
                  Mark done
                </button>
              ) : null}
            </div>
            <button type="button" className="gs-row__action" onClick={row.action}>
              {row.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

