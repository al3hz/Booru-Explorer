import { ref } from 'vue';

export function useRatingCounts() {
  const ratingCounts = ref({
    g: 0,
    s: 0,
    q: 0,
    e: 0
  });
  const loadingCounts = ref(false);

  const fetchRatingCounts = async (baseTags) => {
    loadingCounts.value = true;
    
    // Clean tags: remove existing rating, order, and status tags to get raw content scope
    let tags = baseTags || "";
    // Remove rating:x
    tags = tags.replace(/rating:[a-z]+/gi, '');
    // Remove order:x (sorting doesn't affect count, but safer to remove)
    tags = tags.replace(/order:[a-z_]+/gi, '');
    // Keep status tags? usually we want active posts, so default to -status:deleted if not specified
    if (!tags.includes('status:')) {
       tags = tags + ' -status:deleted';
    }
    
    tags = tags.trim().replace(/\s+/g, ' ');

    const ratings = ['g', 's', 'q', 'e'];
    const requests = ratings.map(r => {
      const query = tags ? `${tags} rating:${r}` : `rating:${r}`;
      const params = new URLSearchParams({ tags: query });
      return fetch(`https://danbooru.donmai.us/counts/posts.json?${params.toString()}`)
        .then(res => res.json())
        .then(data => data.counts && data.counts.posts ? data.counts.posts : 0)
        .catch(() => 0);
    });

    try {
      const results = await Promise.all(requests);
      ratingCounts.value = {
        g: results[0],
        s: results[1],
        q: results[2],
        e: results[3]
      };
    } catch (e) {
      console.error("Error fetching rating counts", e);
      // Reset on error
      ratingCounts.value = { g: 0, s: 0, q: 0, e: 0 };
    } finally {
      loadingCounts.value = false;
    }
  };

  return {
    ratingCounts,
    loadingCounts,
    fetchRatingCounts
  };
}
