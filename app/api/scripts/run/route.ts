import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

async function getEbayToken(userId: string) {
  const rows = await sql`SELECT oauth_token, token_expires_at FROM ebay_credentials WHERE user_id = ${userId}`
  return rows[0]?.oauth_token || null
}

async function ebayGet(token: string, path: string) {
  const res = await fetch(`https://api.ebay.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const script = req.nextUrl.searchParams.get('script')
  const token = await getEbayToken(session.user.id)
  if (!token) return NextResponse.json({ error: '✗ eBay not connected — go to Settings first' })

  try {
    switch (script) {
      case 'check-orders.js': {
        const data = await ebayGet(token, '/sell/fulfillment/v1/order?limit=50&orderFulfillmentStatus=NOT_STARTED')
        const count = data.total || 0
        return NextResponse.json({ message: `✓ Found ${count} order${count !== 1 ? 's' : ''} needing shipment` })
      }

      case 'auto-feedback.js': {
        // eBay doesn't expose buyer messaging via REST for sellers (only buyers can initiate)
        return NextResponse.json({ message: '⚠ eBay no longer allows sellers to initiate messages via API. Send feedback requests manually from My eBay → Sold.' })
      }

      case 'fix-campaigns.js': {
        const data = await ebayGet(token, '/sell/marketing/v1/ad_campaign?limit=10')
        const campaigns = data.campaigns || []
        const paused = campaigns.filter((c: { campaignStatus: string }) => c.campaignStatus === 'PAUSED').length
        return NextResponse.json({ message: `✓ Found ${campaigns.length} campaign(s) — ${paused} paused. Review in eBay Seller Hub → Marketing.` })
      }

      case 'delete-low-roi.js': {
        return NextResponse.json({ message: '⚠ This script permanently deletes listings. Run it locally for safety: node delete-low-roi.js' })
      }

      case 'audit-and-clean.js': {
        const data = await ebayGet(token, '/sell/inventory/v1/inventory_item?limit=200')
        const count = data.total || (data.inventoryItems?.length ?? 0)
        return NextResponse.json({ message: `✓ Found ${count} inventory item(s). Full audit runs locally: node audit-and-clean.js` })
      }

      case 'delete-dead-listings.js': {
        return NextResponse.json({ message: '⚠ Deletion scripts run locally for safety. Use: node delete-dead-listings.js' })
      }

      case 'optimize-titles.js': {
        const data = await ebayGet(token, '/sell/inventory/v1/inventory_item?limit=200')
        const count = data.total || (data.inventoryItems?.length ?? 0)
        return NextResponse.json({ message: `✓ ${count} listing(s) found. Title optimization runs locally: node optimize-titles.js` })
      }

      case 'optimize-titles-apply.js': {
        return NextResponse.json({ message: '⚠ Title changes apply live to your listings. Run locally after reviewing report: node optimize-titles-apply.js' })
      }

      case 'auto-lister.js': {
        return NextResponse.json({ message: '⚠ Auto-lister requires product data file. Run locally: node auto-lister.js' })
      }

      case 'update-descriptions.js': {
        return NextResponse.json({ message: '⚠ Description updates run locally. Use: node update-descriptions.js' })
      }

      case 'sync-amazon-costs.js': {
        return NextResponse.json({ message: '⚠ Cost sync runs locally. Use: node sync-amazon-costs.js — or use the ASIN tab to check prices manually.' })
      }

      default:
        return NextResponse.json({ message: '⚠ Script not recognized' })
    }
  } catch (e) {
    return NextResponse.json({ message: `✗ Error: ${String(e).slice(0, 100)}` })
  }
}
