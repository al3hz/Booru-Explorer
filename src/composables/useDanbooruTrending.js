import { ref } from 'vue';

export function useDanbooruTrending() {
  const trendingTags = ref([]);
  const loadingTrending = ref(false);
  const errorTrending = ref(null);

  // Blacklist of generic/meta tags to exclude
  const STOP_WORDS = new Set([
    'highres', 'absurdres', 'comic', 'translated', 'commentary_request',
    'check_commentary', 'speech_bubble', 'looking_at_viewer', 'simple_background',
    'white_background', 'monochrome', 'greyscale', '1girl', 'solo', '1boy',
    'open_mouth', 'closed_mouth', 'smile', 'blush', 'short_hair', 'long_hair',
    'breasts', 'large_breasts', 'looking_back', 'standing', 'sitting',
    'shirt', 'skirt', 'dress', 'hair_ornament', 'blue_eyes', 'red_eyes',
    'brown_hair', 'black_hair', 'blonde_hair', 'gloves', 'navel', 'thighhighs',
    'animal_ears', 'tail', 'school_uniform', 'cleavage', 'bare_shoulders'
  ]);

  const fetchTrendingTags = async () => {
    loadingTrending.value = true;
    errorTrending.value = null;

    try {
      // Fetch last 100 posts to analyze recent activity
      const response = await fetch('https://danbooru.donmai.us/posts.json?limit=100');
      if (!response.ok) throw new Error('Failed to fetch trending info');
      
      const posts = await response.json();
      
      const tagCounts = {};

      posts.forEach(post => {
        if (!post.tag_string) return;
        
        const tags = post.tag_string.split(' ');
        tags.forEach(tag => {
          if (!tag) return;
          if (STOP_WORDS.has(tag)) return;
          
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      // Sort by frequency
      const sortedTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15) // Top 15
        .map(([name, count]) => ({ name, count }));

      trendingTags.value = sortedTags;
      
    } catch (err) {
      console.error('Error fetching trending tags:', err);
      errorTrending.value = err.message;
      trendingTags.value = []; // Fallback empty
    } finally {
      loadingTrending.value = false;
    }
  };

  return {
    trendingTags,
    loadingTrending,
    errorTrending,
    fetchTrendingTags
  };
}
