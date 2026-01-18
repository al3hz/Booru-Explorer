

export function useWikiSearch() {
  const apiBaseUrl = '/api/danbooru';

  const fetchRecentWikiPages = async (limit = 20) => {
    try {
      const res = await fetch(`${apiBaseUrl}?url=wiki_pages.json&limit=${limit}&search[order]=updated_at&search[is_deleted]=false`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (e) {
      console.error("Failed to fetch recent wikis:", e);
      return [];
    }
  };

  const fetchWikiAutocomplete = async (query) => {
    if (!query || query.length < 2) return [];
    try {
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
