# StackPilot Fulfillment (Chrome / Edge, desktop)

1. Download **`/stackpilot-fulfillment-extension.zip`** from your StackPilot site (Fulfillment tab) or build locally after `npm install` — dev and build scripts place it under `public/`.
2. Unzip to a folder (e.g. `stackpilot-fulfillment-extension`).
3. Open **Chrome** → `chrome://extensions` (or Edge → `edge://extensions`).
4. Enable **Developer mode**.
5. Click **Load unpacked** and choose the unzipped folder.

## What you do on Amazon (this is the full workflow)

1. In StackPilot, map ASINs and click **Fulfill** — your buyer ship-to is copied and Amazon opens with a short-lived token in the URL hash.
2. **Sign in** to Amazon (complete **2FA** if prompted). Stay in that tab through checkout.
3. The extension tries **Buy Now** and prefills **shipping** when it can. If a screen changes, paste the address from your clipboard or edit fields by hand — you are still in charge.
4. **Confirm** ship-to matches the eBay buyer, choose payment, and click **Place your order**.

StackPilot never replaces your login, your bank step, or the final purchase click. That keeps your account inside Amazon’s normal buyer flow.

If Amazon’s page layout changes and autofill misses, use **Copy only** in the Fulfillment tab and paste the address on the checkout form yourself.

## Dimmed icon on the dashboard?

Chrome often grays out an extension on a site unless that extension injects a content script there. StackPilot v0.2.1+ includes a tiny script on https pages so the toolbar icon looks normal on your dashboard; the real automation still runs on **amazon.com** after you use **Fulfill**.
