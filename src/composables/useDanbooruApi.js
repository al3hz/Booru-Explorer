import { ref, computed } from 'vue'

export function useDanbooruApi(searchQuery, limit, ratingFilter) {
  const posts = ref([])
  const loading = ref(false)
  const error = ref('')
  const currentPage = ref(1)
  const hasNextPage = ref(false)
  
  const apiBaseUrl = 'https://danbooru.donmai.us'
  
  const buildSearchUrl = (page = 1) => {
    let tags = searchQuery.value.trim()
    
    // Convertir comas a espacios para la API
    tags = tags.replace(/[,，]+/g, ' ')
    tags = tags.replace(/\s+/g, ' ')
    
    // Usar siempre el ratingFilter
    if (ratingFilter.value) {
      tags = tags.replace(/\s*rating:\w+/g, '')
      tags = tags.trim()
      tags = tags ? `${tags} rating:${ratingFilter.value}` : `rating:${ratingFilter.value}`
    }
    
    
    const params = new URLSearchParams({
      tags: tags,
      limit: limit.value.toString(),
      page: page.toString()
    })
    
    return `${apiBaseUrl}/posts.json?${params.toString()}`
  }
  
  const searchPosts = async (page = 1, isNewSearch = false) => {
    if (!searchQuery.value.trim() && !ratingFilter.value) {
      error.value = 'Por favor ingresa tags para buscar'
      return
    }
    
    loading.value = true
    error.value = ''
    
    try {
      const url = buildSearchUrl(page)
      console.log('🔍 URL generada:', url)
      console.log('📋 URL para probar manualmente:', decodeURIComponent(url))
      
      const response = await fetch(url)
      
      console.log('📊 Estado de respuesta:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Error completo:', errorText)
        
        // Intentar parsear JSON de error propio de Danbooru
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error === 'PostQuery::TagLimitError') {
             throw new Error("errors.tag_limit");
          }
        } catch (e) {
          // Si falla el parseo o no es el error específico, seguimos con el error genérico
          if (e.message.includes("errors.")) throw e;
        }

        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('✅ Datos recibidos:', data.length, 'elementos')
      
      if (page === 1 || isNewSearch) {
        posts.value = data
      } else {
        posts.value = [...posts.value, ...data]
      }
      
      hasNextPage.value = data.length === limit.value
      currentPage.value = page
      
      if (data.length === 0) {
        // error.value = 'No se encontraron resultados para la búsqueda' 
        // Better to handle "No results" in UI via posts.length === 0 check, which we already do in Gallery.
        // But if we want an error state:
        // error.value = 'gallery.no_results_title'; 
        // Actually, let's keep error empty if just no results, as Gallery displays empty state nicely.
      }
      
    } catch (err) {
      console.error('Error fetching posts:', err)
      // Si es nuestro error custom, lo mostramos limpio
      const msg = err.message || '';
      if (msg.startsWith("errors.")) {
         error.value = msg;
      } else {
         error.value = `errors.generic`; // Or pass the raw message if network error
         // For now let's simplify to generic if unknown, or maybe check for network
         if (msg.includes("Failed to fetch")) error.value = "errors.network";
         else if (msg.includes("HTTP")) error.value = msg; // HTTP errors usually technical
         else error.value = msg;
      }
      posts.value = []
    } finally {
      loading.value = false
    }
  }
  
  return {
    posts,
    loading,
    error,
    currentPage,
    hasNextPage,
    searchPosts
  }
}