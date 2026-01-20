
import { ref } from 'vue';
import DanbooruService from '../services/danbooru';

export function useRatingCounts() {
  const ratingCounts = ref({}); // Keep local ref structure if components depend on it heavily? 
  // Actually, components likely use it as reactive object.
  // But Vue Query gives us `data`.
  // Let's implement fetchRatingCounts to return or populate data.

  // Since fetching counts is often triggered by the Search Page for multiple counts (G, S, Q, E) or just general search count.
  // The previous implementation had `fetchRatingCounts(query)` which populated `ratingCounts` ref.

  // We can use `useQuery` but since the query changes dynamicallly based on search, 
  // and we might want to fetch multiple things?
  // Actually, the previous implementation just did:
  // ratingCounts.value = { general: ..., sensitive: ..., etc }

  // It's probably better to keep `fetchRatingCounts` as an async function that uses the Service directly
  // rather than full Vue Query if it's just a one-off fetch on search.
  // HOWEVER, we want caching. Vue Query `queryClient.fetchQuery` is perfect for this.

  const fetchRatingCounts = async (currentTags) => {
    // Logic from original:
    // 1. Fetch total
    // 2. Fetch specific ratings

    // Since this is complex dynamic logic, wrapping it in a function is best.
    // We can genericize it.

    const counts = {
      all: 0,
      general: 0,
      sensitive: 0,
      questionable: 0,
      explicit: 0
    };

    // Use short codes for API reliability
    const ratingMap = {
      'g': 'general',
      's': 'sensitive',
      'q': 'questionable',
      'e': 'explicit'
    };
    const ratings = Object.keys(ratingMap);

    // Helper to fetch one count using service
    const getCount = async (tags) => {
      try {
        return await DanbooruService.getPostCount(tags);
      } catch (e) {
        console.error('Error fetching count for tags:', tags, e);
        return 0;
      }
    };

    // Base tags
    const baseTags = currentTags ? currentTags.trim() : '';

    // Parallel fetch
    const promises = [
      getCount(baseTags), // Total (All)
      ...ratings.map(r => getCount(`${baseTags} rating:${r}`))
    ];

    const results = await Promise.all(promises);

    counts.all = results[0];
    ratings.forEach((r, i) => {
      // PostGallery expects short keys (g, s, q, e)
      counts[r] = results[i + 1];
    });

    ratingCounts.value = counts;
    return counts;
  };

  return {
    ratingCounts,
    fetchRatingCounts
    // Note: We aren't using useQuery hook here because this logic is imperative (called by HomeView watcher).
    // If we wanted reactive auto-fetch, we'd accept `tags` ref as argument.
    // But HomeView calls it manually. So we stick to function but use Service.
    // Ideally we should move to `useQuery` in HomeView, but that's a bigger refactor.
  };
}