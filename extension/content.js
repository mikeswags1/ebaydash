function getFulfillmentPayload() {
  const value = window.__STACKPILOT_FULFILLMENT__
  if (!value || typeof value !== 'object') return null
  return value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function setInputValue(el, value) {
  if (!el) return false
  el.focus()
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function findFirstInputByLabels(labelHints) {
  const inputs = Array.from(document.querySelectorAll('input, textarea'))
  const normalizedHints = labelHints.map((h) => String(h).toLowerCase())

  for (const el of inputs) {
    const aria = String(el.getAttribute('aria-label') || '').toLowerCase()
    const name = String(el.getAttribute('name') || '').toLowerCase()
    const id = String(el.getAttribute('id') || '').toLowerCase()
    const placeholder = String(el.getAttribute('placeholder') || '').toLowerCase()
    const combined = `${aria} ${name} ${id} ${placeholder}`
    if (normalizedHints.some((h) => combined.includes(h))) return el
  }
  return null
}

async function tryAutofillAddress(shipTo) {
  // This is intentionally heuristic. Amazon changes DOM frequently.
  // We attempt to fill obvious fields if present on the current page.
  const fullName = String(shipTo?.fullName || '').trim()
  const address1 = String(shipTo?.addressLine1 || '').trim()
  const address2 = String(shipTo?.addressLine2 || '').trim()
  const city = String(shipTo?.city || '').trim()
  const state = String(shipTo?.stateOrProvince || '').trim()
  const postal = String(shipTo?.postalCode || '').trim()
  const country = String(shipTo?.countryCode || '').trim()
  const phone = String(shipTo?.phoneNumber || '').trim()

  if (fullName) setInputValue(findFirstInputByLabels(['full name', 'name']), fullName)
  if (address1) setInputValue(findFirstInputByLabels(['address line 1', 'street address', 'address']), address1)
  if (address2) setInputValue(findFirstInputByLabels(['address line 2', 'apt', 'suite', 'unit']), address2)
  if (city) setInputValue(findFirstInputByLabels(['city', 'town']), city)
  if (state) setInputValue(findFirstInputByLabels(['state', 'province', 'region']), state)
  if (postal) setInputValue(findFirstInputByLabels(['zip', 'postal']), postal)
  if (phone) setInputValue(findFirstInputByLabels(['phone', 'mobile']), phone)

  // Country is usually a select; we don't force it here.
  void country

  await sleep(400)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'STACKPILOT_FULFILL') return

  const data = getFulfillmentPayload()
  if (!data?.payload?.shipTo) return

  void tryAutofillAddress(data.payload.shipTo)
})

