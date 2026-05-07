## StackPilot Amazon Autofill Extension (MVP)

This extension is **autofill-only**:
- You click **Fulfill (auto-fill)** in StackPilot.
- It opens the Amazon product page with a short-lived token.
- The extension fetches the buyer ship-to payload from StackPilot and **tries to fill** the shipping address fields.
- It does **not** click “Place order”.

### Install (Chrome / Edge) — recommended

1. In StackPilot, open **Dashboard → Fulfillment** and click **Download extension (.zip)** (hosted on your StackPilot domain — no GitHub login required).
2. Unzip; use the folder **`stackpilot-fulfillment-extension`** (it must contain `manifest.json` at the top level).
3. Go to `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**, click **Load unpacked**, and select that folder.

### Install from this repo (developers)

1. Go to `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `EbayDash/extension/`.

The dashboard app adds `stackpilotOrigin` and `fulfillToken` to the Amazon URL hash so the extension can call your StackPilot server (localhost or Vercel) to load the ship-to payload. After updating the extension, use **Reload** on `chrome://extensions`.

### What it does (v0.2+)

1. After you use **Fulfill** in StackPilot, Amazon opens with a token in the URL. The extension saves the ship-to payload and stays active as you move through Amazon’s pages (hash may drop after redirects).
2. On the product page it tries to click **Buy Now** so you move toward checkout.
3. On checkout / address screens it fills Amazon’s shipping fields when possible (Amazon changes their site often — you may still need to paste or fix fields manually).
4. It does **not** click **Place your order** for you.

### Use
1. In StackPilot, open **Dashboard → Fulfillment**.
2. Click **Fulfill** on an order row (same link as the dashboard — extension enhances the flow on Chrome/Edge).
3. The extension tries **Buy Now** on the product page, then fills the shipping form on checkout when it appears. You verify and place the order on Amazon.

### Notes / limitations
- Amazon changes DOM frequently; this MVP uses **heuristics** (label/name matching). Some flows won’t autofill on first try.
- If you are not signed into Amazon, sign in first and click Fulfill again.
- Tokens are short-lived (15 minutes) and the payload token is single-use.

