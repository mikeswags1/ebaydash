import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

const NICHE_CATEGORY: Record<string, string> = {
  'Phone Accessories': '9394',
  'Computer Parts': '175673',
  'Audio & Headphones': '112529',
  'Smart Home Devices': '175690',
  'Gaming Gear': '139971',
  'Kitchen Gadgets': '20625',
  'Home Decor': '10033',
  'Furniture & Lighting': '10033',
  'Cleaning Supplies': '26677',
  'Storage & Organization': '26677',
  'Camping & Hiking': '16034',
  'Garden & Tools': '2032',
  'Sporting Goods': '888',
  'Fishing & Hunting': '1492',
  'Cycling': '7294',
  'Fitness Equipment': '15273',
  'Personal Care': '26248',
  'Supplements & Vitamins': '180959',
  'Medical Supplies': '15032',
  'Mental Wellness': '26395',
  'Car Parts': '6030',
  'Car Accessories': '14946',
  'Motorcycle Gear': '10063',
  'Truck & Towing': '6030',
  'Car Care': '179716',
  'Pet Supplies': '1281',
  'Baby & Kids': '2984',
  'Toys & Games': '220',
  'Clothing & Accessories': '11450',
  'Jewelry & Watches': '281',
  'Office Supplies': '16034',
  'Industrial Equipment': '12576',
  'Safety Gear': '177742',
  'Janitorial & Cleaning': '26677',
  'Packaging Materials': '26677',
  'Trading Cards': '2536',
  'Vintage & Antiques': '20081',
  'Coins & Currency': '11116',
  'Comics & Manga': '259104',
  'Sports Memorabilia': '64482',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { asin, title, ebayPrice, imageUrl, niche } = await req.json()
  if (!asin || !title || !ebayPrice) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const rows = await sql`SELECT oauth_token FROM ebay_credentials WHERE user_id = ${session.user.id}`
  const token = rows[0]?.oauth_token
  if (!token) return NextResponse.json({ error: 'eBay not connected — go to Settings first' }, { status: 400 })

  const appId = process.env.EBAY_APP_ID || ''
  const safeTitle = title.replace(/[^\x20-\x7E]/g, '').replace(/[<>&"]/g, ' ').slice(0, 80).trim()
  const categoryId = NICHE_CATEGORY[niche] || '293'
  const price = parseFloat(ebayPrice).toFixed(2)

  const description = `<![CDATA[
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#333">
  <h2 style="font-size:20px;margin-bottom:12px">${safeTitle}</h2>
  <p style="line-height:1.8;color:#555">Brand new, unused condition. Ships fast directly to your door.</p>
  <ul style="line-height:2;color:#555;padding-left:20px">
    <li>✔ New condition</li>
    <li>✔ FREE shipping — no extra cost</li>
    <li>✔ 30-day hassle-free returns</li>
    <li>✔ Fast dispatch within 1–3 business days</li>
  </ul>
</div>]]>`

  const pictureXml = imageUrl
    ? `<PictureDetails><PictureURL>${imageUrl}</PictureURL></PictureDetails>`
    : ''

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${safeTitle}</Title>
    <Description>${description}</Description>
    <PrimaryCategory><CategoryID>${categoryId}</CategoryID></PrimaryCategory>
    <StartPrice>${price}</StartPrice>
    <ConditionID>1000</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>99</Quantity>
    ${pictureXml}
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>ShippingMethodStandard</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
        <FreeShipping>true</FreeShipping>
        <ShippingServiceAdditionalCost>0.00</ShippingServiceAdditionalCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
      <Description>30-day returns accepted. Contact us and we will resolve any issue.</Description>
    </ReturnPolicy>
    <ItemSpecifics>
      <NameValueList>
        <Name>Brand</Name>
        <Value>Unbranded</Value>
      </NameValueList>
    </ItemSpecifics>
  </Item>
</AddFixedPriceItemRequest>`

  const res = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'AddFixedPriceItem',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-APP-NAME': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/xml',
    },
    body: xml,
  })

  const responseText = await res.text()

  // Extract ItemID from XML response
  const itemIdMatch = responseText.match(/<ItemID>(\d+)<\/ItemID>/)
  const errMatch = responseText.match(/<ShortMessage>(.*?)<\/ShortMessage>/)
  const ackMatch = responseText.match(/<Ack>(.*?)<\/Ack>/)

  if (!itemIdMatch || (ackMatch && ackMatch[1] === 'Failure')) {
    const errMsg = errMatch ? errMatch[1] : responseText.slice(0, 300)
    return NextResponse.json({ error: errMsg }, { status: 400 })
  }

  const listingId = itemIdMatch[1]

  // Save ASIN so it never shows in product finder again
  await sql`
    INSERT INTO listed_asins (user_id, asin, title, ebay_listing_id)
    VALUES (${session.user.id}, ${asin}, ${title.slice(0, 200)}, ${listingId})
    ON CONFLICT (user_id, asin) DO UPDATE SET ebay_listing_id = ${listingId}, listed_at = NOW()
  `.catch(() => {})

  return NextResponse.json({
    success: true,
    listingId,
    listingUrl: `https://www.ebay.com/itm/${listingId}`,
  })
}
