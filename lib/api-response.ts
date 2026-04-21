import { NextResponse } from 'next/server'

type ApiErrorOptions = {
  status?: number
  code?: string
  details?: unknown
}

export function apiOk<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init)
}

export function apiError(message: string, options: ApiErrorOptions = {}) {
  const { status = 400, code, details } = options

  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        ...(code ? { code } : {}),
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  )
}

export function getErrorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}
