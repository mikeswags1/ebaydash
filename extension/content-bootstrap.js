/**
 * Runs at document_start — before Amazon's JS rewrites the URL — so fulfillToken / stackpilotOrigin
 * are still in the query string or hash when we message the background worker.
 */
;(function stackPilotFulfillEarly() {
  function readBootstrap(href) {
    try {
      const u = new URL(href)
      let token = u.searchParams.get('fulfillToken')
      let origin = u.searchParams.get('stackpilotOrigin')
      if (!token || !origin) {
        const h = u.hash.replace(/^#/, '')
        if (h) {
          const p = new URLSearchParams(h)
          token = p.get('fulfillToken')
          origin = p.get('stackpilotOrigin')
        }
      }
      if (!token || !origin) return null
      return { token: token.trim(), origin: origin.trim() }
    } catch {
      return null
    }
  }

  const b = readBootstrap(String(location.href || ''))
  if (!b) return
  try {
    chrome.runtime.sendMessage({
      type: 'FETCH_FULFILL_PAYLOAD',
      stackpilotOrigin: b.origin,
      token: b.token,
    })
  } catch {
    /* not in extension context */
  }
})()
