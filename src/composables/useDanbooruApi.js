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
    
    // Buffer strategy: Fetch 50% more posts to handle filtered items
    // This ensures we can fill the requested limit even if some posts are invalid
    const bufferLimit = Math.ceil(limit.value * 1.5);

    const params = new URLSearchParams({
      tags: tags,
      limit: bufferLimit.toString(),
      page: page.toString()
    })
    
    return `${apiBaseUrl}/posts.json?${params.toString()}`
  }
  
  const searchPosts = async (page = 1, isNewSearch = false) => {
    // Validation removed to allow "Recent Posts" (empty search)
    // if (!searchQuery.value.trim() && !ratingFilter.value) { ... }
    
    loading.value = true
    error.value = ''
    
    try {
      const url = buildSearchUrl(page)
     
      
      const response = await fetch(url)
      
  
      
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
   
      
      
      // Normalize posts to ensure URLs exist (using media_asset variants if needed)
      const normalizePost = (post) => {
        if (!post.file_url || !post.preview_file_url) {
          if (post.media_asset && post.media_asset.variants) {
             const variants = post.media_asset.variants;
             
             const findUrl = (type) => {
                const v = variants.find(v => v.type === type);
                return v ? v.url : null;
             };
             
             if (!post.preview_file_url) {
                // Try 180x180 or 360x360 for preview
                post.preview_file_url = findUrl('180x180') || findUrl('360x360');
             }
             
             if (!post.large_file_url) {
                post.large_file_url = findUrl('sample') || findUrl('720x720');
             }
             
             if (!post.file_url) {
                post.file_url = findUrl('original');
             }
          }
        }
        return post;
      };

      const normalizedData = data.map(normalizePost).filter(post => {
        // Filter out posts that still don't have any image URL after normalization
        return post.file_url || post.preview_file_url || post.large_file_url;
      });

      // Slice to exactly the requested limit to maintain grid consistency
      // This fills the "holes" but effectively drops the overflow valid posts
      const finalPosts = normalizedData.slice(0, limit.value);

      if (page === 1 || isNewSearch) {
        posts.value = finalPosts
      } else {
        posts.value = [...posts.value, ...finalPosts]
      }
      
      // Check if we likely have a next page based on if we got enough raw data
      // (Using >= limit ensures we don't falsely say no next page if we sliced)
      hasNextPage.value = data.length >= limit.value;
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