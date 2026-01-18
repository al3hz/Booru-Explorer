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
      const apiBaseUrl = '/api/danbooru';
      const params = new URLSearchParams({
        'search[query]': query,
        'search[type]': 'wiki_page',
        'version': '3',
        'limit': '10'
      });
      const res = await fetch(`${apiBaseUrl}?url=autocomplete.json&${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      return [];
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
