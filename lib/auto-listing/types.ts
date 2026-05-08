export type AutoListingMode = 'safe' | 'balanced' | 'aggressive'

export type AutoListingSettings = {
  enabled: boolean
  paused: boolean
  emergency_stopped: boolean
  listings_per_day: number
  max_per_hour: number
  cooldown_minutes: number
  selected_account_id: number | null
  allowed_niches: string[]
  min_roi: number
  mode: AutoListingMode
  updated_at?: string
}

export type ScoredCandidate = {
  asin: string
  title: string
  sourceNiche: string | null
  amazonPrice: number
  ebayPrice: number
  profit: number
  roi: number
  imageUrl?: string | null
  baseScore: number
  score: number
  scoreBreakdown: Record<string, number>
  selectedReason: string
  categoryId?: string | null
  raw?: Record<string, unknown>
}

