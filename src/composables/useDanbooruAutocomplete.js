import { ref, watch } from 'vue';

export function useDanbooruAutocomplete() {
  const suggestions = ref([]);
  const loadingSuggestions = ref(false);
  const error = ref('');
  
  // Cache para sugerencias
  const suggestionCache = new Map();
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos
  
  // Debounce para evitar demasiadas solicitudes
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 300;
  
  // AbortController para cancelar solicitudes
  let abortController = null;
  
  // Mapeo de categorías a nombres legibles y colores
  const tagCategories = {
    0: { name: 'general', color: '#3b82f6', class: 'tag-general' },
    1: { name: 'artist', color: '#8b5cf6', class: 'tag-artist' },
    3: { name: 'copyright', color: '#10b981', class: 'tag-copyright' },
    4: { name: 'character', color: '#ef4444', class: 'tag-character' },
    5: { name: 'meta', color: '#f59e0b', class: 'tag-meta' }
  };
  
  // Extensiones de archivo comunes
  const fileExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webm', 'mp4', 'mov', 'avi', 
    'zip', 'swf', 'avif', 'webp', 'bmp', 'tiff', 'tif'
  ];
  
  // Ratings predefinidos
  const ratings = ['g', 's', 'q', 'e'];
  
  // Status predefinidos
  const statuses = ['active', 'pending', 'deleted', 'flagged', 'banned'];
  
  // Ordenamientos comunes
  const orders = [
    'id', 'id_desc', 'score', 'score_asc', 'favcount', 
    'favcount_asc', 'change', 'change_asc', 'random'
  ];

  // Función para formatear números grandes
  const formatCount = (count) => {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count.toString();
  };

  // Detectar tipo de sugerencia especial
  const detectSpecialType = (term) => {
    const lowerTerm = term.toLowerCase();
    
    if (lowerTerm.startsWith('filetype:')) {
      const extension = term.substring(9).toLowerCase();
      return {
        type: 'filetype',
        value: extension,
        suggestions: fileExtensions.filter(ext => 
          ext.startsWith(extension) || extension === ''
        ).map(ext => `filetype:${ext}`)
      };
    }
    
    if (lowerTerm.startsWith('rating:')) {
      const rating = term.substring(7).toLowerCase();
      return {
        type: 'rating',
        value: rating,
        suggestions: ratings.filter(r => 
          r.startsWith(rating) || rating === ''
        ).map(r => `rating:${r}`)
      };
    }
    
    if (lowerTerm.startsWith('status:')) {
      const status = term.substring(7).toLowerCase();
      return {
        type: 'status',
        value: status,
        suggestions: statuses.filter(s => 
          s.startsWith(status) || status === ''
        ).map(s => `status:${s}`)
      };
    }
    
    if (lowerTerm.startsWith('order:')) {
      const order = term.substring(6).toLowerCase();
      return {
        type: 'order',
        value: order,
        suggestions: orders.filter(o => 
          o.startsWith(order) || order === ''
        ).map(o => `order:${o}`)
      };
    }
    
    if (lowerTerm.startsWith('-')) {
      return { type: 'negation', value: term.substring(1) };
    }
    
    return { type: 'regular', value: term };
  };

  // Generar sugerencias especiales
  const generateSpecialSuggestions = (typeInfo) => {
    const { type, value, suggestions = [] } = typeInfo;
    
    return suggestions.map(suggestion => ({
      name: suggestion,
      post_count: 0,
      category: 5, // Meta
      class: 'tag-meta',
      type: 'special',
      highlight: value.length > 0 ? suggestion.replace(
        new RegExp(`(${value})`, 'i'), 
        '<strong>$1</strong>'
      ) : suggestion
    }));
  };

  // Obtener el último término de búsqueda
  const getLastTerm = (query) => {
    // Divide por espacios, comas o comas chinas
    const terms = query.split(/[,，\s]+/);
    return terms[terms.length - 1];
  };

  // Función principal de búsqueda con debouncing
  const fetchSuggestions = async (query) => {
    // Cancelar timer anterior
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Cancelar solicitud anterior
    if (abortController) {
      abortController.abort();
    }
    
    // Si la consulta es muy corta, limpiar sugerencias
    if (!query || query.trim().length < 2) {
      suggestions.value = [];
      return;
    }
    
    // Usar debouncing
    return new Promise((resolve) => {
      debounceTimer = setTimeout(async () => {
        const lastTerm = getLastTerm(query);
        
        // Si el último término está vacío, no hacer nada
        if (!lastTerm || lastTerm.trim().length < 1) {
          suggestions.value = [];
          resolve();
          return;
        }
        
        // Detectar tipo de sugerencia
        const specialType = detectSpecialType(lastTerm);
        
        // Generar sugerencias especiales si es necesario
        if (specialType.type !== 'regular') {
          suggestions.value = generateSpecialSuggestions(specialType);
          resolve();
          return;
        }
        
        // Verificar caché
        const cacheKey = lastTerm.toLowerCase();
        const cached = suggestionCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          suggestions.value = cached.data;
          resolve();
          return;
        }
        
        // Crear nuevo AbortController
        abortController = new AbortController();
        
        loadingSuggestions.value = true;
        error.value = '';
        
        try {
          // Mejorar la búsqueda: buscar tanto por coincidencia exacta como parcial
          // Primero intentamos coincidencia exacta o prefijo
          const searchParams = new URLSearchParams({
            'search[name_matches]': `${lastTerm}*`,
            'search[order]': 'count',
            'search[post_count]': '>0',
            limit: '15'
          });
          
          const response = await fetch(
            `https://danbooru.donmai.us/tags.json?${searchParams}`,
            { signal: abortController.signal }
          );
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          
          // Procesar y enriquecer los datos
          const processedSuggestions = data.map(tag => {
            const category = tag.category || 0;
            const categoryInfo = tagCategories[category] || tagCategories[0];
            
            return {
              name: tag.name,
              post_count: tag.post_count,
              category: category,
              class: categoryInfo.class,
              color: categoryInfo.color,
              formatted_count: formatCount(tag.post_count),
              // Resaltar la parte que coincide
              highlight: tag.name.replace(
                new RegExp(`(${lastTerm})`, 'i'), 
                '<strong>$1</strong>'
              )
            };
          });
          
          // Ordenar: primero coincidencia exacta, luego por popularidad
          processedSuggestions.sort((a, b) => {
            // Si uno empieza exactamente con el término, va primero
            const aExact = a.name.toLowerCase().startsWith(lastTerm.toLowerCase());
            const bExact = b.name.toLowerCase().startsWith(lastTerm.toLowerCase());
            
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            // Luego por conteo de posts
            return b.post_count - a.post_count;
          });
          
          // Guardar en caché
          suggestionCache.set(cacheKey, {
            timestamp: Date.now(),
            data: processedSuggestions
          });
          
          suggestions.value = processedSuggestions;
          
        } catch (err) {
          if (err.name === 'AbortError') {
            console.log('Suggestion request cancelled');
          } else {
            console.error('Error fetching suggestions:', err);
            error.value = 'Failed to load suggestions';
            suggestions.value = [];
          }
        } finally {
          loadingSuggestions.value = false;
          abortController = null;
          resolve();
        }
      }, DEBOUNCE_DELAY);
    });
  };

  // Función para insertar sugerencia en la consulta
  const insertSuggestion = (query, suggestion) => {
    const terms = query.split(/[,，\s]+/);
    terms[terms.length - 1] = suggestion;
    return terms.join(' ');
  };

  // Función para obtener sugerencias populares iniciales
  const fetchPopularTags = async () => {
    const CACHE_KEY = '__popular_tags__';
    const cached = suggestionCache.get(CACHE_KEY);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION * 2)) {
      return cached.data;
    }
    
    try {
      const response = await fetch(
        'https://danbooru.donmai.us/tags.json?search[order]=count&limit=20'
      );
      
      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      const popularTags = data.map(tag => ({
        name: tag.name,
        post_count: tag.post_count,
        category: tag.category,
        class: tagCategories[tag.category]?.class || 'tag-general',
        color: tagCategories[tag.category]?.color || '#3b82f6',
        formatted_count: formatCount(tag.post_count)
      }));
      
      suggestionCache.set(CACHE_KEY, {
        timestamp: Date.now(),
        data: popularTags
      });
      
      return popularTags;
    } catch (error) {
      console.error('Error fetching popular tags:', error);
      return [];
    }
  };

  // Limpiar sugerencias
  const clearSuggestions = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (abortController) {
      abortController.abort();
    }
    suggestions.value = [];
    loadingSuggestions.value = false;
    error.value = '';
  };

  // Función para limpiar caché
  const clearCache = () => {
    suggestionCache.clear();
  };

  return {
    suggestions,
    loadingSuggestions,
    error,
    fetchSuggestions,
    clearSuggestions,
    insertSuggestion,
    fetchPopularTags,
    clearCache,
    tagCategories
  };
}