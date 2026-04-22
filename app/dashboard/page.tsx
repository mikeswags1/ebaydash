'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardSidebar } from './components/DashboardSidebar'
import { DashboardBanner, DashboardTopbar } from './components/DashboardTopbar'
import { OverviewTab } from './components/OverviewTab'
import { OrdersTab } from './components/OrdersTab'
import { FinancialsTab } from './components/FinancialsTab'
import { ScriptsTab } from './components/ScriptsTab'
import { AsinLookupTab } from './components/AsinLookupTab'
import { ProductListingTab } from './components/ProductListingTab'
import { SettingsTab } from './components/SettingsTab'
import { SellOnEbayModal } from './components/SellOnEbayModal'
import type { BannerState, EbayCredentialsSummary, FinancialItem, FinancialSummary, FinderProduct, ListProgress, OrderAsinMap, ScriptMessage, Tab } from './types'
import type { AsinResult, EbayOrder, ListResult } from './types'
import {
  fetchFinancials,
  fetchAmazonCredentials,
  fetchEbayCredentials,
  fetchFinderProducts,
  fetchOrderAsinMap,
  fetchOrders,
  fetchUserNiche,
  getErrorMessage,
  isReconnectError,
  lookupAsinByItemId,
  publishProduct,
  runDashboardScript,
  saveUserNiche,
  validateAmazonAsin,
} from './api'
import { EBAY_FEE_RATE } from './constants'
import { getGrossRevenue, listProductsInBatches, parseDashboardSearchMessage } from './utils'

type ConnectionState = {
  ebayConnected: boolean
  ebayNeedsReconnect: boolean
  amazonConnected: boolean
  amazonSellerId: string | null
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

type NicheState = {
  value: string | null
  saving: boolean
  saved: boolean
}

type LookupState = {
  input: string
  result: AsinResult | null
  loading: boolean
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

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('overview')
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    ebayConnected: false,
    ebayNeedsReconnect: false,
    amazonConnected: false,
    amazonSellerId: null,
    syncing: false,
  })
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
  const [nicheState, setNicheState] = useState<NicheState>({
    value: null,
    saving: false,
    saved: false,
  })
  const [lookupState, setLookupState] = useState<LookupState>({
    input: '',
    result: null,
    loading: false,
    error: null,
  })
  const [finderState, setFinderState] = useState<FinderState>({
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

  useEffect(() => {
    const nextBanner = parseDashboardSearchMessage(window.location.search)
    if (nextBanner) setBanner(nextBanner)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [router, status])

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
        awaiting: data.awaiting || [],
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

  const loadFinancials = useCallback(async () => {
    setFinancialState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await fetchFinancials()
      setFinancialState({
        loading: false,
        summary: data.summary,
        items: data.items || [],
        error: null,
      })
    } catch (error) {
      setFinancialState((prev) => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error, 'Unable to load financial data.'),
      }))
    }
  }, [])

  const loadDashboardBootstrap = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchEbayCredentials(),
      fetchUserNiche(),
      fetchAmazonCredentials(),
      fetchOrderAsinMap(),
    ])

    const [ebayResult, nicheResult, amazonResult, orderMapResult] = results

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

    if (amazonResult.status === 'fulfilled') {
      setConnectionState((prev) => ({
        ...prev,
        amazonConnected: !!amazonResult.value.connected,
        amazonSellerId: amazonResult.value.sellingPartnerId || null,
      }))
    } else {
      setBanner((prev) => prev ?? { tone: 'error', text: 'Unable to load your Amazon connection status.' })
    }

    if (orderMapResult.status === 'fulfilled') {
      setOrderState((prev) => ({ ...prev, orderAsinMap: orderMapResult.value.map || {} }))
    } else {
      setBanner((prev) => prev ?? { tone: 'error', text: 'Unable to load tracked listing mappings.' })
    }
  }, [getEbayConnectionState])

  useEffect(() => {
    if (status === 'authenticated') {
      void loadDashboardBootstrap()
      void loadOrders()
      void loadFinancials()
    }
  }, [loadDashboardBootstrap, loadFinancials, loadOrders, status])

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
    const raw = lookupState.input.trim()
    if (!raw) return
    if (!/^\d+$/.test(raw)) {
      setLookupState((prev) => ({ ...prev, error: 'Please enter the numeric eBay item ID shown on your order.' }))
      return
    }

    setLookupState((prev) => ({ ...prev, loading: true, error: null, result: null }))

    try {
      const result = await lookupAsinByItemId(raw)
      setLookupState((prev) => ({ ...prev, result }))
    } catch (error) {
      setLookupState((prev) => ({
        ...prev,
        error: isReconnectError(error)
          ? 'Your eBay connection expired. Reconnect it in Settings.'
          : getErrorMessage(error, 'Lookup failed. Please try again.'),
      }))
    } finally {
      setLookupState((prev) => ({ ...prev, loading: false }))
    }
  }, [lookupState.input])

  const handleFindProducts = useCallback(async () => {
    if (!nicheState.value) return

    setFinderState((prev) => ({ ...prev, loading: true, error: null, results: null, listAllProgress: null }))
    setBanner((prev) => (prev?.tone === 'error' ? null : prev))

    try {
      const data = await fetchFinderProducts(nicheState.value)
      setFinderState((prev) => ({ ...prev, results: data.results || [] }))
    } catch (error) {
      setFinderState((prev) => ({ ...prev, error: getErrorMessage(error, 'Product search failed.') }))
    } finally {
      setFinderState((prev) => ({ ...prev, loading: false }))
    }
  }, [nicheState.value])

  const publishFinderProduct = useCallback(
    async (product: FinderProduct) => {
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
          niche: nicheState.value,
        })

        return { asin: data.listingId ? product.asin : undefined }
      } catch (error) {
        if (isReconnectError(error)) return { reconnectRequired: true }
        return {}
      }
    },
    [nicheState.value]
  )

  const handleListAll = useCallback(async () => {
    if (!connectionState.ebayConnected) {
      setBanner({ tone: 'error', text: 'Connect eBay first in Settings.' })
      return
    }

    const products = finderState.results || []
    if (products.length === 0) return

    const result = await listProductsInBatches({
      products,
      publish: publishFinderProduct,
      onProgress: (progress) => {
        setFinderState((prev) => ({ ...prev, listAllProgress: progress }))
      },
    })

    if (result.reconnectRequired) {
      setListingState((prev) => ({ ...prev, error: 'RECONNECT_REQUIRED' }))
      setConnectionState((prev) => ({ ...prev, ebayConnected: false, ebayNeedsReconnect: true }))
      setBanner({ tone: 'error', text: 'Your eBay session expired while listing. Reconnect in Settings and try again.' })
      return
    }

    if (result.listedAsins.length > 0) {
      setFinderState((prev) => ({
        ...prev,
        results: prev.results ? prev.results.filter((product) => !result.listedAsins.includes(product.asin)) : prev.results,
      }))
    }

    if (result.errors > 0) {
      setBanner({
        tone: 'error',
        text: `${result.listedAsins.length} product${result.listedAsins.length === 1 ? '' : 's'} listed, ${result.errors} failed. Review the remaining items and try again.`,
      })
      return
    }

    setBanner({
      tone: 'success',
      text: `${result.listedAsins.length} product${result.listedAsins.length === 1 ? '' : 's'} listed successfully.`,
    })
  }, [connectionState.ebayConnected, finderState.results, publishFinderProduct])

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
    void (async () => {
      try {
        const validated = await validateAmazonAsin(product.asin)
        setListingState((prev) => {
          if (!prev.modal || prev.modal.asin !== product.asin) return prev

          return {
            ...prev,
            modal: {
              ...prev.modal,
              title: validated.title,
              amazonPrice: validated.amazonPrice,
              imageUrl: validated.imageUrl || prev.modal.imageUrl,
              images: validated.images || prev.modal.images,
              features: validated.features || prev.modal.features,
              description: validated.description || prev.modal.description,
              specs: validated.specs || prev.modal.specs,
            },
            validating: false,
            validated: Boolean(validated.imageUrl && validated.amazonPrice > 0),
            error: null,
          }
        })
      } catch (error) {
        setListingState((prev) => {
          if (!prev.modal || prev.modal.asin !== product.asin) return prev

          return {
            ...prev,
            validating: false,
            validated: false,
            error: null,
          }
        })
      }
    })()
  }, [])

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

    const parsedPrice = parseFloat(listingState.price)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setListingState((prev) => ({ ...prev, error: 'Enter a valid eBay price before publishing.' }))
      return
    }

    setListingState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await publishProduct({
        asin: listingState.modal.asin,
        title: listingState.modal.title,
        ebayPrice: parsedPrice,
        amazonPrice: listingState.modal.amazonPrice,
        imageUrl: listingState.modal.imageUrl,
        images: listingState.modal.images,
        features: listingState.modal.features,
        description: listingState.modal.description,
        specs: listingState.modal.specs,
        niche: nicheState.value,
      })

      setListingState((prev) => ({ ...prev, result: data }))
      setFinderState((prev) => ({
        ...prev,
        results: prev.results ? prev.results.filter((product) => product.asin !== listingState.modal?.asin) : prev.results,
      }))
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
  }, [listingState.modal, listingState.price, nicheState.value])

  const grossRevenue = useMemo(() => getGrossRevenue(orderState.orders), [orderState.orders])

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ color: 'var(--dim)', fontSize: '13px', letterSpacing: '0.1em' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <DashboardSidebar
        tab={tab}
        onTabChange={setTab}
        connected={connectionState.ebayConnected}
        niche={nicheState.value}
        awaitingCount={orderState.awaiting.length}
        userLabel={session?.user?.name || session?.user?.email}
        onSignOut={() => signOut({ callbackUrl: '/' })}
      />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <DashboardBanner banner={banner} onClose={() => setBanner(null)} />
        <DashboardTopbar
          tab={tab}
          syncTime={orderState.syncTime}
          syncing={connectionState.syncing}
          onSync={() => {
            void loadOrders()
            void loadFinancials()
          }}
        />

        <div style={{ flex: 1, overflowY: 'auto' }}>
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
              onRefresh={() => void loadFinancials()}
              onOpenSettings={() => setTab('settings')}
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
              orders={orderState.orders}
              orderAsinMap={orderState.orderAsinMap}
              onReset={() => setLookupState({ input: '', result: null, loading: false, error: null })}
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
              finderResults={finderState.results}
              finderError={finderState.error}
              finderView={finderState.view}
              onFinderViewChange={(view) => setFinderState((prev) => ({ ...prev, view }))}
              onFindProducts={() => void handleFindProducts()}
              onOpenAsinLookup={() => setTab('asin')}
              onOpenScripts={() => setTab('scripts')}
              onOpenListModal={openListModal}
              onListAll={() => void handleListAll()}
              listAllProgress={finderState.listAllProgress}
              connected={connectionState.ebayConnected}
            />
          ) : null}
          {tab === 'settings' ? (
            <SettingsTab
              connected={connectionState.ebayConnected}
              needsReconnect={connectionState.ebayNeedsReconnect}
              amazonConnected={connectionState.amazonConnected}
              amazonSellerId={connectionState.amazonSellerId}
              niche={nicheState.value}
              nicheSaved={nicheState.saved}
              onSync={() => {
                void loadOrders()
                void loadFinancials()
              }}
              onOpenProductTab={() => setTab('product')}
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
