import { ref } from 'vue';

export function usePools() {
  const pools = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const currentPage = ref(1);
  const hasNextPage = ref(true);

  const fetchPools = async (page = 1, searchQuery = '', category = '') => {
    loading.value = true;
    error.value = null;

    try {
      let url = `https://danbooru.donmai.us/pools.json?page=${page}&limit=20`;
      
      // Add search params
      if (searchQuery) {
        url += `&search[name_matches]=*${encodeURIComponent(searchQuery)}*`;
      }
      
      if (category) {
        url += `&search[category]=${category}`;
      }

      // Order by updated
      url += '&search[order]=updated_at';

      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch pools: ${res.status}`);
      }
      
      const poolsData = await res.json();
      
      // Fetch cover images (first post) for each pool
      const poolsWithCovers = await Promise.all(
        poolsData.map(async (pool) => {
          if (pool.post_ids && pool.post_ids.length > 0) {
            try {
              // Fetch the first post to get its thumbnail
              const firstPostId = pool.post_ids[0];
              const postRes = await fetch(`https://danbooru.donmai.us/posts/${firstPostId}.json`);
              if (postRes.ok) {
                const post = await postRes.json();
                // Prioritize HD quality: large_file_url > file_url
                pool.coverUrl = post.large_file_url || post.file_url || post.preview_file_url;
              }
            } catch (e) {
              console.error(`Failed to fetch cover for pool ${pool.id}:`, e);
              pool.coverUrl = null;
            }
          } else {
            pool.coverUrl = null;
          }
          return pool;
        })
      );
      
      pools.value = poolsWithCovers;
      currentPage.value = page;
      
      // Check if there are more pages (if we got 20 items, likely more exist)
      hasNextPage.value = poolsData.length === 20;
      
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
        const postIds = poolData.post_ids.join(',');
        const postsRes = await fetch(`https://danbooru.donmai.us/posts.json?tags=pool:${poolId}&limit=100`);
        
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          
          // Sort posts according to pool order
          const sortedPosts = poolData.post_ids
            .map(id => postsData.find(p => p.id === id))
            .filter(p => p !== undefined);
          
          poolPosts.value = sortedPosts;
        }
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
    error,
    fetchPoolDetail
  };
}
