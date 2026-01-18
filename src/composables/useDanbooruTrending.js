import { ref } from 'vue';

// Global cache to persist across component mounts
const cache = {
  data: null,
  timestamp: 0,
  duration: 5 * 60 * 1000 // 5 minutes
};

// Expanded Blocklist
const STOP_WORDS = new Set([
  'highres', 'absurdres', 'comic', 'translated', 'commentary_request',
  'check_commentary', 'speech_bubble', 'looking_at_viewer', 'simple_background',
  'white_background', 'monochrome', 'greyscale', '1girl', 'solo', '1boy',
  'open_mouth', 'closed_mouth', 'smile', 'blush', 'short_hair', 'long_hair',
  'breasts', 'large_breasts', 'looking_back', 'standing', 'sitting',
  'shirt', 'skirt', 'dress', 'hair_ornament', 'blue_eyes', 'red_eyes',
  'brown_hair', 'black_hair', 'blonde_hair', 'gloves', 'navel', 'thighhighs',
  'animal_ears', 'tail', 'school_uniform', 'cleavage', 'bare_shoulders',
  'underwear', 'panties', 'bra', 'bikini', 'swimsuit', 'video', 'animated',
  'sound', 'webm', 'gif', 'multiple_girls', 'multiple_boys', '2girls',
  'parody', 'original', 'virtual_youtuber'
]);

export function useDanbooruTrending() {
  const trendingTags = ref([]);
  const loadingTrending = ref(false);
  const errorTrending = ref(null);
  let abortController = null;

  const fetchTrendingTags = async (force = false) => {
    // Check cache first
    if (!force && cache.data && (Date.now() - cache.timestamp < cache.duration)) {
      trendingTags.value = cache.data;
      return;
    }

    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    loadingTrending.value = true;
    errorTrending.value = null;

    try {
      // Fetch last 100 posts to analyze recent activity
      // Using 'limit=100' gives us a good sample size for "now"
      const response = await fetch('/api/danbooru?url=posts.json&limit=100', {
        signal: abortController.signal
      });

      if (!response.ok) throw new Error('Failed to fetch trending info');

      const posts = await response.json();

      const tagCounts = {};

      posts.forEach(post => {
        if (!post.tag_string) return;

        const tags = post.tag_string.split(' ');
        tags.forEach(tag => {
          if (!tag) return;
          if (STOP_WORDS.has(tag)) return;
          // Filter out rating/meta tags often found in tag string but not interesting for trending
          if (tag.includes(':')) return;

          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      // Sort by frequency
      const sortedTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15) // Top 15
        .map(([name, count]) => ({ name, count }));

      trendingTags.value = sortedTags;

      // Update cache
      cache.data = sortedTags;
      cache.timestamp = Date.now();

    } catch (err) {
      if (err.name === 'AbortError') {
        // Ignore abort errors
        return;
      }
      console.error('Error fetching trending tags:', err);
      errorTrending.value = err.message;
      // Keep old data if available on error? Optional. For now fallback empty.
      trendingTags.value = [];
    } finally {
      loadingTrending.value = false;
      abortController = null;
    }
  };

  return {
    trendingTags,
    loadingTrending,
    errorTrending,
    fetchTrendingTags
  };
}
