
import { computed } from 'vue';
import { useInfiniteQuery } from '@tanstack/vue-query';
import DanbooruService from '../services/danbooru';

export function useDanbooruApi(initialTags, limit, ratingFilter, infiniteScroll, currentPageRef) {
  // Use a unique query key that includes all dependencies
  const queryKey = computed(() => {
    let tags = initialTags.value || '';
    const ratingMap = {
      'general': 'g',
      'safe': 's',
      'questionable': 'q',
      'explicit': 'e'
    };

    if (ratingFilter.value) {
      const shortRating = ratingMap[ratingFilter.value] || ratingFilter.value;
      // Filter if it's a known rating or just a value (e.g. if we add more later)
      // Always apply if selected, even for general (rating:g)
      if (!tags.includes(`rating:${shortRating}`)) {
        tags = `${tags} rating:${shortRating}`;
      }
    }

    // For traditional pagination, include page in key to isolate cache per page
    // For infinite scroll, don't include page (accumulate all pages)
    const baseKey = ['posts', { tags: tags.trim(), limit: limit.value }];
    if (!infiniteScroll || !infiniteScroll.value) {
      const page = currentPageRef ? currentPageRef.value : 1;
      baseKey.push({ page });
    }
    return baseKey;
  });

  const {
    data,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1, queryKey }) => {
      const [, params] = queryKey;

      // For traditional pagination, use the page from query key
      // For infinite scroll, use pageParam
      let pageToFetch = pageParam;
      if (!infiniteScroll || !infiniteScroll.value) {
        // Traditional pagination: get page from currentPageRef
        pageToFetch = currentPageRef ? currentPageRef.value : 1;
      }

      return DanbooruService.getPosts(params.tags, params.limit, pageToFetch);
    },
    getNextPageParam: (lastPage, allPages) => {
      // If last page is empty, we are done
      if (!lastPage || lastPage.length === 0) return undefined;

      // Smart Search check: If we have > 2 tags, we might have filtered results.
      // In this case, even a small page doesn't mean we're done (we might find more on next API page).
      // We check the tags used in the query key.
      const [, params] = queryKey.value;
      const tagList = params.tags.split(' ').filter(t => t.trim() !== '' && !t.startsWith('rating:') && !t.startsWith('order:') && !t.startsWith('-'));

      if (tagList.length > 2) {
        // In Smart Search, always try next page if we got ANY results
        return allPages.length + 1;
      }

      // Standard behavior: if last page < limit, we assume end of results
      if (lastPage.length < limit.value) return undefined;

      return allPages.length + 1;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Flatten pages into a single list of posts
  const posts = computed(() => {
    if (!data.value?.pages || data.value.pages.length === 0) return [];

    // In infinite scroll mode: show all accumulated pages
    // In traditional pagination mode: show only the last fetched page
    if (infiniteScroll && infiniteScroll.value) {
      return data.value.pages.flatMap(page => page);
    } else {
      // Traditional pagination: return only the last page
      const lastPage = data.value.pages[data.value.pages.length - 1];
      return lastPage || [];
    }
  });

  // Wrapper for manual search (mainly for component compatibility)
  const searchPosts = async (page = 1, isNewSearch = false) => {
    if (isNewSearch) {
      // Reset and fetch up to the requested page
      await refetch();

      // If page > 1, we need to fetch additional pages
      const currentPages = data.value?.pages.length || 0;
      for (let i = currentPages; i < page; i++) {
        await fetchNextPage();
      }
    } else {
      // Just load the next page (infinite scroll behavior)
      await fetchNextPage();
    }
  };

  return {
    posts,
    loading: computed(() => isFetching.value && !isFetchingNextPage.value),
    loadingNext: isFetchingNextPage,
    error: computed(() => isError.value ? error.value?.message : null),
    currentPage: computed(() => {
      if (!infiniteScroll || !infiniteScroll.value) {
        return currentPageRef ? currentPageRef.value : 1;
      }
      return data.value?.pages.length || 1;
    }),
    hasNextPage,
    searchPosts
  };
}

// Standalone exports for compatibility with ImageDetailModal
// These are stateless wrappers around the Service

export const getPost = async (id) => {
  try {
    return await DanbooruService.getPost(id);
  } catch (e) {
    console.error("getPost error", e);
    return null;
  }
};

export const getPostComments = async (postId, page = 1, limit = 20) => {
  try {
    return await DanbooruService.getComments(postId, page, limit);
  } catch (e) {
    console.error("getComments error", e);
    return [];
  }
};

export const getArtist = async (id) => {
  try {
    // The original used artists/{id}.json, let's assume getArtistByName or similar logic isn't needed here if we have ID
    // But service currently has getArtistByName. Let's add getArtistById or just fetch directly if needed.
    // Wait, service methods: getArtistByName(name), getArtistUrls(artistId).
    // We need getArtist(id). Let's add it to service or direct fetch here?
    // Let's rely on proxy direct fetch for now to match exactly or update service.
    // Updating service is better but I can't edit it easily without another tool call.
    // I will use internal helper logic or assume DanbooruService has it? 
    // I didn't add getArtist(id) to service, only getArtistByName.
    // I'll add a quick fetch here or accept normalized name.
    // Actually, let's use the proxy via service private method if possible or standard fetch.
    // Ideally I should update DanbooruService to have getArtistById.

    // Temporary: direct fetch via proxy url construction manually 
    // or just use DanbooruService._fetch if I exported it? No, it's internal.
    // I'll update the service in next step or just use fetch here.
    const res = await fetch(`/api/danbooru?url=artists/${id}.json`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return null;
  }
};

export const getNotes = async (postId) => {
  try {
    const res = await fetch(`/api/danbooru?url=notes.json&search[post_id]=${postId}&search[is_active]=true`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return [];
  }
};