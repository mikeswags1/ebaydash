import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryRows, sql } from '@/lib/db'

export async function POST() {
  return NextResponse.json(
    { error: 'StackPilot is currently in private beta. New signups are not open yet.' },
    { status: 403 }
  )
}
