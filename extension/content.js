function parseHashParams() {
  try {
    const raw = window.location.hash.replace(/^#/, '')
    if (!raw) return null
    return new URLSearchParams(raw)
  } catch {
    return null
  }
}

function getFulfillBootstrap() {
  try {
    const u = new URL(window.location.href)
    const qTok = u.searchParams.get('fulfillToken')?.trim()
    const qOrigin = u.searchParams.get('stackpilotOrigin')?.trim()
    if (qTok && qOrigin) return { token: qTok, origin: qOrigin }

    const hp = parseHashParams()
    const hTok = hp?.get('fulfillToken')?.trim()
    const hOrigin = hp?.get('stackpilotOrigin')?.trim()
    if (hTok && hOrigin) return { token: hTok, origin: hOrigin }
  } catch {
    /* ignore */
  }
  return null
}

function stripFulfillFromUrl() {
  try {
    const u = new URL(window.location.href)
    let changed = false
    if (u.searchParams.has('fulfillToken') || u.searchParams.has('stackpilotOrigin')) {
      u.searchParams.delete('fulfillToken')
      u.searchParams.delete('stackpilotOrigin')
      changed = true
    }
    const raw = u.hash.replace(/^#/, '')
    if (raw) {
      const p = new URLSearchParams(raw)
      if (p.has('fulfillToken')) {
        p.delete('fulfillToken')
        p.delete('stackpilotOrigin')
        u.hash = p.toString() ? `#${p.toString()}` : ''
        changed = true
      }
    }
    if (changed) window.history.replaceState(null, '', u.toString())
  } catch {
    /* ignore */
  }
}

function send(type, payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, ...payload }, resolve)
    } catch {
      resolve(null)
    }
  })
}

function log(...args) {
  try {
    console.info('[StackPilot Fulfillment]', ...args)
  } catch {
    /* ignore */
  }
}

function setInputValue(el, value) {
  if (!el || value == null) return false
  const v = String(value)
  el.focus()
  try {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    if (desc?.set) desc.set.call(el, v)
    else el.value = v
  } catch {
    el.value = v
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  return true
}

function getDocumentRoots() {
  const roots = [document]
  try {
    document.querySelectorAll('iframe').forEach((f) => {
      try {
        if (f.contentDocument && f.contentDocument.body) roots.push(f.contentDocument)
      } catch (e) {
        /* cross-origin */
      }
    })
  } catch {
    /* ignore */
  }
  return roots
}

function pickInput(selectors) {
  for (const root of getDocumentRoots()) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel)
        if (el && !el.disabled && el.getClientRects().length) return el
      } catch {
        /* ignore */
      }
    }
  }
  return null
}

function matchStateOption(select, region) {
  const r = String(region || '').trim()
  if (!r || select.tagName !== 'SELECT') return null
  const opts = Array.from(select.options)
  return opts.find((o) => {
    const v = String(o.value || '')
    const t = o.textContent.trim()
    return (
      v === r ||
      v.replace(/^US-/, '') === r ||
      t.toLowerCase() === r.toLowerCase() ||
      t.toLowerCase().includes(r.toLowerCase()) ||
      v.toLowerCase() === r.toLowerCase()
    )
  })
}

function getBuyboxRoot() {
  return (
    document.querySelector(
      '#buybox, #buyBox, #core-buybox, #buyBoxAtc, [data-feature-name="desktopBuyBox"], [data-feature-name="mobileBuyBox"]'
    ) ||
    document.querySelector('#centerCol, #dp-container') ||
    document.body
  )
}

function clickEl(el) {
  if (!el || typeof el.click !== 'function') return false
  if (!el.getClientRects().length) return false
  try {
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
  } catch {
    /* ignore */
  }
  el.click()
  return true
}

/** Normalize visible / accessible label (Amazon splits text across spans). */
function normLabel(el) {
  if (!el) return ''
  return (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Prefer the real click target inside Amazon's .a-button shells. */
function clickAmazonControl(el) {
  const shell = el.closest?.('.a-button') || el
  if (shell?.classList?.contains?.('a-button') || shell?.querySelector?.('.a-button-inner')) {
    const inp = shell.querySelector('input.a-button-input')
    if (inp && clickEl(inp)) return true
    const link = shell.querySelector('a.a-button-text, a')
    if (link && clickEl(link)) return true
    if (clickEl(shell)) return true
    return false
  }
  return clickEl(el.closest('a, button') || el)
}

/** Match Amazon's "Add new delivery address" row / button copy (US). */
function isAddNewDeliveryAddress(t) {
  if (!t) return false
  if (t.includes('add new delivery address')) return true
  if (t.includes('add a new delivery address')) return true
  if (t.includes('add new delivery') && t.includes('address')) return true
  if (t.includes('new delivery address') && (t.includes('add') || t.includes('+'))) return true
  return false
}

/**
 * Checkout / review: open the address form — prioritize "Add new delivery address" like the mobile/desktop PTC flow.
 */
function tryOpenAddressEditor() {
  for (const root of getDocumentRoots()) {
    /** 1) Whole .a-button blocks (primary Amazon pattern) */
    for (const btn of root.querySelectorAll('.a-button')) {
      const t = normLabel(btn)
      if (!isAddNewDeliveryAddress(t)) continue
      log('click: add new delivery address (a-button)', t)
      if (clickAmazonControl(btn)) return true
    }

    /** 2) Same phrasing on links / roles not wrapped as .a-button */
    for (const el of root.querySelectorAll('a, button, [role="button"], span.a-button-text')) {
      const t = normLabel(el)
      if (!isAddNewDeliveryAddress(t)) continue
      log('click: add new delivery address (control)', t)
      if (clickAmazonControl(el)) return true
    }

    /** 3) Section-scoped: Change / Add / Ship elsewhere */
    const sectionHints = Array.from(
      root.querySelectorAll('h1, h2, h3, h4, .a-box, section, [data-testid*="shipping"], [id*="ship"]')
    ).slice(0, 40)

    for (const hint of sectionHints) {
      const tx = (hint.innerText || '').toLowerCase()
      if (
        !tx.includes('ship') &&
        !tx.includes('deliver') &&
        !tx.includes('address') &&
        !tx.includes('recipient')
      )
        continue
      const section =
        hint.closest('.a-box-group, section, .spc-section, [data-testid], .a-section') ||
        hint.parentElement?.parentElement ||
        hint.parentElement
      if (!section) continue
      const links = section.querySelectorAll('a, button, [role="button"], span.a-button-text')
      for (const el of links) {
        const t = normLabel(el)
        if (
          t === 'change' ||
          t.includes('change shipping') ||
          t.includes('change address') ||
          t.includes('add address') ||
          t.includes('new address') ||
          t.includes('deliver to another') ||
          t.includes('ship to another') ||
          t.includes('use another address')
        ) {
          log('opening address editor (section):', t)
          if (clickAmazonControl(el)) return true
        }
      }
    }

    /** 4) Global fallbacks (other locales / wording) */
    for (const el of root.querySelectorAll('a, button, [role="button"], span.a-button-text')) {
      const t = normLabel(el)
      if (
        t.includes('add a new address') ||
        t.includes('enter a new shipping address') ||
        t.includes('enter a new delivery address') ||
        t === 'add address' ||
        t.includes('use a new address')
      ) {
        log('opening new address form (fallback):', t)
        if (clickAmazonControl(el)) return true
      }
    }
  }
  return false
}

function tryBuyNow() {
  const root = getBuyboxRoot()

  const idSelectors = [
    '#buy-now-button',
    '#buy-now-checkout',
    'input#buy-now',
    '#submit.buy-now',
    'input#submit.buy-now',
    'span#submit.buy-now',
    'input[name="submit.buy-now"]',
    'input[name="submit.buyNow"]',
    '[data-cy="buy-now-button"]',
    'input[title="Buy Now"]',
    '[data-action="buy-now"]',
    'form[action*="Buy-Ship"] input[type="submit"]',
    'form[action*="buy-now"] input[type="submit"]',
  ]
  for (const sel of idSelectors) {
    const el = root.querySelector(sel) || document.querySelector(sel)
    if (el && clickEl(el)) return true
  }

  for (const input of root.querySelectorAll('input.a-button-input[type="submit"], input.a-button-input[type="button"]')) {
    const shell = input.closest('.a-button')
    if (!shell) continue
    const label = (shell.innerText || '').trim().toLowerCase()
    if (!label.includes('buy now')) continue
    if (label.includes('gift') || label.includes('kindle')) continue
    if (clickEl(input)) return true
  }

  const nodes = root.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], span.a-button-inner, .a-button-input')
  for (const node of nodes) {
    const direct =
      (node.getAttribute('aria-label') || '') +
      ' ' +
      (node.getAttribute('title') || '') +
      ' ' +
      (node.innerText || node.value || '')
    const t = direct.trim().toLowerCase()
    if (!t.includes('buy now')) continue
    if (t.includes('gift') || t.includes('kindle')) continue
    let clickTarget = node
    if (node.tagName === 'SPAN' && node.closest('span.a-button-inner')) {
      clickTarget = node.closest('.a-button') || node.closest('button') || node.parentElement
    }
    if (clickTarget?.querySelector?.('input.a-button-input')) {
      clickTarget = clickTarget.querySelector('input.a-button-input')
    }
    if (clickTarget && clickEl(clickTarget)) return true
  }

  return false
}

function tryAdvanceCheckout() {
  const candidates = document.querySelectorAll('a, button, [role="button"], input[type="submit"]')
  for (const el of candidates) {
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase()
    if (
      t.includes('proceed to checkout') ||
      t.includes('continue to checkout') ||
      t.includes('sign in to check out') ||
      (t === 'checkout' && !t.includes('edit'))
    ) {
      if (clickEl(el)) return true
    }
  }
  return false
}

/**
 * Fill shipping widgets (desktop checkout, mobile, address popup, autocomplete).
 * Returns a score; "ok" if we likely applied buyer-critical lines.
 */
function fillAmazonAddress(shipTo) {
  const fullName = shipTo.fullName || ''
  const line1 = shipTo.addressLine1 || ''
  const line2 = shipTo.addressLine2 || ''
  const city = shipTo.city || ''
  const region = shipTo.stateOrProvince || ''
  const postal = shipTo.postalCode || ''
  const phone = shipTo.phoneNumber || ''

  log('fill attempt', {
    hasName: !!fullName,
    hasLine1: !!line1,
    city,
    region,
    postal: postal ? '***' : '',
    hasPhone: !!phone,
  })

  const nameEl = pickInput([
    'input[autocomplete="name"]',
    '#enterAddressFullName',
    'input[name="enterAddressFullName"]',
    'input[name="address-ui-widgets-enterAddressFullName"]',
    'input[id*="enterAddressFullName"]',
    '#address-ui-widgets-enterAddressFullName',
    'input[placeholder*="Full name"]',
  ])
  const line1El = pickInput([
    'input[autocomplete="address-line1"]',
    'input[autocomplete="street-address"]',
    '#enterAddressLine1',
    'input[name="enterAddressLine1"]',
    'input[id*="enterAddressLine1"]',
    '#address-ui-widgets-enterAddressLine1',
    'input[name="address-ui-widgets-enterAddressLine1"]',
  ])
  const line2El = pickInput([
    'input[autocomplete="address-line2"]',
    '#enterAddressLine2',
    'input[name="enterAddressLine2"]',
    'input[id*="enterAddressLine2"]',
    '#address-ui-widgets-enterAddressLine2',
  ])
  const cityEl = pickInput([
    'input[autocomplete="address-level2"]',
    '#enterAddressCity',
    'input[name="enterAddressCity"]',
    'input[id*="enterAddressCity"]',
    '#address-ui-widgets-enterAddressCity',
  ])
  const stateEl = pickInput([
    'select[autocomplete="address-level1"]',
    '#enterAddressStateOrRegion',
    'select[name="enterAddressStateOrRegion"]',
    'select[id*="enterAddressStateOrRegion"]',
    '#address-ui-widgets-enterAddressStateOrRegion',
    'select[id*="StateOrRegion"]',
    'input[name="enterAddressStateOrRegion"]',
    '#address-ui-widgets-enterAddressStateOrRegion',
  ])
  const zipEl = pickInput([
    'input[autocomplete="postal-code"]',
    '#enterAddressPostalCode',
    'input[name="enterAddressPostalCode"]',
    'input[id*="enterAddressPostalCode"]',
    '#address-ui-widgets-enterAddressPostalCode',
    'input[name="address-ui-widgets-enterAddressPostalCode"]',
  ])
  const phoneEl = pickInput([
    'input[autocomplete="tel"]',
    '#enterAddressPhoneNumber',
    'input[name="enterAddressPhoneNumber"]',
    'input[type="tel"]',
    '#address-ui-widgets-enterAddressPhoneNumber',
    'input[name="address-ui-widgets-enterAddressPhoneNumber"]',
  ])

  let filled = 0
  if (fullName && nameEl && setInputValue(nameEl, fullName)) filled += 1
  if (line1 && line1El && setInputValue(line1El, line1)) filled += 1
  if (line2 && line2El && setInputValue(line2El, line2)) filled += 1
  if (city && cityEl && setInputValue(cityEl, city)) filled += 1
  if (postal && zipEl && setInputValue(zipEl, postal)) filled += 1
  if (phone && phoneEl && setInputValue(phoneEl, phone)) filled += 1
  if (stateEl && region) {
    if (stateEl.tagName === 'SELECT') {
      const opt = matchStateOption(stateEl, region)
      if (opt) {
        stateEl.value = opt.value
        stateEl.dispatchEvent(new Event('change', { bubbles: true }))
        stateEl.dispatchEvent(new Event('blur', { bubbles: true }))
        filled += 1
      }
    } else {
      setInputValue(stateEl, region)
      filled += 1
    }
  }

  const strong = line1 && city && postal && filled >= 3
  return strong
}

let bootstrapDone = false
let bootstrapFailCount = 0

async function bootstrapFromHash() {
  if (bootstrapDone) return

  const existing = await send('GET_STORED_PAYLOAD', {})
  if (existing?.stored?.token) {
    bootstrapDone = true
    if (getFulfillBootstrap()) stripFulfillFromUrl()
    return
  }

  const b = getFulfillBootstrap()
  if (!b?.token || !b?.origin) return
  if (bootstrapFailCount >= 8) return

  const { token, origin } = b
  const res = await send('FETCH_FULFILL_PAYLOAD', { stackpilotOrigin: origin, token })

  if (res?.ok) {
    bootstrapDone = true
    stripFulfillFromUrl()
  } else {
    bootstrapFailCount += 1
    if (bootstrapFailCount >= 8) {
      void send('REPORT_STATUS', {
        stackpilotOrigin: origin,
        token,
        state: 'ISSUE',
        lastError: res?.error || 'payload fetch failed',
      })
    }
  }
}

function pathLooksLikeCheckout() {
  const p = window.location.pathname + window.location.search
  return (
    p.includes('/checkout/') ||
    p.includes('/gp/buy/') ||
    p.includes('/buy/') ||
    p.includes('/spc/') ||
    p.includes('checkout-session') ||
    p.includes('/pay-select') ||
    p.includes('/checkout/p') ||
    p.includes('prime-checkout') ||
    Boolean(
      document.querySelector(
        '#checkout-experience, [data-checkout-type], form[action*="checkout"], [data-feature-id="checkout-experience"], #spc-form, .spc-desktop, [data-spc]'
      )
    )
  )
}

function pathLooksLikeProduct() {
  return /\/(dp|gp\/product|gp\/aw\/d)\//.test(window.location.pathname)
}

function pathLooksLikeCart() {
  return /\/gp\/cart|\/cart\/|\/haw\/cart/i.test(window.location.pathname + window.location.search)
}

function pathLooksLikeSignIn() {
  const p = window.location.pathname
  return p.includes('/ap/signin') || p.includes('/ap/cvf') || p.includes('/ap/mfa')
}

let lastPath = window.location.pathname
let checkoutReported = ''
let checkoutFillAttempts = 0
let buyNowKey = ''
let buyNowAttempts = 0
const MAX_BUY_NOW_ATTEMPTS = 30
let buyNowObserver = null
let cartAdvanceKey = ''
let cartAdvanceAttempts = 0

function startBuyNowObserver() {
  if (buyNowObserver) {
    buyNowObserver.disconnect()
    buyNowObserver = null
  }
  const root = getBuyboxRoot()
  buyNowObserver = new MutationObserver(() => {
    tryBuyNow()
  })
  try {
    buyNowObserver.observe(root, { childList: true, subtree: true })
  } catch {
    return
  }
  window.setTimeout(() => {
    buyNowObserver?.disconnect()
    buyNowObserver = null
  }, 25000)
}

async function tick() {
  if (!chrome?.runtime?.id) return

  const pathNow = window.location.pathname
  if (pathNow !== lastPath) {
    lastPath = pathNow
    if (!pathLooksLikeCheckout()) {
      checkoutFillAttempts = 0
      checkoutReported = ''
    }
    if (!pathLooksLikeProduct()) {
      buyNowKey = ''
      buyNowAttempts = 0
      buyNowObserver?.disconnect()
      buyNowObserver = null
    }
    if (!pathLooksLikeCart()) {
      cartAdvanceKey = ''
      cartAdvanceAttempts = 0
    }
  }

  void bootstrapFromHash()

  const storedRes = await send('GET_STORED_PAYLOAD', {})
  const stored = storedRes?.stored
  if (!stored?.token) return

  const shipTo = stored.shipTo && typeof stored.shipTo === 'object' ? stored.shipTo : {}

  if (pathLooksLikeProduct() && !pathLooksLikeSignIn()) {
    if (buyNowKey !== pathNow) {
      buyNowKey = pathNow
      buyNowAttempts = 0
      startBuyNowObserver()
    }
    if (buyNowAttempts < MAX_BUY_NOW_ATTEMPTS) {
      buyNowAttempts += 1
      window.requestAnimationFrame(() => tryBuyNow())
    }
    return
  }

  if (pathLooksLikeCart() && !pathLooksLikeCheckout()) {
    if (cartAdvanceKey !== pathNow) {
      cartAdvanceKey = pathNow
      cartAdvanceAttempts = 0
    }
    if (cartAdvanceAttempts < 12) {
      cartAdvanceAttempts += 1
      tryAdvanceCheckout()
    }
    return
  }

  if (pathLooksLikeSignIn()) return

  if (!pathLooksLikeCheckout()) return
  if (checkoutReported) return

  checkoutFillAttempts += 1

  /** Keep trying to open "Add new delivery address" / address editor while fields are filling in */
  if (checkoutFillAttempts <= 36) {
    tryOpenAddressEditor()
  } else if (checkoutFillAttempts % 4 === 1) {
    tryOpenAddressEditor()
  }

  const ok = Object.keys(shipTo).length ? fillAmazonAddress(shipTo) : false

  if (ok) {
    checkoutReported = pathNow
    log('checkout fill success')
    void send('REPORT_STATUS', {
      stackpilotOrigin: stored.stackpilotOrigin,
      token: stored.token,
      state: 'PREFILLED',
      lastError: null,
    })
    return
  }

  if (checkoutFillAttempts >= 42) {
    checkoutReported = pathNow
    void send('REPORT_STATUS', {
      stackpilotOrigin: stored.stackpilotOrigin,
      token: stored.token,
      state: 'ISSUE',
      lastError: 'address autofill could not match; paste from dashboard if needed',
    })
  }
}

void bootstrapFromHash()
window.setInterval(() => void tick(), 750)
