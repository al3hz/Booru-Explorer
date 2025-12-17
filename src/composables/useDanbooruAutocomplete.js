import { ref } from 'vue';

export function useDanbooruAutocomplete() {
  const suggestions = ref([]);
  const loadingSuggestions = ref(false);

  // Mapeo de categorías a nombres para CSS/Lógica si es necesario
  // 0: General, 1: Artist, 3: Copyright, 4: Character, 5: Meta
  const getTagCategoryClass = (category) => {
    switch (category) {
      case 1: return 'tag-artist';
      case 3: return 'tag-copyright';
      case 4: return 'tag-character';
      case 5: return 'tag-meta';
      default: return 'tag-general';
    }
  };

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      suggestions.value = [];
      return;
    }

    // Si el usuario está escribiendo múltiples tags, sugerimos para el último
    const terms = query.split(/[,，\s]+/);
    const lastTerm = terms[terms.length - 1];

    if (lastTerm.length < 2) {
      suggestions.value = [];
      return;
    }

    loadingSuggestions.value = true;
    try {
      // Usamos el endpoint de tags para obtener info detallada (colores, conteo)
      // search[name_matches]=*term* busca coincidencias en cualquier parte (infix) para mostrar más resultados
      // search[order]=count ordena por popularidad
      // search[post_count]=>0 excluye tags vacíos
      const response = await fetch(
        `https://danbooru.donmai.us/tags.json?search[name_matches]=*${lastTerm}*&search[order]=count&search[post_count]=>0&limit=25`
      );
      
      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      
      suggestions.value = data.map(tag => ({
        name: tag.name,
        post_count: tag.post_count,
        category: tag.category,
        class: getTagCategoryClass(tag.category)
      }));

    } catch (error) {
      console.error('Error fetching suggestions:', error);
      suggestions.value = [];
    } finally {
      loadingSuggestions.value = false;
    }
  };

  const clearSuggestions = () => {
    suggestions.value = [];
  };

  return {
    suggestions,
    loadingSuggestions,
    fetchSuggestions,
    clearSuggestions
  };
}
