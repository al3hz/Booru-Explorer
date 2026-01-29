import { ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import DanbooruService from "../services/danbooru";

export function useRatingCounts() {
  const ratingCounts = ref({
    all: 0,
    g: 0,
    s: 0,
    q: 0,
    e: 0,
  });

  const loadingCounts = ref(false);
  const isLimited = ref(false);
  let abortController = null;

  // Función para obtener conteos usando useQuery con cache
  const useRatingCountsQuery = (currentTags) => {
    return useQuery({
      queryKey: ["ratingCounts", currentTags],
      queryFn: async ({ signal }) => {
        const counts = {
          all: 0,
          g: 0,
          s: 0,
          q: 0,
          e: 0,
        };

        const ratings = ["g", "s", "q", "e"];
        const baseTags = currentTags ? currentTags.trim() : "";

        try {
          // Helper para fetch individual
          const getCount = async (tags) => {
            try {
              return await DanbooruService.getPostCount(tags, { signal });
            } catch (err) {
              // No loguear AbortError
              if (err.name === "AbortError") {
                throw err;
              }
              console.warn("[RatingCounts] Error fetching:", tags, err.message);
              return 0;
            }
          };

          // Paralelizar requests
          const promises = [
            getCount(baseTags), // Total
            ...ratings.map((r) => getCount(`${baseTags} rating:${r}`.trim())),
          ];

          const results = await Promise.all(promises);

          counts.all = results[0];
          ratings.forEach((r, i) => {
            counts[r] = results[i + 1];
          });

          // Detectar si es búsqueda limitada
          isLimited.value = baseTags.split(" ").length > 2;
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("[RatingCounts] Error:", err);
          }
          throw err;
        }

        return counts;
      },
      // Configuración de cache y comportamiento
      enabled: !!currentTags || currentTags === "", // Habilitar incluso para búsqueda vacía
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 10, // 10 minutos
      retry: 2,
      refetchOnWindowFocus: false,
    });
  };

  // Función original para compatibilidad (llamada imperativa)
  const fetchRatingCounts = async (currentTags) => {
    // Cancelar petición anterior si existe
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    loadingCounts.value = true;
    isLimited.value = false;

    const counts = {
      all: 0,
      g: 0,
      s: 0,
      q: 0,
      e: 0,
    };

    const ratings = ["g", "s", "q", "e"];
    const baseTags = currentTags ? currentTags.trim() : "";

    try {
      // Helper para fetch individual con timeout
      const getCount = async (tags) => {
        try {
          return await DanbooruService.getPostCount(tags, {
            signal: abortController.signal,
          });
        } catch (err) {
          // No loguear AbortError (es comportamiento esperado)
          if (err.name === "AbortError") {
            throw err;
          }
          console.warn("[RatingCounts] Error fetching:", tags, err.message);
          return 0;
        }
      };

      // Paralelizar requests
      const promises = [
        getCount(baseTags), // Total
        ...ratings.map((r) => getCount(`${baseTags} rating:${r}`.trim())),
      ];

      const results = await Promise.all(promises);

      counts.all = results[0];
      ratings.forEach((r, i) => {
        counts[r] = results[i + 1];
      });

      // Detectar si es búsqueda limitada (tags complejos)
      isLimited.value = baseTags.split(" ").length > 2;
    } catch (err) {
      // Solo loguear si NO es AbortError
      if (err.name !== "AbortError") {
        console.error("[RatingCounts] Error:", err);
      }
      // En caso de error/abort, mantener counts anteriores o 0
    } finally {
      loadingCounts.value = false;
      abortController = null;
    }

    ratingCounts.value = counts;
    return counts;
  };

  // Cleanup al desmontar
  const cleanup = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  return {
    ratingCounts,
    loadingCounts,
    isLimited,
    useRatingCountsQuery,
    fetchRatingCounts,
    cleanup,
  };
}
