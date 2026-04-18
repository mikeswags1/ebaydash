import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt } = await req.json()

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant for eBay sellers. You help with pricing strategy, product research, and business analytics.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
    const data = await res.json()
    const result = data.choices?.[0]?.message?.content || 'No response'
    return NextResponse.json({ result })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
