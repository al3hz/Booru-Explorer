import { ref, watch } from 'vue'

export function useDanbooruApi(searchQuery, limit, ratingFilter) {
  const posts = ref([])
  const loading = ref(false)
  const error = ref('')
  const currentPage = ref(1)
  const hasNextPage = ref(false)
  const totalPosts = ref(0)

  const apiBaseUrl = 'https://danbooru.donmai.us'

  // Mejoras añadidas
  const cache = new Map()
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos
  let abortController = null
  const performanceMetrics = ref({
    loadTimes: [],
    cacheHits: 0,
    cacheMisses: 0
  })

  // Función para comprimir tags para clave de caché
  const compressTagsForCache = (tags) => {
    return tags
      .split(' ')
      .filter(tag => tag.trim())
      .sort()
      .join(' ')
      .toLowerCase()
  }

  // Generar clave de caché
  const getCacheKey = (page, tags) => {
    const compressedTags = compressTagsForCache(tags)
    return `${page}-${compressedTags}-${limit.value}`
  }

  // Función de reintento con backoff exponencial
  const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options)
        if (response.ok) return response

        // Solo reintentar en errores transitorios
        if ([429, 502, 503, 504].includes(response.status)) {
          if (i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }
        return response
      } catch (error) {
        if (i === maxRetries - 1) throw error
        const delay = Math.pow(2, i) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // Construir cadena de tags
  const buildTags = () => {
    let tags = searchQuery.value.trim()
      .replace(/[,，]+/g, ' ')
      .replace(/\s+/g, ' ')

    const isHeavySort = tags.includes('order:score') || tags.includes('order:favcount')
    const hasSpecificTags = tags.split(' ').some(t => {
      const low = t.toLowerCase().trim()
      return low && !low.startsWith('order:') &&
        !low.startsWith('rating:') &&
        !low.startsWith('status:') &&
        !low.startsWith('age:') &&
        !low.startsWith('-')
    })
    const isDeletedSearch = tags.includes('status:deleted')

    if ((isHeavySort || isDeletedSearch) && !hasSpecificTags && !tags.includes('age:')) {
      tags = tags ? `${tags} age:<1month` : 'age:<1month'
    }

    if (!isHeavySort && !isDeletedSearch && !tags.includes('status:deleted') && !tags.includes('status:any')) {
      tags = tags ? `${tags} -status:deleted` : '-status:deleted'
    }

    if (ratingFilter.value) {
      tags = tags.replace(/\s*rating:[sqge]/gi, '').trim()
      tags = tags ? `${tags} rating:${ratingFilter.value.toLowerCase()}` :
        `rating:${ratingFilter.value.toLowerCase()}`
    }

    return tags
  }

  // Construir URL de búsqueda
  const buildSearchUrl = (page = 1) => {
    const tags = buildTags()
    const params = new URLSearchParams({
      tags: tags,
      limit: limit.value.toString(),
      page: page.toString()
    })

    return `${apiBaseUrl}/posts.json?${params.toString()}`
  }

  // Obtener la mejor URL de imagen disponible
  const getBestImageUrl = (post) => {
    const urls = [
      { prop: 'file_url', type: 'original' },
      { prop: 'large_file_url', type: 'large' },
      { prop: 'sample_url', type: 'sample' },
      { prop: 'preview_file_url', type: 'preview' }
    ]

    for (const { prop, type } of urls) {
      if (post[prop] && post[prop].trim()) {
        return { url: post[prop], type }
      }
    }

    if (post.media_asset?.variants) {
      const variants = post.media_asset.variants
      const preferredTypes = ['720x720', 'sample', '360x360', '180x180']

      for (const type of preferredTypes) {
        const variant = variants.find(v => v.type === type)
        if (variant?.url) {
          return { url: variant.url, type }
        }
      }
    }

    return null
  }

  // Normalizar posts para asegurar URLs válidas
  const normalizePost = (post) => {
    const bestImage = getBestImageUrl(post)
    if (bestImage) {
      if (!post.file_url) post.file_url = bestImage.url
      if (!post.preview_file_url && !['180x180', '360x360'].includes(bestImage.type)) {
        const previewVariant = post.media_asset?.variants?.find(v =>
          ['180x180', '360x360'].includes(v.type)
        )
        if (previewVariant) post.preview_file_url = previewVariant.url
      }
    }
    return post
  }

  // Prefetch de la siguiente página en background
  const prefetchNextPage = async () => {
    if (!hasNextPage.value || loading.value) return

    const nextPage = currentPage.value + 1
    const tags = buildTags()
    const cacheKey = getCacheKey(nextPage, tags)

    if (!cache.has(cacheKey)) {
      try {
        const url = buildSearchUrl(nextPage)
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          const normalized = data.map(normalizePost).filter(post =>
            getBestImageUrl(post) !== null
          )

          // Determine hasNextPage based on RAW data length vs limit, before filtering
          const hasMore = data.length >= limit.value;

          cache.set(cacheKey, {
            timestamp: Date.now(),
            data: normalized.slice(0, limit.value),
            hasNextPage: hasMore // Store specific flag
          })
        }
      } catch (error) {
        console.debug('Prefetch failed:', error)
      }
    }
  }

  // Función para obtener conteos (MANTENIDA DEL ORIGINAL)
  const fetchCounts = async () => {
    let rawTags = searchQuery.value.trim().replace(/[,，]+/g, ' ').replace(/\s+/g, ' ')

    // Broad Query Check: Skip counting if search is too broad (efficiency)
    // A search is broad if it has no specific tags, just a rating, or just a sort.
    const hasSpecificTags = rawTags.split(' ').some(t => {
      return t && !t.startsWith('order:') && !t.startsWith('rating:') && !t.startsWith('status:') && !t.startsWith('-')
    })

    if (!hasSpecificTags) {
      // Optimization: For very broad searches, don't waste time counting millions of posts
      // This includes global searches, just sorts, or just rating filters.
      // It prevents the "Database Timeout" when doing global order:score searches.
      return null
    }

    try {
      let tags = rawTags
      if (ratingFilter.value) {
        tags = tags.replace(/\s*rating:\w+/g, '')
        tags = tags.trim()
        tags = tags ? `${tags} rating:${ratingFilter.value}` : `rating:${ratingFilter.value}`
      }
      // Proactive Filtering for counts
      // Optimization 1: Remove sorting tags for counts as they are irrelevant and can cause timeouts
      tags = tags.replace(/\s*order:\w+/g, '').trim()

      // Optimization 2: Add safety age filter for broad searches if needed
      // Tightening to 1 month for consistency and stability
      const isHeavyQuery = tags.includes('favcount') || tags.includes('score')
      if (isHeavyQuery && !hasSpecificTags && !tags.includes('age:')) {
        tags = tags ? `${tags} age:<1month` : 'age:<1month'
      }

      if (!tags.includes('status:deleted') && !tags.includes('status:any')) {
        tags = tags ? `${tags} -status:deleted` : '-status:deleted'
      }

      // Final check: if after removing order we are basically doing a global count, skip it.
      const cleanedTags = tags.replace(/\s*order:\w+/g, '').replace(/\s*rating:\w+/g, '').replace(/\s*-status:deleted/g, '').trim()
      if (!cleanedTags && !tags.includes('age:')) {
        return null
      }

      const params = new URLSearchParams({ tags: tags })
      const res = await fetch(`${apiBaseUrl}/counts/posts.json?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        return data.counts && data.counts.posts ? data.counts.posts : null
      }
    } catch (e) {
      console.warn("Failed to fetch counts:", e)
    }
    return null
  }

  // Función principal de búsqueda
  const searchPosts = async (page = 1, isNewSearch = false, append = true) => {
    const startTime = performance.now()

    // Cancelar solicitud anterior
    if (abortController) {
      abortController.abort()
    }

    abortController = new AbortController()

    loading.value = true
    error.value = ''

    try {
      const tags = buildTags()
      const cacheKey = getCacheKey(page, tags)

      // Verificar caché
      const cached = cache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION) && !isNewSearch) {
        performanceMetrics.value.cacheHits++

        // Fix: Align cache behavior with network behavior (append if page > 1)
        // Fix: Replace posts if it's page 1 OR if explicit replace (append=false)
        if (page === 1 || !append) {
          posts.value = cached.data;
        } else {
          // Filter duplicates to be safe, though usually handled by page logic
          const newPosts = cached.data.filter(p => !posts.value.some(existing => existing.id === p.id));
          posts.value = [...posts.value, ...newPosts];
        }

        currentPage.value = page
        loading.value = false

        // Use cached hasNextPage if available, otherwise fall back to length check (legacy/safe)
        if (cached.hasNextPage !== undefined) {
          hasNextPage.value = cached.hasNextPage;
        } else {
          hasNextPage.value = cached.data.length >= limit.value;
        }

        // Prefetch siguiente página en background
        setTimeout(prefetchNextPage, 100)
        return
      }

      performanceMetrics.value.cacheMisses++

      const url = buildSearchUrl(page)

      let countPromise = Promise.resolve(null)
      if (page === 1 || isNewSearch) {
        countPromise = fetchCounts()
      }

      const postsPromise = fetchWithRetry(url, {
        signal: abortController.signal
      })

      const [countResult, response] = await Promise.all([countPromise, postsPromise])

      if (countResult !== null) {
        totalPosts.value = countResult
      } else if (page === 1 || isNewSearch) {
        totalPosts.value = -1
      }

      if (!response.ok) {
        const errorText = await response.text()

        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error === 'PostQuery::TagLimitError') {
            throw new Error("errors.tag_limit")
          }
        } catch (e) {
          if (!e.message.includes("errors.")) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`)
          } else {
            throw e
          }
        }
      }

      const data = await response.json()
      const normalizedData = data.map(normalizePost).filter(post =>
        getBestImageUrl(post) !== null
      )

      const finalPosts = normalizedData.slice(0, limit.value)

      // Calcular hasNextPage
      if (totalPosts.value !== -1) {
        hasNextPage.value = (page * limit.value) < totalPosts.value
      } else {
        hasNextPage.value = data.length >= limit.value
      }

      // Guardar en caché (include hasNextPage)
      if (finalPosts.length > 0) {
        cache.set(cacheKey, {
          timestamp: Date.now(),
          data: finalPosts,
          hasNextPage: hasNextPage.value
        })
      }

      if (page === 1 || isNewSearch || !append) {
        posts.value = finalPosts
      } else {
        posts.value = [...posts.value, ...finalPosts]
      }

      currentPage.value = page

      // Prefetch siguiente página en background
      setTimeout(prefetchNextPage, 500)

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request cancelled')
        return
      }

      console.error('Error fetching posts:', err)
      const msg = err.message || ''

      if (msg.startsWith("errors.")) {
        error.value = msg
      } else {
        if (msg.includes("Failed to fetch")) error.value = "errors.network"
        else if (msg.includes("HTTP")) error.value = msg
        else error.value = msg
      }
      posts.value = []
    } finally {
      loading.value = false

      const endTime = performance.now()
      performanceMetrics.value.loadTimes.push(endTime - startTime)
      if (performanceMetrics.value.loadTimes.length > 100) {
        performanceMetrics.value.loadTimes.shift()
      }
    }
  }

  // Limpiar caché cuando cambian parámetros importantes
  // Only watch if values are defined (defensive check for ImageDetailModal usage)
  const watchSources = [searchQuery, ratingFilter, limit].filter(source => source !== undefined);
  if (watchSources.length > 0) {
    watch(watchSources, () => {
      cache.clear()
    })
  }

  return {
    posts,
    loading,
    error,
    currentPage,
    hasNextPage,
    searchPosts,
    performanceMetrics,
    clearCache: () => cache.clear()
  }
}