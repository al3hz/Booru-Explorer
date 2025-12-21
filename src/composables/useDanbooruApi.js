import { ref, computed } from 'vue'

export function useDanbooruApi(searchQuery, limit, ratingFilter) {
  const posts = ref([])
  const loading = ref(false)
  const error = ref('')
  const currentPage = ref(1)
  const hasNextPage = ref(false)
  
  const totalPosts = ref(0)
  
  const apiBaseUrl = 'https://danbooru.donmai.us'
  
  const buildSearchUrl = (page = 1) => {
    let tags = searchQuery.value.trim()
    
    // Convertir comas a espacios para la API
    tags = tags.replace(/[,，]+/g, ' ')
    tags = tags.replace(/\s+/g, ' ')
    
    // Proactive Filtering: Exclude deleted posts unless specifically requested
    // Optimization: Skip filtering for heavy sorts (order:score, order:favcount) to prevent 500 timeouts
    const isHeavySort = tags.includes('order:score') || tags.includes('order:favcount');
    
    // Safety Measure: If it's a heavy sort or global deleted search and no specific tags are present, add a time constraint
    const hasSpecificTags = tags.split(' ').some(t => {
      const low = t.toLowerCase().trim();
      return low && !low.startsWith('order:') && !low.startsWith('rating:') && !low.startsWith('status:') && !low.startsWith('age:') && !low.startsWith('-');
    });

    const isDeletedSearch = tags.includes('status:deleted');
    if ((isHeavySort || isDeletedSearch) && !hasSpecificTags && !tags.includes('age:')) {
        // Tightening to 1 month for global heavy/deleted searches to ensure stability
        tags = tags ? `${tags} age:<1month` : 'age:<1month';
    }

    if (!isHeavySort && !isDeletedSearch && !tags.includes('status:deleted') && !tags.includes('status:any')) {
        tags = tags ? `${tags} -status:deleted` : '-status:deleted'
    }

    // Usar siempre el ratingFilter
    if (ratingFilter.value) {
      // Remove any existing rating in the query string to prioritize the selected filter
      tags = tags.replace(/\s*rating:[sqge]/gi, '').trim();
      tags = tags ? `${tags} rating:${ratingFilter.value.toLowerCase()}` : `rating:${ratingFilter.value.toLowerCase()}`;
    }
    
    // Buffer strategy removed for accurate pagination alignment.
    // We request exactly the limit. If some posts are filtered out (invalid),
    // the page will show fewer items coverage, but navigation will remain consistent.
    
    const params = new URLSearchParams({
      tags: tags,
      limit: limit.value.toString(),
      page: page.toString()
    })
    
    return `${apiBaseUrl}/posts.json?${params.toString()}`
  }

  const fetchCounts = async () => {
    let rawTags = searchQuery.value.trim().replace(/[,，]+/g, ' ').replace(/\s+/g, ' ');
    
    // Broad Query Check: Skip counting if search is too broad (efficiency)
    // A search is broad if it has no specific tags, just a rating, or just a sort.
    const hasSpecificTags = rawTags.split(' ').some(t => {
      return t && !t.startsWith('order:') && !t.startsWith('rating:') && !t.startsWith('status:') && !t.startsWith('-');
    });

    if (!hasSpecificTags) {
        // Optimization: For very broad searches, don't waste time counting millions of posts
        // This includes global searches, just sorts, or just rating filters.
        // It prevents the "Database Timeout" when doing global order:score searches.
        return null;
    }

    try {
      let tags = rawTags;
      if (ratingFilter.value) {
        tags = tags.replace(/\s*rating:\w+/g, '')
        tags = tags.trim()
        tags = tags ? `${tags} rating:${ratingFilter.value}` : `rating:${ratingFilter.value}`
      }
      // Proactive Filtering for counts
      // Optimization 1: Remove sorting tags for counts as they are irrelevant and can cause timeouts
      tags = tags.replace(/\s*order:\w+/g, '').trim();

      // Optimization 2: Add safety age filter for broad searches if needed
      // Tightening to 1 month for consistency and stability
      const isHeavyQuery = tags.includes('favcount') || tags.includes('score');
      if (isHeavyQuery && !hasSpecificTags && !tags.includes('age:')) {
         tags = tags ? `${tags} age:<1month` : 'age:<1month';
      }

      if (!tags.includes('status:deleted') && !tags.includes('status:any')) {
        tags = tags ? `${tags} -status:deleted` : '-status:deleted'
      }

      // Final check: if after removing order we are basically doing a global count, skip it.
      const cleanedTags = tags.replace(/\s*order:\w+/g, '').replace(/\s*rating:\w+/g, '').replace(/\s*-status:deleted/g, '').trim();
      if (!cleanedTags && !tags.includes('age:')) {
          return null;
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
  
  const searchPosts = async (page = 1, isNewSearch = false) => {
    // Validation removed to allow "Recent Posts" (empty search)
    // if (!searchQuery.value.trim() && !ratingFilter.value) { ... }
    
    loading.value = true
    error.value = ''
    
    try {
      const url = buildSearchUrl(page)
      
      // Parallel Execution: Don't let the count block the main results
      let countPromise = Promise.resolve(null);
      if (page === 1 || isNewSearch) {
        countPromise = fetchCounts();
      }

      const postsPromise = fetch(url);

      // We await both, but they are running in parallel now
      const [countResult, response] = await Promise.all([countPromise, postsPromise]);

      if (countResult !== null) {
        totalPosts.value = countResult;
      } else if (page === 1 || isNewSearch) {
        totalPosts.value = -1; // Unknown
      }
      
  
      
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
      
      // Strict Pagination Logic
      if (totalPosts.value !== -1) {
         // If we know the total, use strict math
         hasNextPage.value = (page * limit.value) < totalPosts.value;
      } else {
         // Fallback: Check if we likely have a next page based on if we got enough raw data
         hasNextPage.value = data.length >= limit.value;
      }

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
    searchPosts,
  }
}