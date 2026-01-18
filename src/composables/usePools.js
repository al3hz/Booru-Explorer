
import { ref, computed } from 'vue';
import { useQuery, useInfiniteQuery } from '@tanstack/vue-query';
import DanbooruService from '../services/danbooru';

// --- Pool List Logic ---
export function usePools() {
  const currentPage = ref(1);
  const currentFilters = ref({});

  const queryKey = computed(() => {
    return ['pools', { page: currentPage.value, ...currentFilters.value }];
  });

  const {
    data: poolsData,
    isFetching,
    isError,
    error
  } = useQuery({
    queryKey,
    queryFn: async ({ queryKey }) => {
      const [_key, params] = queryKey;
      const { page, ...filters } = params;

      // Fetch pools
      const pools = await DanbooruService.getPools(filters.name || '', page, 20);

      if (!pools || pools.length === 0) return [];

      // Collect post IDs for covers (prefer first post in pool)
      const coverPostIds = pools
        .map(pool => pool.post_ids && pool.post_ids.length > 0 ? pool.post_ids[0] : null)
        .filter(id => id !== null);

      if (coverPostIds.length === 0) return pools;

      try {
        // Batch fetch all cover posts
        // Danbooru allows fetching by comma-separated IDs
        // "id:1,2,3"
        const posts = await DanbooruService.getPosts(`id:${coverPostIds.join(',')}`, 100);

        // Map posts back to pools
        const postsMap = new Map(posts.map(p => [p.id, p]));

        return pools.map(pool => {
          if (pool.post_ids && pool.post_ids.length > 0) {
            const coverId = pool.post_ids[0];
            const post = postsMap.get(coverId);
            if (post) {
              return {
                ...pool,
                coverUrl: post.large_file_url || post.file_url || post.preview_url || post.sample_url
              };
            }
          }
          return pool;
        });
      } catch (err) {
        console.error("Failed to enrich pools with covers:", err);
        return pools;
      }
    },
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000
  });

  const fetchPools = (page, filters) => {
    currentPage.value = page;
    currentFilters.value = filters || {};
  };

  const pools = computed(() => {
    // Enrich with covers logic from before?
    // The previous `queryFn` did manual cover fetching.
    // I should probably keep that logic but inside the queryFn ABOVE.
    return poolsData.value || [];
  });

  // Re-add cover enrichment if needed? 
  // It was in the previous file content. I should check line 18-47 of original.
  // I'll leave it as a TODO or implicitly assume DanbooruService might handle it (it doesn't).
  // I will move the enrichment logic to a watcher or subsequent effect, OR put it back in `queryFn`.
  // Putting it in `queryFn` is best.

  return {
    pools,
    loading: isFetching,
    error: computed(() => isError.value ? error.value?.message : null),
    currentPage,
    hasNextPage: computed(() => pools.value.length === 20), // Simple check
    fetchPools
  };
}

// --- Pool Detail Logic ---
export function usePoolDetail() {
  const poolId = ref(null);
  const enabled = computed(() => !!poolId.value);

  const {
    data: pool,
    isFetching: poolLoading,
    error: poolError
  } = useQuery({
    queryKey: ['pool', poolId],
    queryFn: () => DanbooruService.getPool(poolId.value),
    enabled,
    staleTime: 5 * 60 * 1000
  });

  const {
    data: postsData,
    isFetching: postsLoading,
    isFetchingNextPage: postsLoadingNext,
    fetchNextPage,
    hasNextPage
  } = useInfiniteQuery({
    queryKey: ['pool_posts', poolId],
    queryFn: async ({ pageParam = 1, queryKey }) => {
      const [_key, pid] = queryKey;
      // Use status:any to ensure we don't skip posts that might be deleted but are part of the pool
      return DanbooruService.getPosts(`pool:${pid} status:any`, 100, pageParam);
    },
    enabled,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < 100) return undefined;
      return allPages.length + 1;
    },
    staleTime: 5 * 60 * 1000
  });

  // Auto-fetch all pages
  import('vue').then(({ watch }) => {
    watch([hasNextPage, postsLoadingNext, poolId], ([hasMore, isFetching, pid]) => {
      if (pid && hasMore && !isFetching) {
        // Small delay to prevent potential call stack issues or race conditions
        setTimeout(() => {
          if (hasNextPage.value && !postsLoadingNext.value) {
            fetchNextPage();
          }
        }, 100);
      }
    }, { immediate: true });
  });

  const poolPosts = computed(() => {
    return postsData.value?.pages?.flatMap(page => page) || [];
  });

  const fetchPoolDetail = (id) => {
    poolId.value = id;
  };

  const loadingProgress = computed(() => {
    return { current: poolPosts.value.length, total: pool.value?.post_count || 0 };
  });

  return {
    pool,
    poolPosts,
    loading: computed(() => poolLoading.value || postsLoading.value || hasNextPage.value || postsLoadingNext.value),
    loadingProgress,
    error: computed(() => poolError.value?.message || null),
    fetchPoolDetail,
    loadMorePosts: fetchNextPage
  };
}
