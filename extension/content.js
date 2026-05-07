const STORAGE_KEY = 'stackPilotFulfillment'
const STORAGE_TTL_MS = 15 * 60 * 1000
const BANNER_ID = 'stackpilot-fulfillment-banner'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFulfillmentPayload() {
  const value = window.__STACKPILOT_FULFILLMENT__
  if (!value || typeof value !== 'object') return null
  return value
}

async function getStoredShipTo() {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY)
    const entry = r[STORAGE_KEY]
    if (!entry?.shipTo || !entry.savedAt) return null
    if (Date.now() - entry.savedAt > STORAGE_TTL_MS) {
      await chrome.storage.local.remove(STORAGE_KEY)
      return null
    }
    return entry.shipTo
  } catch {
    return null
  }
}

function showBanner(text) {
  let el = document.getElementById(BANNER_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = BANNER_ID
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483646;padding:10px 16px;font:13px/1.4 system-ui,-apple-system,sans-serif;' +
      'background:linear-gradient(90deg,#0c4a6e,#0e7490);color:#ecfeff;border-bottom:1px solid #38bdf8;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.25)'
    document.documentElement.prepend(el)
  }
  el.textContent = text
}

function removeBanner() {
  document.getElementById(BANNER_ID)?.remove()
}

function setInputValue(el, value) {
  if (!el || value == null || value === '') return false
  const s = String(value).trim()
  if (!s) return false
  el.focus()
  el.value = s
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  try {
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  } catch {
    /* ignore */
  }
  return true
}

function isProductPage() {
  const p = location.pathname
  return /\/dp\/|\/gp\/product\/|\/gp\/aw\/d\//.test(p)
}

function isCheckoutLikePage() {
  const pathQ = location.pathname + location.search
  if (/ap\/signin|\/account\/switcher|sign-in/i.test(pathQ)) return false
  const h = location.hostname
  const p = location.pathname
  if (h.includes('checkout')) return true
  if (p.includes('/checkout/')) return true
  if (p.includes('/gp/cart/')) return true
  if (p.includes('/gp/buy/')) return true
  if (p.includes('/buy/')) return true
  return false
}

/**
 * Amazon checkout often uses these widget IDs (US storefront).
 */
function fillAmazonCheckoutWidgets(shipTo) {
  const fullName = String(shipTo?.fullName || '').trim()
  const address1 = String(shipTo?.addressLine1 || '').trim()
  const address2 = String(shipTo?.addressLine2 || '').trim()
  const city = String(shipTo?.city || '').trim()
  const state = String(shipTo?.stateOrProvince || '').trim()
  const postal = String(shipTo?.postalCode || '').trim()
  const phone = String(shipTo?.phoneNumber || '').trim()

  const pairs = [
    ['address-ui-widgets-enterAddressFullName', fullName],
    ['address-ui-widgets-enterAddressLine1', address1],
    ['address-ui-widgets-enterAddressLine2', address2],
    ['address-ui-widgets-enterCity', city],
    ['address-ui-widgets-enterStateOrRegion', state],
    ['address-ui-widgets-enterPostalCode', postal],
    ['address-ui-widgets-enterPhoneNumber', phone],
  ]

  let n = 0
  for (const [id, val] of pairs) {
    const el = document.getElementById(id)
    if (el && setInputValue(el, val)) n += 1
  }
  return n
}

function findFirstInputByLabels(labelHints) {
  const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), textarea'))
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

async function tryAutofillHeuristic(shipTo) {
  const fullName = String(shipTo?.fullName || '').trim()
  const address1 = String(shipTo?.addressLine1 || '').trim()
  const address2 = String(shipTo?.addressLine2 || '').trim()
  const city = String(shipTo?.city || '').trim()
  const state = String(shipTo?.stateOrProvince || '').trim()
  const postal = String(shipTo?.postalCode || '').trim()
  const phone = String(shipTo?.phoneNumber || '').trim()

  if (fullName) setInputValue(findFirstInputByLabels(['full name', 'name']), fullName)
  if (address1) setInputValue(findFirstInputByLabels(['address line 1', 'street address', 'address']), address1)
  if (address2) setInputValue(findFirstInputByLabels(['address line 2', 'apt', 'suite', 'unit']), address2)
  if (city) setInputValue(findFirstInputByLabels(['city', 'town']), city)
  if (state) setInputValue(findFirstInputByLabels(['state', 'province', 'region']), state)
  if (postal) setInputValue(findFirstInputByLabels(['zip', 'postal']), postal)
  if (phone) setInputValue(findFirstInputByLabels(['phone', 'mobile']), phone)
  await sleep(300)
}

function clickBuyNowOrSimilar() {
  const trySelectors = [
    '#buy-now-button',
    'input#buy-now-button',
    'input[name="submit.buy-now"]',
    '#submit.buy-now-announce',
    '#buy-now',
    '[data-feature-id="prime-buybox'] input[type="submit"]',
  ]
  for (const sel of trySelectors) {
    const el = document.querySelector(sel)
    if (el && el.offsetParent !== null) {
      el.click()
      return true
    }
  }

  const candidates = document.querySelectorAll(
    'button, span.a-button-inner, [role="button"], input[type="submit"], input[type="button"]'
  )
  for (const node of candidates) {
    const t = (node.textContent || node.value || '').replace(/\s+/g, ' ').trim()
    if (/^buy\s*now$/i.test(t) || /^buy\s*now\s*$/i.test(t)) {
      const btn = node.tagName === 'SPAN' && node.closest ? node.closest('button, .a-button') : node
      ;(btn || node).click()
      return true
    }
  }
  return false
}

async function runCheckoutAutofill(shipTo) {
  for (let i = 0; i < 5; i++) {
    fillAmazonCheckoutWidgets(shipTo)
    await tryAutofillHeuristic(shipTo)
    await sleep(1200)
  }
}

async function runProductThenCheckout(shipTo) {
  showBanner('StackPilot: starting checkout — please wait…')
  await sleep(600)
  const clicked = clickBuyNowOrSimilar()
  if (!clicked) {
    showBanner('StackPilot: click “Buy Now” on Amazon — we will fill your address on the next screens.')
  } else {
    showBanner('StackPilot: checkout loading — we will fill the shipping address when the form appears.')
  }
}

async function runFulfillmentFromPayload(shipTo) {
  if (!shipTo) return

  if (isCheckoutLikePage()) {
    showBanner('StackPilot: filling ship-to address…')
    await sleep(400)
    await runCheckoutAutofill(shipTo)
    removeBanner()
    showBanner('StackPilot: verify the address, then continue and place the order on Amazon.')
    window.setTimeout(removeBanner, 8000)
    return
  }

  if (isProductPage()) {
    await runProductThenCheckout(shipTo)
    return
  }

  await tryAutofillHeuristic(shipTo)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'STACKPILOT_FULFILL') return
  const data = getFulfillmentPayload()
  const shipTo = data?.payload?.shipTo
  if (shipTo && typeof shipTo === 'object') {
    void runFulfillmentFromPayload(shipTo)
    return
  }
  void getStoredShipTo().then((st) => {
    if (st) void runFulfillmentFromPayload(st)
  })
})

/** If user landed on checkout after navigation (hash stripped), read storage and autofill. */
void (async function bootCheckoutFromStorage() {
  const shipTo = await getStoredShipTo()
  if (!shipTo) return
  if (!isCheckoutLikePage()) return
  await sleep(800)
  await runFulfillmentFromPayload(shipTo)
})()
