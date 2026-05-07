import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError, apiOk, getErrorText } from '@/lib/api-response'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })

  let prompt = ''
  try {
    const body = await req.json().catch(() => ({}))
    prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  } catch {
    prompt = ''
  }

  if (!prompt) {
    return apiError('Prompt is required.', { status: 400, code: 'PROMPT_REQUIRED' })
  }

  if (prompt.length > 2400) {
    return apiError('Prompt is too long. Please shorten it and try again.', { status: 400, code: 'PROMPT_TOO_LONG' })
  }

  const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim()
  if (!apiKey) {
    return apiError('AI is not configured (missing OPENROUTER_API_KEY).', { status: 503, code: 'AI_NOT_CONFIGURED' })
  }

  const model = String(process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini').trim() || 'openai/gpt-4o-mini'

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant for eBay sellers. You help with pricing strategy, product research, and business analytics.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
    const data = await res.json()
    const result = data.choices?.[0]?.message?.content || 'No response'
    return apiOk({ result })
  } catch (e) {
    return apiError(getErrorText(e, 'AI request failed.'), { status: 500, code: 'AI_REQUEST_FAILED' })
  }
}
