'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardSidebar } from './components/DashboardSidebar'
import { DashboardBanner, DashboardTopbar } from './components/DashboardTopbar'
import { OverviewTab } from './components/OverviewTab'
import { OrdersTab } from './components/OrdersTab'
import { FinancialsTab } from './components/FinancialsTab'
import { PerformanceTab } from './components/PerformanceTab'
import { ScriptsTab } from './components/ScriptsTab'
import { AsinLookupTab } from './components/AsinLookupTab'
import { ProductListingTab } from './components/ProductListingTab'
import { ContinuousListingTab } from './components/ContinuousListingTab'
import { CampaignsTab } from './components/CampaignsTab'
import { SettingsTab } from './components/SettingsTab'
import { SellOnEbayModal } from './components/SellOnEbayModal'
import type { BannerState, EbayCredentialsSummary, FinancialItem, FinancialSummary, FinderProduct, ListProgress, OrderAsinMap, PerformanceData, ProductSourceHealth, ScriptMessage, Tab } from './types'
import type { AsinResult, EbayOrder, ListResult } from './types'
import {
  disconnectEbay,
  fetchFinancials,
  fetchPerformance,
  fetchEbayCredentials,
  fetchFinderProducts,
  fetchOrderAsinMap,
  fetchOrders,
  fetchProductSourceHealth,
  fetchUserNiche,
  DashboardApiError,
  getErrorMessage,
  isReconnectError,
  lookupAsinByItemId,
  publishProduct,
  runDashboardScript,
  saveManualAsinMapping,
  saveUserNiche,
  validateAmazonAsin,
} from './api'
import { EBAY_FEE_RATE } from './constants'
import { getBulkPreflightIssue, getGrossRevenue, getListingPreview, getRecommendedEbayPrice, listProductsInBatches, parseDashboardSearchMessage, summarizeBulkListResult } from './utils'
import { isRefundedOrder } from './order-status'

type ConnectionState = {
  ebayConnected: boolean
  ebayNeedsReconnect: boolean
  syncing: boolean
}

type OrderState = {
  orders: EbayOrder[]
  awaiting: EbayOrder[]
  syncTime: string | null
  orderAsinMap: OrderAsinMap
}

type FinancialState = {
  loading: boolean
  summary: FinancialSummary | null
  items: FinancialItem[]
  error: string | null
}

type PerformanceState = {
  loading: boolean
  data: PerformanceData | null
  error: string | null
}

type ProductSourceHealthState = {
  loading: boolean
  data: ProductSourceHealth | null
  error: string | null
}

type NicheState = {
  value: string | null
  saving: boolean
  saved: boolean
}

type LookupState = {
  input: string
  manualAsin: string
  rejectedAsins: string[]
  result: AsinResult | null
  loading: boolean
  savingManual: boolean
  error: string | null
}

type FinderState = {
  loading: boolean
  results: FinderProduct[] | null
  error: string | null
  view: 'cards' | 'list'
  listAllProgress: ListProgress | null
}

type ListingState = {
  modal: FinderProduct | null
  price: string
  validating: boolean
  validated: boolean
  loading: boolean
  result: ListResult | null
  error: string | null
}

const FINDER_STOCK_TARGET = 30
const FINDER_ROTATION_POOL_TARGET = 60

function tagFinderProducts(products: FinderProduct[], sourceMode: 'niche' | 'continuous') {
  return products.map((product) => ({ ...product, sourceMode }))
}

function getStableShuffleScore(product: FinderProduct, tick: number, index: number) {
  const text = `${product.asin}:${product.sourceNiche || ''}:${tick}:${index}`
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getRotatingFinderProducts(products: FinderProduct[] | null, tick: number, limit = FINDER_STOCK_TARGET) {
  if (!products || products.length <= 1) return products || null
  return [...products]
    .map((product, index) => ({ product, score: getStableShuffleScore(product, tick, index) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.product)
}

function mergeRefilledProducts(current: FinderProduct[] | null, incoming: FinderProduct[], listedAsins: string[], sourceMode: 'niche' | 'continuous') {
  const listed = new Set(listedAsins.map((asin) => asin.toUpperCase()))
  const kept = (current || []).filter((product) => !listed.has(product.asin.toUpperCase()))
  const seen = new Set(kept.map((product) => product.asin.toUpperCase()))
  const additions = incoming.filter((product) => {
    const asin = product.asin.toUpperCase()
    if (listed.has(asin) || seen.has(asin)) return false
    seen.add(asin)
    return true
  })

  return tagFinderProducts([...kept, ...additions].slice(0, FINDER_ROTATION_POOL_TARGET), sourceMode)
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('overview')
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    ebayConnected: false,
    ebayNeedsReconnect: false,
    syncing: false,
  })
  const [disconnectingEbay, setDisconnectingEbay] = useState(false)
  const [orderState, setOrderState] = useState<OrderState>({
    orders: [],
    awaiting: [],
    syncTime: null,
    orderAsinMap: {},
  })
  const [financialState, setFinancialState] = useState<FinancialState>({
    loading: false,
    summary: null,
    items: [],
    error: null,
  })
  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    loading: false,
    data: null,
    error: null,
  })
  const [sourceHealthState, setSourceHealthState] = useState<ProductSourceHealthState>({
    loading: false,
    data: null,
    error: null,
  })
  const [financialPeriod, setFinancialPeriod] = useState('30d')
  const [nicheState, setNicheState] = useState<NicheState>({
    value: null,
    saving: false,
    saved: false,
  })
  const [lookupState, setLookupState] = useState<LookupState>({
    input: '',
    manualAsin: '',
    rejectedAsins: [],
    result: null,
    loading: false,
    savingManual: false,
    error: null,
  })
  const [finderState, setFinderState] = useState<FinderState>({
    loading: false,
    results: null,
    error: null,
    view: 'cards',
    listAllProgress: null,
  })
  const [continuousFinderState, setContinuousFinderState] = useState<FinderState>({
    loading: false,
    results: null,
    error: null,
    view: 'cards',
    listAllProgress: null,
  })
  const [listingState, setListingState] = useState<ListingState>({
    modal: null,
    price: '',
    validating: false,
    validated: false,
    loading: false,
    result: null,
    error: null,
  })
  const [scriptRunning, setScriptRunning] = useState<string | null>(null)
  const [scriptMessage, setScriptMessage] = useState<ScriptMessage | null>(null)
  const [finderRotationTick, setFinderRotationTick] = useState(0)

  const visibleFinderResults = useMemo(
    () => getRotatingFinderProducts(finderState.results, finderRotationTick),
    [finderRotationTick, finderState.results]
  )
  const visibleContinuousResults = useMemo(
    () => getRotatingFinderProducts(continuousFinderState.results, finderRotationTick),
    [continuousFinderState.results, finderRotationTick]
  )

  const validateListingProduct = useCallback(async (product: FinderProduct) => {
    const originalPrice = product.ebayPrice.toFixed(2)

    setListingState((prev) => {
      if (!prev.modal || prev.modal.asin !== product.asin) return prev
      return { ...prev, validating: true, error: null }
    })

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const validated = await validateAmazonAsin(product.asin)
        const resolvedImageUrl = validated.imageUrl || product.imageUrl || validated.images?.[0]
        const hasValidAmazonData = Boolean(resolvedImageUrl && validated.amazonPrice > 0)

        if (!hasValidAmazonData) {
          throw new Error('INCOMPLETE_AMAZON_VALIDATION')
        }

        const nextRecommendedPrice = getRecommendedEbayPrice(validated.amazonPrice)
        const preview = getListingPreview(nextRecommendedPrice.toFixed(2), validated.amazonPrice, '0', EBAY_FEE_RATE)
        const nextProduct: FinderProduct = {
          ...product,
          title: validated.title,
          amazonPrice: validated.amazonPrice,
          ebayPrice: nextRecommendedPrice,
          profit: preview.profit,
          roi: preview.roi,
          imageUrl: resolvedImageUrl || product.imageUrl,
          images: (validated.images && validated.images.length > 0 ? validated.images : product.images) || product.images,
          features: validated.features || product.features,
          description: validated.description || product.description,
          specs: validated.specs || product.specs,
        }

        setFinderState((prev) => ({
          ...prev,
          results: prev.results
            ? prev.results.map((entry) => (entry.asin === product.asin ? nextProduct : entry))
            : prev.results,
        }))
        setContinuousFinderState((prev) => ({
          ...prev,
          results: prev.results
            ? prev.results.map((entry) => (entry.asin === product.asin ? nextProduct : entry))
            : prev.results,
        }))

        setListingState((prev) => {
          if (!prev.modal || prev.modal.asin !== product.asin) return prev

          const shouldRefreshPrice = prev.price === originalPrice
          return {
            ...prev,
            modal: nextProduct,
            price: shouldRefreshPrice ? nextRecommendedPrice.toFixed(2) : prev.price,
            validating: false,
            validated: true,
            error: null,
          }
        })

        return { validated: true, product: nextProduct }
      } catch {
        if (attempt === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          continue
        }
      }
    }

    setListingState((prev) => {
      if (!prev.modal || prev.modal.asin !== product.asin) return prev
      return {
        ...prev,
        validating: false,
        validated: false,
        error: null,
      }
    })

    return { validated: false as const, product }
  }, [])

  useEffect(() => {
    const nextBanner = parseDashboardSearchMessage(window.location.search)
    if (nextBanner) setBanner(nextBanner)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

  useEffect(() => {
    const productListingActive = !!finderState.listAllProgress && finderState.listAllProgress.done < finderState.listAllProgress.total
    const continuousListingActive = !!continuousFinderState.listAllProgress && continuousFinderState.listAllProgress.done < continuousFinderState.listAllProgress.total
    const activeResults = tab === 'product'
      ? finderState.results
      : tab === 'continuous'
        ? continuousFinderState.results
        : null

    if (
      !activeResults ||
      activeResults.length <= 1 ||
      listingState.modal ||
      (tab === 'product' && productListingActive) ||
      (tab === 'continuous' && continuousListingActive)
    ) {
      return
    }

    const timer = window.setInterval(() => {
      setFinderRotationTick((tick) => tick + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [
    continuousFinderState.listAllProgress,
    continuousFinderState.results,
    finderState.listAllProgress,
    finderState.results,
    listingState.modal,
    tab,
  ])

  const getEbayConnectionState = useCallback((credentials: EbayCredentialsSummary | null) => {
    const hasToken = Boolean(credentials?.has_token)
    const hasRefreshToken = Boolean(credentials?.has_refresh_token)
    const tokenExpired = Boolean(credentials?.token_expired)

    return {
      connected: hasToken && (!tokenExpired || hasRefreshToken),
      needsReconnect: hasToken && tokenExpired && !hasRefreshToken,
    }
  }, [])

  const loadOrders = useCallback(async () => {
    setConnectionState((prev) => ({ ...prev, syncing: true }))

    try {
      const data = await fetchOrders()
      setConnectionState((prev) => ({
        ...prev,
        ebayConnected: !!data.connected,
        ebayNeedsReconnect: false,
      }))
      setOrderState((prev) => ({
        ...prev,
        orders: data.recent || [],
        awaiting: (data.awaiting || []).filter((order) => !isRefundedOrder(order)),
        syncTime: new Date().toLocaleTimeString(),
      }))
    } catch (error) {
      const reconnectRequired = isReconnectError(error)
      setConnectionState((prev) => ({
        ...prev,
        ebayConnected: reconnectRequired ? false : prev.ebayConnected,
        ebayNeedsReconnect: reconnectRequired || prev.ebayNeedsReconnect,
      }))
      setBanner({
        tone: 'error',
        text: reconnectRequired
          ? 'Your eBay session expired. Reconnect in Settings to resume syncing.'
          : getErrorMessage(error, 'Unable to sync eBay orders.'),
      })
    } finally {
      setConnectionState((prev) => ({ ...prev, syncing: false }))
    }
  }, [])

  const loadFinancials = useCallback(async (period?: string) => {
    setFinancialState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchFinancials(period ?? financialPeriod)
      setFinancialState({ loading: false, summary: data.summary, items: data.items || [], error: null })
    } catch (error) {
      setFinancialState((prev) => ({ ...prev, loading: false, error: getErrorMessage(error, 'Unable to load financial data.') }))
    }
  }, [financialPeriod])

  const loadPerformance = useCallback(async () => {
    setPerformanceState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await fetchPerformance()
      setPerformanceState({
        loading: false,
        data,
        error: null,
      })
    } catch (error) {
      setPerformanceState((prev) => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error, 'Unable to load performance data.'),
      }))
    }
  }, [])

  const loadProductSourceHealth = useCallback(async () => {
    setSourceHealthState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await fetchProductSourceHealth()
      setSourceHealthState({
        loading: false,
        data,
        error: null,
      })
    } catch (error) {
      setSourceHealthState((prev) => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error, 'Unable to load product source health.'),
      }))
    }
  }, [])

  const loadDashboardBootstrap = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchEbayCredentials(),
      fetchUserNiche(),
      fetchOrderAsinMap(),
    ])

    const [ebayResult, nicheResult, orderMapResult] = results

    if (ebayResult.status === 'fulfilled') {
      const nextState = getEbayConnectionState(ebayResult.value.credentials)
      setConnectionState((prev) => ({
        ...prev,
        ebayConnected: nextState.connected,
        ebayNeedsReconnect: nextState.needsReconnect,
      }))
    } else {
      setBanner((prev) => prev ?? { tone: 'error', text: 'Unable to load your eBay connection status.' })
    }

    if (nicheResult.status === 'fulfilled') {
      setNicheState((prev) => ({ ...prev, value: nicheResult.value.niche }))
    } else {
      setBanner((prev) => prev ?? { tone: 'error', text: 'Unable to load your saved niche.' })
    }

    if (orderMapResult.status === 'fulfilled') {
      setOrderState((prev) => ({ ...prev, orderAsinMap: orderMapResult.value.map || {} }))
    } else {
      setBanner((prev) => prev ?? { tone: 'error', text: 'Unable to load tracked listing mappings.' })
    }
  }, [getEbayConnectionState])

  const handleDisconnectEbay = useCallback(async () => {
    const confirmed = window.confirm('Disconnect eBay from this dashboard? You can reconnect it again from Settings.')
    if (!confirmed) return

    setDisconnectingEbay(true)
    try {
      await disconnectEbay()
      setConnectionState((prev) => ({
        ...prev,
        ebayConnected: false,
        ebayNeedsReconnect: false,
      }))
      setOrderState((prev) => ({
        ...prev,
        orders: [],
        awaiting: [],
        orderAsinMap: {},
      }))
      setFinancialState((prev) => ({
        ...prev,
        summary: null,
        items: [],
        error: null,
      }))
      setPerformanceState((prev) => ({
        ...prev,
        data: null,
        error: null,
      }))
      setSourceHealthState((prev) => ({
        ...prev,
        data: null,
        error: null,
      }))
      setBanner({ tone: 'success', text: 'eBay disconnected. Connect it again to refresh your token.' })
    } catch (error) {
      setBanner({ tone: 'error', text: getErrorMessage(error, 'Unable to disconnect eBay.') })
    } finally {
      setDisconnectingEbay(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      void loadDashboardBootstrap()
      void loadOrders()
      void loadFinancials()
    }
  }, [loadDashboardBootstrap, loadFinancials, loadOrders, status])

  useEffect(() => {
    if (status === 'authenticated' && tab === 'performance' && !performanceState.data && !performanceState.loading && !performanceState.error) {
      void loadPerformance()
    }
  }, [loadPerformance, performanceState.data, performanceState.error, performanceState.loading, status, tab])

  useEffect(() => {
    if (status === 'authenticated' && tab === 'settings' && !sourceHealthState.data && !sourceHealthState.loading && !sourceHealthState.error) {
      void loadProductSourceHealth()
    }
  }, [loadProductSourceHealth, sourceHealthState.data, sourceHealthState.error, sourceHealthState.loading, status, tab])

  const handleSaveNiche = useCallback(async (value: string) => {
    setNicheState((prev) => ({ ...prev, value, saving: true }))

    try {
      await saveUserNiche(value)
      setNicheState((prev) => ({ ...prev, saved: true }))
      setFinderState((prev) => ({ ...prev, results: null, error: null, listAllProgress: null }))
      window.setTimeout(() => {
        setNicheState((prev) => ({ ...prev, saved: false }))
      }, 2000)
    } catch (error) {
      setBanner({ tone: 'error', text: getErrorMessage(error, 'Unable to save niche.') })
    } finally {
      setNicheState((prev) => ({ ...prev, saving: false }))
    }
  }, [])

  const handleLookupAsin = useCallback(async () => {
    const raw = lookupState.input.trim().toUpperCase()
    if (!raw) return

    const isDirectAsin = /^(?=.*[A-Z])[A-Z0-9]{10}$/.test(raw)
    const isItemId = /^\d+$/.test(raw) && !isDirectAsin

    if (!isItemId && !isDirectAsin) {
      setLookupState((prev) => ({ ...prev, error: 'Enter a numeric eBay item ID or a valid 10-character Amazon ASIN.' }))
      return
    }

    setLookupState((prev) => ({ ...prev, input: raw, loading: true, error: null, result: null, rejectedAsins: [] }))

    try {
      const result = isDirectAsin ? await validateAmazonAsin(raw) : await lookupAsinByItemId(raw)
      setLookupState((prev) => ({ ...prev, result, manualAsin: result.asin }))
    } catch (error) {
      setLookupState((prev) => ({
        ...prev,
        error: isItemId && isReconnectError(error)
          ? 'Your eBay connection expired. Reconnect it in Settings.'
          : getErrorMessage(error, 'Lookup failed. Please try again.'),
      }))
    } finally {
      setLookupState((prev) => ({ ...prev, loading: false }))
    }
  }, [lookupState.input])

  const handleRejectCurrentAsin = useCallback(async () => {
    const itemId = lookupState.input.trim()
    const currentAsin = lookupState.result?.asin
    if (!itemId || !currentAsin) return
    if (!/^\d+$/.test(itemId)) {
      setLookupState((prev) => ({ ...prev, error: 'Alternate matching works with a numeric eBay item ID. Direct ASIN lookup already points to a specific Amazon product.' }))
      return
    }

    const rejectedAsins = Array.from(new Set([...lookupState.rejectedAsins, currentAsin]))
    setLookupState((prev) => ({ ...prev, loading: true, error: null, rejectedAsins }))

    try {
      const result = await lookupAsinByItemId(itemId, rejectedAsins)
      setLookupState((prev) => ({ ...prev, result, manualAsin: result.asin }))
    } catch (error) {
      setLookupState((prev) => ({
        ...prev,
        result: null,
        error: getErrorMessage(error, 'No alternate match found. Paste the correct ASIN and save it manually.'),
      }))
    } finally {
      setLookupState((prev) => ({ ...prev, loading: false }))
    }
  }, [lookupState.input, lookupState.rejectedAsins, lookupState.result?.asin])

  const handleSaveManualAsinMapping = useCallback(async (asinOverride?: string) => {
    const itemId = lookupState.input.trim()
    const asin = (asinOverride || lookupState.manualAsin).trim().toUpperCase()
    if (!/^\d+$/.test(itemId) || !/^[A-Z0-9]{10}$/.test(asin)) {
      setLookupState((prev) => ({ ...prev, error: 'Enter a numeric eBay item ID and a valid 10-character Amazon ASIN.' }))
      return
    }

    setLookupState((prev) => ({ ...prev, savingManual: true, error: null }))
    try {
      const result = await saveManualAsinMapping(itemId, asin)
      setLookupState((prev) => ({ ...prev, result, manualAsin: result.asin }))
      setOrderState((prev) => ({
        ...prev,
        orderAsinMap: {
          ...prev.orderAsinMap,
          [itemId]: {
            asin: result.asin,
            title: result.title,
            amazonUrl: result.amazonUrl,
            imageUrl: result.imageUrl,
          },
        },
      }))
      setBanner({ tone: 'success', text: `Saved ASIN ${result.asin} for eBay item #${itemId}.` })
      void loadFinancials()
    } catch (error) {
      setLookupState((prev) => ({
        ...prev,
        error: getErrorMessage(error, 'Unable to save ASIN mapping.'),
      }))
    } finally {
      setLookupState((prev) => ({ ...prev, savingManual: false }))
    }
  }, [loadFinancials, lookupState.input, lookupState.manualAsin])

  const handleConfirmCurrentAsin = useCallback(async () => {
    const currentAsin = lookupState.result?.asin
    if (!currentAsin) return
    setLookupState((prev) => ({ ...prev, manualAsin: currentAsin }))
    await handleSaveManualAsinMapping(currentAsin)
  }, [handleSaveManualAsinMapping, lookupState.result?.asin])

  const handleFindProducts = useCallback(async () => {
    if (!nicheState.value) return

    setFinderState((prev) => ({ ...prev, loading: true, error: null, results: null, listAllProgress: null }))
    setBanner((prev) => (prev?.tone === 'error' ? null : prev))

    try {
      const data = await fetchFinderProducts(nicheState.value, false, { limit: FINDER_ROTATION_POOL_TARGET })
      setFinderState((prev) => ({ ...prev, results: tagFinderProducts(data.results || [], 'niche') }))
    } catch (error) {
      setFinderState((prev) => ({ ...prev, error: getErrorMessage(error, 'Product search failed.') }))
    } finally {
      setFinderState((prev) => ({ ...prev, loading: false }))
    }
  }, [nicheState.value])

  const handleFindContinuousProducts = useCallback(async () => {
    setContinuousFinderState((prev) => ({ ...prev, loading: true, error: null, results: prev.results, listAllProgress: null }))
    setBanner((prev) => (prev?.tone === 'error' ? null : prev))

    try {
      const shouldForceRefresh = Boolean(continuousFinderState.results?.length)
      const data = await fetchFinderProducts('', shouldForceRefresh, { mode: 'continuous', limit: FINDER_ROTATION_POOL_TARGET })
      setContinuousFinderState((prev) => ({ ...prev, results: tagFinderProducts(data.results || [], 'continuous') }))
    } catch (error) {
      setContinuousFinderState((prev) => ({ ...prev, results: prev.results || [], error: getErrorMessage(error, 'Continuous product search failed.') }))
    } finally {
      setContinuousFinderState((prev) => ({ ...prev, loading: false }))
    }
  }, [continuousFinderState.results])

  useEffect(() => {
    if (tab === 'continuous' && !continuousFinderState.results && !continuousFinderState.loading && !continuousFinderState.error) {
      void handleFindContinuousProducts()
    }
  }, [continuousFinderState.error, continuousFinderState.loading, continuousFinderState.results, handleFindContinuousProducts, tab])

  const publishFinderProduct = useCallback(
    async (product: FinderProduct, opts?: { trusted?: boolean; categoryId?: string }) => {
      const productNiche = product.sourceMode === 'continuous' ? product.sourceNiche || null : nicheState.value

      try {
        const data = await publishProduct({
          asin: product.asin,
          title: product.title,
          ebayPrice: product.ebayPrice,
          amazonPrice: product.amazonPrice,
          imageUrl: product.imageUrl,
          images: product.images,
          features: product.features,
          description: product.description,
          specs: product.specs,
          niche: productNiche,
          trusted: opts?.trusted,
          categoryId: opts?.categoryId,
        })

        return { asin: data.listingId ? product.asin : undefined }
      } catch (error) {
        if (isReconnectError(error)) return { reconnectRequired: true }
        const code = error instanceof DashboardApiError ? error.code : undefined
        return {
          errorCode: code || 'LISTING_FAILED',
          errorMessage: getErrorMessage(error, 'Listing failed.'),
        }
      }
    },
    [nicheState.value]
  )

  const refillNicheFinderProducts = useCallback(
    async (removeAsins: string[]) => {
      if (!nicheState.value || removeAsins.length === 0) return

      const listed = new Set(removeAsins.map((asin) => asin.toUpperCase()))
      const remainingAsins = (finderState.results || [])
        .filter((product) => !listed.has(product.asin.toUpperCase()))
        .map((product) => product.asin)

      try {
        const refreshed = await fetchFinderProducts(nicheState.value, true, {
          limit: FINDER_ROTATION_POOL_TARGET,
          excludeAsins: [...remainingAsins, ...removeAsins],
        })
        setFinderState((prev) => ({
          ...prev,
          results: mergeRefilledProducts(prev.results || finderState.results, refreshed.results || [], removeAsins, 'niche'),
        }))
      } catch {
        setFinderState((prev) => ({
          ...prev,
          results: prev.results ? prev.results.filter((product) => !listed.has(product.asin.toUpperCase())) : prev.results,
        }))
      }
    },
    [finderState.results, nicheState.value]
  )

  const refillContinuousProducts = useCallback(
    async (removeAsins: string[]) => {
      if (removeAsins.length === 0) return

      const listed = new Set(removeAsins.map((asin) => asin.toUpperCase()))
      const remainingAsins = (continuousFinderState.results || [])
        .filter((product) => !listed.has(product.asin.toUpperCase()))
        .map((product) => product.asin)

      try {
        const refreshed = await fetchFinderProducts('', true, {
          mode: 'continuous',
          limit: FINDER_ROTATION_POOL_TARGET,
          excludeAsins: [...remainingAsins, ...removeAsins],
        })
        setContinuousFinderState((prev) => ({
          ...prev,
          results: mergeRefilledProducts(prev.results || continuousFinderState.results, refreshed.results || [], removeAsins, 'continuous'),
        }))
      } catch {
        setContinuousFinderState((prev) => ({
          ...prev,
          results: prev.results ? prev.results.filter((product) => !listed.has(product.asin.toUpperCase())) : prev.results,
        }))
      }
    },
    [continuousFinderState.results]
  )

  const handleListAll = useCallback(async () => {
    if (!connectionState.ebayConnected) {
      setBanner({ tone: 'error', text: 'Connect eBay first in Settings.' })
      return
    }

    const products = visibleFinderResults || []
    if (products.length === 0) return

    const result = await listProductsInBatches({
      products,
      publish: (product) => {
        // Skip trusted mode when images are sparse or niche needs full re-validation
        const needsValidation = (product.images?.length ?? 0) < 2 || !product.images?.length
        return publishFinderProduct(product, { trusted: !needsValidation })
      },
      preflight: getBulkPreflightIssue,
      onProgress: (progress) => {
        setFinderState((prev) => ({ ...prev, listAllProgress: progress }))
      },
      concurrency: 3,
    })

    if (result.reconnectRequired) {
      setListingState((prev) => ({ ...prev, error: 'RECONNECT_REQUIRED' }))
      setConnectionState((prev) => ({ ...prev, ebayConnected: false, ebayNeedsReconnect: true }))
      setBanner({ tone: 'error', text: 'Your eBay session expired while listing. Reconnect in Settings and try again.' })
      return
    }

    const terminalAsins = [...result.listedAsins, ...result.failedAsins, ...result.skippedAsins]
    if (result.errors > 0) {
      await refillNicheFinderProducts(terminalAsins)
      setBanner({
        tone: 'error',
        text: summarizeBulkListResult(result),
      })
      return
    }

    await refillNicheFinderProducts(terminalAsins)

    setBanner({
      tone: 'success',
      text: summarizeBulkListResult(result),
    })
  }, [connectionState.ebayConnected, publishFinderProduct, refillNicheFinderProducts, visibleFinderResults])

  const handleContinuousListAll = useCallback(async () => {
    if (!connectionState.ebayConnected) {
      setBanner({ tone: 'error', text: 'Connect eBay first in Settings.' })
      return
    }

    const products = tagFinderProducts(visibleContinuousResults || [], 'continuous')
    if (products.length === 0) return

    const result = await listProductsInBatches({
      products,
      publish: (product) => {
        const needsValidation = (product.images?.length ?? 0) < 2 || !product.images?.length
        return publishFinderProduct(product, { trusted: !needsValidation })
      },
      preflight: getBulkPreflightIssue,
      onProgress: (progress) => {
        setContinuousFinderState((prev) => ({ ...prev, listAllProgress: progress }))
      },
      concurrency: 2,
    })

    if (result.reconnectRequired) {
      setListingState((prev) => ({ ...prev, error: 'RECONNECT_REQUIRED' }))
      setConnectionState((prev) => ({ ...prev, ebayConnected: false, ebayNeedsReconnect: true }))
      setBanner({ tone: 'error', text: 'Your eBay session expired while listing. Reconnect in Settings and try again.' })
      return
    }

    const terminalAsins = [...result.listedAsins, ...result.failedAsins, ...result.skippedAsins]
    if (result.errors > 0) {
      await refillContinuousProducts(terminalAsins)
      setBanner({
        tone: 'error',
        text: summarizeBulkListResult(result),
      })
      return
    }

    await refillContinuousProducts(terminalAsins)
    setBanner({
      tone: 'success',
      text: summarizeBulkListResult(result),
    })
  }, [connectionState.ebayConnected, publishFinderProduct, refillContinuousProducts, visibleContinuousResults])

  const handleRunScript = useCallback(async (file: string) => {
    setScriptRunning(file)
    setScriptMessage(null)

    try {
      const data = await runDashboardScript(file)
      setScriptMessage({ file, tone: 'info', text: data.message || 'Completed.' })
    } catch (error) {
      setScriptMessage({ file, tone: 'error', text: getErrorMessage(error, 'Failed to run script.') })
    } finally {
      setScriptRunning(null)
    }
  }, [])

  const openListModal = useCallback((product: FinderProduct) => {
    setListingState({
      modal: product,
      price: product.ebayPrice.toFixed(2),
      validating: true,
      validated: false,
      loading: false,
      result: null,
      error: null,
    })
    void validateListingProduct(product)
  }, [validateListingProduct])

  const closeListModal = useCallback(() => {
    setListingState((prev) => ({
      ...prev,
      modal: null,
      validating: false,
      validated: false,
      result: null,
      error: null,
    }))
  }, [])

  const handlePublishCurrentProduct = useCallback(async () => {
    if (!listingState.modal) return

    let productToPublish = listingState.modal
    let priceValue = listingState.price

    if (!listingState.validated) {
      const validationResult = await validateListingProduct(listingState.modal)
      if (!validationResult.validated) {
        setListingState((prev) => ({
          ...prev,
          error: 'Amazon validation did not finish cleanly. Validation was retried once but still did not confirm a live Amazon title, image, and cost.',
        }))
        return
      }
      productToPublish = validationResult.product
      if (priceValue === listingState.modal.ebayPrice.toFixed(2)) {
        priceValue = validationResult.product.ebayPrice.toFixed(2)
      }
    }

    const parsedPrice = parseFloat(priceValue)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setListingState((prev) => ({ ...prev, error: 'Enter a valid eBay price before publishing.' }))
      return
    }

    setListingState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const sourceMode = productToPublish.sourceMode === 'continuous' ? 'continuous' : 'niche'
      const productNiche = sourceMode === 'continuous' ? productToPublish.sourceNiche || null : nicheState.value

      const data = await publishProduct({
        asin: productToPublish.asin,
        title: productToPublish.title,
        ebayPrice: parsedPrice,
        amazonPrice: productToPublish.amazonPrice,
        imageUrl: productToPublish.imageUrl,
        images: productToPublish.images,
        features: productToPublish.features,
        description: productToPublish.description,
        specs: productToPublish.specs,
        niche: productNiche,
      })

      setListingState((prev) => ({ ...prev, result: data }))
      if (sourceMode === 'continuous') {
        await refillContinuousProducts([productToPublish.asin])
      } else {
        await refillNicheFinderProducts([productToPublish.asin])
      }
      setBanner({ tone: 'success', text: `Listing ${data.listingId} is now live on eBay.` })
    } catch (error) {
      setListingState((prev) => ({
        ...prev,
        error: isReconnectError(error) ? 'RECONNECT_REQUIRED' : getErrorMessage(error, 'Something went wrong. Please try again.'),
      }))
      if (isReconnectError(error)) {
        setConnectionState((prev) => ({ ...prev, ebayConnected: false, ebayNeedsReconnect: true }))
      }
    } finally {
      setListingState((prev) => ({ ...prev, loading: false }))
    }
  }, [listingState.modal, listingState.price, listingState.validated, nicheState.value, refillContinuousProducts, refillNicheFinderProducts, validateListingProduct])

  const grossRevenue = useMemo(() => getGrossRevenue(orderState.orders), [orderState.orders])

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ color: 'var(--dim)', fontSize: '13px', letterSpacing: '0.1em' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <DashboardSidebar
        tab={tab}
        onTabChange={setTab}
        connected={connectionState.ebayConnected}
        niche={nicheState.value}
        awaitingCount={orderState.awaiting.length}
        userLabel={session?.user?.name || session?.user?.email}
        onSignOut={() => signOut({ callbackUrl: '/' })}
      />

      <main className="dashboard-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <DashboardBanner banner={banner} onClose={() => setBanner(null)} />
        <DashboardTopbar
          tab={tab}
          syncTime={orderState.syncTime}
          syncing={connectionState.syncing}
          onSync={() => {
            void loadOrders()
            void loadFinancials()
            if (tab === 'performance') void loadPerformance()
            if (tab === 'settings') void loadProductSourceHealth()
          }}
        />

        <div className="dashboard-content" style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'overview' ? (
            <OverviewTab connected={connectionState.ebayConnected} orders={orderState.orders} awaitingCount={orderState.awaiting.length} grossRevenue={grossRevenue} onOpenSettings={() => setTab('settings')} />
          ) : null}
          {tab === 'orders' ? (
            <OrdersTab connected={connectionState.ebayConnected} orders={orderState.orders} awaiting={orderState.awaiting} grossRevenue={grossRevenue} onOpenSettings={() => setTab('settings')} />
          ) : null}
          {tab === 'financials' ? (
            <FinancialsTab
              connected={connectionState.ebayConnected}
              loading={financialState.loading}
              error={financialState.error}
              summary={financialState.summary}
              items={financialState.items}
              period={financialPeriod}
              onPeriodChange={(p) => { setFinancialPeriod(p); void loadFinancials(p) }}
              onRefresh={() => void loadFinancials()}
              onOpenSettings={() => setTab('settings')}
            />
          ) : null}
          {tab === 'performance' ? (
            <PerformanceTab
              connected={connectionState.ebayConnected}
              loading={performanceState.loading}
              error={performanceState.error}
              data={performanceState.data}
              onRefresh={() => void loadPerformance()}
              onOpenSettings={() => setTab('settings')}
              onOpenProductFinder={() => setTab('product')}
            />
          ) : null}
          {tab === 'scripts' ? (
            <ScriptsTab scriptRunning={scriptRunning} scriptMessage={scriptMessage} onRunScript={(file) => handleRunScript(file)} onOpenProductFinder={() => setTab('product')} />
          ) : null}
          {tab === 'asin' ? (
            <AsinLookupTab
              asinInput={lookupState.input}
              onAsinInputChange={(value) => setLookupState((prev) => ({ ...prev, input: value }))}
              onLookup={() => void handleLookupAsin()}
              asinLoading={lookupState.loading}
              asinError={lookupState.error}
              asinResult={lookupState.result}
              manualAsin={lookupState.manualAsin}
              onManualAsinChange={(value) => setLookupState((prev) => ({ ...prev, manualAsin: value }))}
              onSaveManualMapping={() => void handleSaveManualAsinMapping()}
              onConfirmCurrent={() => void handleConfirmCurrentAsin()}
              onRejectCurrent={() => void handleRejectCurrentAsin()}
              manualSaving={lookupState.savingManual}
              orders={orderState.orders}
              orderAsinMap={orderState.orderAsinMap}
              onReset={() => setLookupState({ input: '', manualAsin: '', rejectedAsins: [], result: null, loading: false, savingManual: false, error: null })}
            />
          ) : null}
          {tab === 'product' ? (
            <ProductListingTab
              niche={nicheState.value}
              nicheSaving={nicheState.saving}
              onSelectNiche={(value) => void handleSaveNiche(value)}
              onClearNiche={() => {
                setNicheState((prev) => ({ ...prev, value: null }))
                setFinderState({ loading: false, results: null, error: null, view: 'cards', listAllProgress: null })
              }}
              finderLoading={finderState.loading}
              finderResults={visibleFinderResults}
              finderError={finderState.error}
              finderView={finderState.view}
              onFinderViewChange={(view) => setFinderState((prev) => ({ ...prev, view }))}
              onFindProducts={() => void handleFindProducts()}
              onOpenAsinLookup={() => setTab('asin')}
              onOpenScripts={() => setTab('scripts')}
              onOpenListModal={(product) => openListModal({ ...product, sourceMode: 'niche' })}
              onListAll={() => void handleListAll()}
              listAllProgress={finderState.listAllProgress}
              connected={connectionState.ebayConnected}
            />
          ) : null}
          {tab === 'continuous' ? (
            <ContinuousListingTab
              finderLoading={continuousFinderState.loading}
              finderResults={visibleContinuousResults}
              finderError={continuousFinderState.error}
              finderView={continuousFinderState.view}
              onFinderViewChange={(view) => setContinuousFinderState((prev) => ({ ...prev, view }))}
              onFindProducts={() => void handleFindContinuousProducts()}
              onOpenListModal={(product) => openListModal({ ...product, sourceMode: 'continuous' })}
              onListAll={() => void handleContinuousListAll()}
              listAllProgress={continuousFinderState.listAllProgress}
              connected={connectionState.ebayConnected}
            />
          ) : null}
          {tab === 'campaigns' ? (
            <CampaignsTab connected={connectionState.ebayConnected} />
          ) : null}
          {tab === 'settings' ? (
            <SettingsTab
              connected={connectionState.ebayConnected}
              needsReconnect={connectionState.ebayNeedsReconnect}
              niche={nicheState.value}
              nicheSaved={nicheState.saved}
              onSync={() => {
                void loadOrders()
                void loadFinancials()
                void loadPerformance()
                void loadProductSourceHealth()
              }}
              onDisconnectEbay={() => void handleDisconnectEbay()}
              disconnectingEbay={disconnectingEbay}
              onOpenProductTab={() => setTab('product')}
              sourceHealth={sourceHealthState.data}
              sourceHealthLoading={sourceHealthState.loading}
              sourceHealthError={sourceHealthState.error}
              onRefreshSourceHealth={() => void loadProductSourceHealth()}
            />
          ) : null}
        </div>
      </main>

      <SellOnEbayModal
        product={listingState.modal}
        listPrice={listingState.price}
        onListPriceChange={(value) => setListingState((prev) => ({ ...prev, price: value }))}
        validating={listingState.validating}
        validated={listingState.validated}
        listLoading={listingState.loading}
        listResult={listingState.result}
        listError={listingState.error}
        onClose={closeListModal}
        onPublish={() => handlePublishCurrentProduct()}
      />
    </div>
  )
}
