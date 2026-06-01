import DanbooruService from '../services/danbooru';

export function useWikiSearch() {
  const fetchRecentWikiPages = async (limit = 20) => {
    try {
      const data = await DanbooruService.getWikiPages('', limit, 1, 'updated_at');
      return data || [];
    } catch (e) {
      console.error("Failed to fetch recent wikis:", e);
      return [];
    }
  };

  const fetchWikiAutocomplete = async (query) => {
    if (!query || query.length < 2) return [];
    try {
      const data = await DanbooruService.getAutocomplete(query, 'wiki_page', 10);
      return data || [];
    } catch (e) {
      console.error("Failed to fetch wiki autocomplete:", e);
      return [];
    }
  };

  return {
    fetchRecentWikiPages,
    fetchWikiAutocomplete
  };
}
