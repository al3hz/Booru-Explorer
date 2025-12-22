import { ref } from 'vue';

// Global state (Singleton)
const ratingCounts = ref({
  g: { count: null, isApproximate: false },
  s: { count: null, isApproximate: false },
  q: { count: null, isApproximate: false },
  e: { count: null, isApproximate: false }
});
const loadingCounts = ref(false);
const isLimited = ref(false);
const tagCount = ref(null); // Reliable total from Tags API
let currentRequestId = 0;

export function useRatingCounts() {
  const fetchRatingCounts = async (baseTags) => {
    const requestId = ++currentRequestId;
    loadingCounts.value = true;
    isLimited.value = false;
    tagCount.value = null;
    
    // Reset counts immediately to avoid showing stale data from previous search
    const zero = { count: null, isApproximate: false };
    ratingCounts.value = { g: zero, s: zero, q: zero, e: zero };

    // Clean tags
    let tags = baseTags || "";
    tags = tags.replace(/rating:[a-z]+/gi, '');
    tags = tags.replace(/order:[a-z_]+/gi, '');
    if (!tags.includes('status:')) {
       tags = tags + ' -status:deleted';
    }
    tags = tags.trim().replace(/\s+/g, ' ');

    // 1. Fetch Tag Metadata for total count
    const words = tags.replace('-status:deleted', '').trim().split(/\s+/).filter(w => w);
    
    // For single tags, use Tags API for accurate count
    if (words.length === 1 && words[0] && !words[0].includes(':')) {
       try {
         const res = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${words[0]}`);
         const data = await res.json();
         if (data && data.length > 0) {
           tagCount.value = data[0].post_count;
         }
       } catch (e) {}
    } else {
       // For multi-tag searches or homepage, use counts API
       try {
         const totalQuery = tags || '-status:deleted';
         const params = new URLSearchParams({ tags: totalQuery });
         const res = await fetch(`https://danbooru.donmai.us/counts/posts.json?${params.toString()}`);
         const data = await res.json();
         if (data && data.counts && typeof data.counts.posts === 'number') {
           tagCount.value = data.counts.posts;
         }
       } catch (e) {}
    }

    const ratings = ['g', 's', 'q', 'e'];
    const requests = ratings.map(async r => {
      // Intento 1: Búsqueda precisa (CON -status:deleted)
// ... same logic ...
      const queryPrecise = tags ? `${tags} rating:${r}` : `rating:${r}`;
      const paramsPrecise = new URLSearchParams({ tags: queryPrecise });
      
      try {
        const res = await fetch(`https://danbooru.donmai.us/counts/posts.json?${paramsPrecise.toString()}`);
        const data = await res.json();
        
        if (data && data.counts && typeof data.counts.posts === 'number') {
          return { count: data.counts.posts, isApproximate: false };
        }
      } catch (e) {}

      // Intento 2 (Fallback): Búsqueda aproximada (SIN -status:deleted)
      const cleanTags = tags.replace('-status:deleted', '').trim();
      const queryFallback = cleanTags ? `${cleanTags} rating:${r}` : `rating:${r}`;
      const paramsFallback = new URLSearchParams({ tags: queryFallback });
      
      try {
        const res = await fetch(`https://danbooru.donmai.us/counts/posts.json?${paramsFallback.toString()}`);
        const data = await res.json();
         
        if (data && data.counts && typeof data.counts.posts === 'number') {
          return { count: data.counts.posts, isApproximate: true };
        }
      } catch (e) {
        return null;
      }
      return null;
    });

    try {
      const results = await Promise.all(requests);
      
      // Safety check: Only update if this is still the most recent request
      if (requestId !== currentRequestId) return;

      // Si todos son null, marcar como limitado
      if (results.every(r => r === null)) {
        isLimited.value = true;
      }

      const safeParams = (res) => res ? res : { count: null, isApproximate: false };
      
      ratingCounts.value = {
        g: safeParams(results[0]),
        s: safeParams(results[1]),
        q: safeParams(results[2]),
        e: safeParams(results[3])
      };

      // Si tenemos el total real y los ratings fallaron, esto confirma el límite
      if (tagCount.value > 0 && results.some(r => r === null)) {
         // console.log("Confirmation: Tag has posts but API limited the breakdown.");
      }

    } catch (e) {
      if (requestId !== currentRequestId) return;
      console.error("Error fetching rating counts", e);
      isLimited.value = true;
      const zeroObj = { count: null, isApproximate: false };
      ratingCounts.value = { g: zeroObj, s: zeroObj, q: zeroObj, e: zeroObj };
    } finally {
      if (requestId === currentRequestId) {
        loadingCounts.value = false;
      }
    }
  };

  return {
    ratingCounts,
    loadingCounts,
    isLimited,
    tagCount,
    fetchRatingCounts
  };
}
