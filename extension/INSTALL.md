## StackPilot Amazon Autofill Extension (MVP)

This extension is **autofill-only**:
- You click **Fulfill (auto-fill)** in StackPilot.
- It opens the Amazon product page with a short-lived token.
- The extension fetches the buyer ship-to payload from StackPilot and **tries to fill** the shipping address fields.
- It does **not** click “Place order”.

### Install (Chrome / Edge)
1. Go to `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `EbayDash/extension/`.

### Use
1. In StackPilot, open **Dashboard → Fulfillment**.
2. Click **Fulfill (auto-fill)** on an order row.
3. A new Amazon tab opens. If Amazon shows an address form, the extension will attempt to fill it.

### Notes / limitations
- Amazon changes DOM frequently; this MVP uses **heuristics** (label/name matching). Some flows won’t autofill on first try.
- If you are not signed into Amazon, sign in first and click Fulfill again.
- Tokens are short-lived (15 minutes) and the payload token is single-use.

