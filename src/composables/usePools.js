import { ref } from 'vue';

export function usePools() {
  const pools = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const currentPage = ref(1);
  const hasNextPage = ref(true);
  


  const fetchPools = async (page = 1, filters = {}) => {
    loading.value = true;
    error.value = null;

    try {
      let url = `https://danbooru.donmai.us/pools.json?page=${page}&limit=42`;
      
      // Add search params
      if (filters.name) {
        url += `&search[name_matches]=*${encodeURIComponent(filters.name)}*`;
      }
      
      if (filters.description) {
        url += `&search[description_matches]=*${encodeURIComponent(filters.description)}*`;
      }
      
      if (filters.category) {
        url += `&search[category]=${filters.category}`;
      }

      // Order parameter
      const orderMap = {
        'updated_at': 'updated_at',
        'name': 'name',
        'created_at': 'created_at',
        'post_count': 'post_count'
      };
      const order = orderMap[filters.order] || 'updated_at';
      url += `&search[order]=${order}`;

      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch pools: ${res.status}`);
      }
      
      const poolsData = await res.json();
      
      // Fetch cover images in batches of 5 to balance speed and rate limiting
      const fetchCover = async (pool) => {
        if (pool.post_ids && pool.post_ids.length > 0) {
          try {
            const firstPostId = pool.post_ids[0];
            const postRes = await fetch(`https://danbooru.donmai.us/posts/${firstPostId}.json`);
            
            if (postRes.ok) {
              const post = await postRes.json();
              pool.coverUrl = post.large_file_url || post.file_url || post.preview_file_url;
            } else {
              pool.coverUrl = null;
            }
          } catch {
            pool.coverUrl = null;
          }
        } else {
          pool.coverUrl = null;
        }
        return pool;
      };

      // Process in batches of 5
      const batchSize = 5;
      const poolsWithCovers = [];
      
      for (let i = 0; i < poolsData.length; i += batchSize) {
        const batch = poolsData.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fetchCover));
        poolsWithCovers.push(...batchResults);
        
        // Small delay between batches (only if not the last batch)
        if (i + batchSize < poolsData.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      pools.value = poolsWithCovers;
      currentPage.value = page;
      
      // Check if there are more pages (if we got full batch of 42 items, likely more exist)
      hasNextPage.value = poolsData.length === 42;
      
    } catch (e) {
      console.error('Error fetching pools:', e);
      error.value = e.message;
      pools.value = [];
    } finally {
      loading.value = false;
    }
  };

  return {
    pools,
    loading,
    error,
    currentPage,
    hasNextPage,
    fetchPools
  };
}

export function usePoolDetail() {
  const pool = ref(null);
  const poolPosts = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const loadingProgress = ref({ current: 0, total: 0 });

  const fetchPoolDetail = async (poolId) => {
    loading.value = true;
    error.value = null;

    try {
      // Fetch pool metadata
      const poolRes = await fetch(`https://danbooru.donmai.us/pools/${poolId}.json`);
      
      if (!poolRes.ok) {
        throw new Error('Pool not found');
      }
      
      const poolData = await poolRes.json();
      pool.value = poolData;

      // Fetch pool posts
      if (poolData.post_ids && poolData.post_ids.length > 0) {
        const totalPosts = poolData.post_ids.length;
        const limit = 100;
        const totalPages = Math.ceil(totalPosts / limit);
        
        // Initialize progress
        loadingProgress.value = { current: 0, total: totalPosts };
        
        // Fetch pages sequentially with delay to avoid rate limiting
        const allPosts = [];
        
        for (let page = 1; page <= totalPages; page++) {
          try {
            const url = `https://danbooru.donmai.us/posts.json?tags=pool:${poolId}&limit=${limit}&page=${page}`;
            const res = await fetch(url);
            
            if (res.ok) {
              const pageData = await res.json();
              allPosts.push(...pageData);
              
              // Update progress
              loadingProgress.value = { 
                current: allPosts.length, 
                total: totalPosts 
              };
            } else if (res.status === 429) {
              // Rate limited - wait longer and retry
              console.warn(`Rate limited on page ${page}, waiting 2s...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              // Retry this page
              page--;
              continue;
            }
            
            // Small delay between requests to avoid rate limiting (250ms)
            if (page < totalPages) {
              await new Promise(resolve => setTimeout(resolve, 250));
            }
          } catch (e) {
            console.error(`Error fetching page ${page}:`, e);
          }
        }
        
        // Sort posts according to pool order
        const sortedPosts = poolData.post_ids
          .map(id => allPosts.find(p => p.id === id))
          .filter(p => p !== undefined);
        
        poolPosts.value = sortedPosts;
      } else {
        poolPosts.value = [];
      }
      
    } catch (e) {
      console.error('Error fetching pool detail:', e);
      error.value = e.message;
      pool.value = null;
      poolPosts.value = [];
    } finally {
      loading.value = false;
    }
  };

  return {
    pool,
    poolPosts,
    loading,
    loadingProgress,
    error,
    fetchPoolDetail
  };
}
