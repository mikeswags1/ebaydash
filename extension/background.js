function parseFulfillParamsFromUrl(urlString) {
  try {
    const url = new URL(urlString)
    const hash = (url.hash || '').replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const token = (params.get('fulfillToken') || '').trim()
    const stackpilotOrigin = (params.get('stackpilotOrigin') || '').trim()
    return token ? { token, stackpilotOrigin } : null
  } catch {
    return null
  }
}

async function fetchPayload({ stackpilotOrigin, token }) {
  const url = new URL('/api/fulfillment/payload', stackpilotOrigin)
  url.searchParams.set('token', token)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.ok === false) {
    const message = data?.error?.message || 'Failed to fetch fulfillment payload.'
    throw new Error(message)
  }
  await chrome.storage.local.set({
    stackPilotFulfillment: {
      shipTo: data.shipTo || {},
      orderId: data.orderId || '',
      savedAt: Date.now(),
    },
  })
  return data
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return
  const url = tab.url || changeInfo.url
  if (!url) return

  const parsed = parseFulfillParamsFromUrl(url)
  if (!parsed) return

  const { token, stackpilotOrigin: originFromHash } = parsed
  const stackpilotOrigin = originFromHash || ''
  if (!stackpilotOrigin) {
    console.warn('StackPilot fulfillment: missing stackpilotOrigin in URL hash — reinstall extension and use Fulfill from the dashboard.')
    return
  }

  try {
    const payload = await fetchPayload({ stackpilotOrigin, token })

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (args) => {
        window.__STACKPILOT_FULFILLMENT__ = args
      },
      args: [{ token, payload, stackpilotOrigin }],
    })

    await chrome.tabs.sendMessage(tabId, { type: 'STACKPILOT_FULFILL', token })
  } catch (error) {
    // Best-effort: surface error in console
    console.warn('StackPilot fulfillment autofill failed', error)
  }
})

