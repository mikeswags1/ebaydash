export function getRapidApiKey() {
  if (process.env.ENABLE_RAPIDAPI_FALLBACK !== '1') return ''
  return process.env.RAPIDAPI_KEY || ''
}

export function isRapidApiFallbackEnabled() {
  return Boolean(getRapidApiKey())
}
