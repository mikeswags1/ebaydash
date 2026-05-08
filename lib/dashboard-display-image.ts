/** Normalize listing image URLs for the dashboard. Next/Image optimization often gets 403 from Amazon when fetched from the server — use unoptimized + browser fetch. */
export function dashboardDisplayImageUrl(raw: string | undefined | null): string {
  if (raw == null) return ''
  let u = String(raw).trim()
  if (!u) return ''
  if (u.startsWith('//')) u = `https:${u}`
  if (u.startsWith('http://') && /amazon|ebayimg/i.test(u)) u = `https://${u.slice(7)}`
  return u
}
