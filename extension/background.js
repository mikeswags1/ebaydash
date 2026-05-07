const STORAGE_KEY = 'stackpilotFulfillmentPayload'
const LOG = (...a) => {
  try {
    console.info('[StackPilot bg]', ...a)
  } catch {
    /* ignore */
  }
}

LOG('service worker ready', 'v' + (chrome.runtime.getManifest()?.version || '?'))

async function fetchPayload(origin, token) {
  const base = origin.replace(/\/$/, '')
  const url = `${base}/api/fulfillment/payload?token=${encodeURIComponent(token)}`
  LOG('GET', url)
  const res = await fetch(url, { credentials: 'omit', cache: 'no-store' })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) {
    LOG('payload failed', res.status, data?.error)
    throw new Error(data?.error?.message || `Payload failed (${res.status})`)
  }
  const st = data.shipTo || {}
  LOG('payload ok', 'orderId=', data.orderId, 'keys=', Object.keys(st))
  return data
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'FETCH_FULFILL_PAYLOAD') {
    const { stackpilotOrigin, token } = msg
    LOG('message FETCH_FULFILL_PAYLOAD', stackpilotOrigin)
    ;(async () => {
      try {
        const payload = await fetchPayload(stackpilotOrigin, token)
        await chrome.storage.local.set({
          [STORAGE_KEY]: {
            fetchedAt: Date.now(),
            stackpilotOrigin,
            token,
            orderId: payload.orderId,
            legacyItemId: payload.legacyItemId,
            asin: payload.asin,
            amazonUrl: payload.amazonUrl,
            shipTo: payload.shipTo || {},
          },
        })
        sendResponse({ ok: true, payload })
      } catch (e) {
        LOG('FETCH_FULFILL_PAYLOAD error', e instanceof Error ? e.message : e)
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }

  if (msg?.type === 'GET_STORED_PAYLOAD') {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      sendResponse({ ok: true, stored: data[STORAGE_KEY] || null })
    })
    return true
  }

  if (msg?.type === 'REPORT_STATUS') {
    const { stackpilotOrigin, token, state, lastError } = msg
    const base = String(stackpilotOrigin || '').replace(/\/$/, '')
    if (!base || !token) {
      sendResponse({ ok: false, error: 'missing origin/token' })
      return
    }
    LOG('REPORT_STATUS', state, lastError || '')
    ;(async () => {
      try {
        const res = await fetch(`${base}/api/fulfillment/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, state, lastError: lastError || null }),
          credentials: 'omit',
          cache: 'no-store',
        })
        const data = await res.json().catch(() => null)
        sendResponse({ ok: res.ok && data?.ok, data })
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }

  return undefined
})
