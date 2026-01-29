// composables/useDanbooruAutocomplete.js
import { ref, computed } from "vue";

/**
 * Composable para sistema de autocomplete de tags de Danbooru.
 */
export function useDanbooruAutocomplete() {
  // ==========================================
  // ESTADO
  // ==========================================

  const suggestions = ref([]);
  const isLoading = ref(false);
  const error = ref("");
  const lastQuery = ref("");

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================

  const cache = new Map();
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

  let debounceTimer = null;
  const DEBOUNCE_MS = 300;
  let abortController = null;

  const TAG_CATEGORIES = {
    0: { name: "general", color: "#3b82f6", class: "tag-general" },
    1: { name: "artist", color: "#8b5cf6", class: "tag-artist" },
    3: { name: "copyright", color: "#10b981", class: "tag-copyright" },
    4: { name: "character", color: "#ef4444", class: "tag-character" },
    5: { name: "meta", color: "#f59e0b", class: "tag-meta" },
  };

  const META_VALUES = {
    filetype: [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webm",
      "mp4",
      "mov",
      "avi",
      "zip",
      "swf",
      "avif",
      "webp",
    ],
    rating: ["g", "s", "q", "e"],
    status: ["active", "pending", "deleted", "flagged", "banned"],
    order: [
      "id",
      "id_desc",
      "score",
      "score_asc",
      "favcount",
      "favcount_asc",
      "rank",
      "change",
      "change_asc",
      "random",
    ],
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const formatCount = (n) => {
    if (!n) return "0";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return String(n);
  };

  const getLastTerm = (query) => {
    const terms = query.split(/[,，\s]+/);
    return terms[terms.length - 1] || "";
  };

  /**
   * Detecta meta-tags y devuelve sugerencias inline
   */
  const detectMetaTag = (term) => {
    const lower = term.toLowerCase();
    const [prefix, ...rest] = lower.split(":");
    const value = rest.join("");

    if (META_VALUES[prefix]) {
      const matches = META_VALUES[prefix]
        .filter((v) => v.startsWith(value) || !value)
        .map((v) => `${prefix}:${v}`);
      return { type: prefix, suggestions: matches };
    }

    if (lower.startsWith("-")) {
      return { type: "negation", value: term.slice(1) };
    }

    return { type: "regular", value: term };
  };

  /**
   * Resalta coincidencias escapando regex peligrosos
   */
  const highlightMatch = (text, query) => {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(
      new RegExp(`(${escaped})`, "gi"),
      "<strong>$1</strong>",
    );
  };

  // ==========================================
  // FUNCIONES PRINCIPALES
  // ==========================================

  const fetchSuggestions = async (query) => {
    clearTimeout(debounceTimer);
    abortController?.abort();

    lastQuery.value = query;
    const lastTerm = getLastTerm(query);

    if (!lastTerm || lastTerm.length < 2) {
      suggestions.value = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      // Meta-tags: respuesta inmediata sin API
      const meta = detectMetaTag(lastTerm);
      if (meta.type !== "regular") {
        suggestions.value =
          meta.suggestions?.map((s) => ({
            name: s,
            post_count: 0,
            category: 5,
            class: "tag-meta",
            type: "special",
            highlight: highlightMatch(s, lastTerm.split(":")[1] || ""),
          })) || [];
        return;
      }

      // Caché
      const cacheKey = lastTerm.toLowerCase();
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        suggestions.value = cached.data;
        return;
      }

      // API Request
      abortController = new AbortController();
      isLoading.value = true;
      error.value = "";

      try {
        const params = new URLSearchParams({
          "search[name_matches]": `${lastTerm}*`,
          "search[order]": "count",
          "search[post_count]": ">0",
          limit: "15",
        });

        const res = await fetch(`/api/danbooru?url=tags.json&${params}`, {
          signal: abortController.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const processed = data
          .map((tag) => {
            const cat = TAG_CATEGORIES[tag.category] || TAG_CATEGORIES[0];
            return {
              name: tag.name,
              post_count: tag.post_count,
              category: tag.category,
              class: cat.class,
              color: cat.color,
              formatted_count: formatCount(tag.post_count),
              highlight: highlightMatch(tag.name, lastTerm),
            };
          })
          .sort((a, b) => {
            const aExact = a.name
              .toLowerCase()
              .startsWith(lastTerm.toLowerCase());
            const bExact = b.name
              .toLowerCase()
              .startsWith(lastTerm.toLowerCase());
            if (aExact !== bExact) return bExact - aExact;
            return b.post_count - a.post_count;
          });

        cache.set(cacheKey, { data: processed, ts: Date.now() });
        suggestions.value = processed;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[Autocomplete]", err);
          error.value = "Failed to load suggestions";
        }
      } finally {
        isLoading.value = false;
        abortController = null;
      }
    }, DEBOUNCE_MS);
  };

  const insertSuggestion = (query, suggestion) => {
    const terms = query.split(/[,，\s]+/);
    terms[terms.length - 1] = suggestion;
    return terms.join(" ");
  };

  const clearSuggestions = () => {
    clearTimeout(debounceTimer);
    abortController?.abort();
    suggestions.value = [];
    isLoading.value = false;
    error.value = "";
  };

  // Alias para mantener compatibilidad si alguien usa clear()
  const clear = clearSuggestions;

  const fetchPopularTags = async () => {
    const CACHE_KEY = "__popular__";
    const cached = cache.get(CACHE_KEY);

    if (cached && Date.now() - cached.ts < CACHE_TTL * 2) {
      return cached.data;
    }

    try {
      const res = await fetch(
        "/api/danbooru?url=tags.json&search[order]=count&limit=20",
      );
      if (!res.ok) throw new Error("API Error");

      const data = await res.json();
      const popular = data.map((tag) => {
        const cat = TAG_CATEGORIES[tag.category] || TAG_CATEGORIES[0];
        return {
          name: tag.name,
          post_count: tag.post_count,
          category: tag.category,
          class: cat.class,
          color: cat.color,
          formatted_count: formatCount(tag.post_count),
        };
      });

      cache.set(CACHE_KEY, { data: popular, ts: Date.now() });
      return popular;
    } catch (err) {
      console.error("[Autocomplete] Popular fetch error:", err);
      return [];
    }
  };

  return {
    suggestions,
    loadingSuggestions: isLoading,
    error,
    lastQuery: computed(() => lastQuery.value),
    fetchSuggestions,
    insertSuggestion,
    clearSuggestions,
    clear,
    fetchPopularTags,
    tagCategories: TAG_CATEGORIES,
  };
}
