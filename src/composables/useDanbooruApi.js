// composables/useDanbooruApi.js
import { ref, computed, watch } from "vue";
import { useQuery, useInfiniteQuery } from "@tanstack/vue-query";
import DanbooruService from "../services/danbooru";

/**
 * Composable principal para gestión de posts de Danbooru.
 *
 * Características:
 * - Dual mode: Paginación tradicional VS Infinite scroll (Masonry)
 * - Smart Search: Bypass del límite de 2 tags de Danbooru
 * - Polling inteligente: Detecta nuevos posts cada 60s
 * - Cancelación de requests: AbortController para evitar race conditions
 *
 * @param {Ref<string>} initialTags - Tags de búsqueda (reactivo)
 * @param {Ref<number>} limit - Posts por página
 * @param {Ref<string>} ratingFilter - '', 'general', 'safe', etc
 * @param {Ref<boolean>} infiniteScroll - true = Masonry mode
 * @param {Ref<number>} currentPageRef - Página actual
 * @param {Ref<boolean>} isRandomMode - Modo random activado
 */
export function useDanbooruApi(
  initialTags,
  limit,
  ratingFilter,
  infiniteScroll,
  currentPageRef,
  isRandomMode = ref(false), // Nuevo parámetro con valor por defecto
) {
  // ==========================================
  // CONFIGURACIÓN Y ESTADO
  // ==========================================

  const lastAcknowledgedId = ref(0);

  // FIX: Inicializar lastAcknowledgedId al cargar posts para evitar
  // que muestré "New images!" inmediatamente al cambiar de búsqueda
  const initializeAcknowledgedId = (posts) => {
    if (posts?.length > 0 && lastAcknowledgedId.value === 0) {
      lastAcknowledgedId.value = posts[0].id;
    }
  };

  const RATING_MAP = {
    general: "g",
    safe: "s",
    questionable: "q",
    explicit: "e",
  };

  // ==========================================
  // COMPUTED: Construcción de Query Key
  // ==========================================

  const queryKey = computed(() => {
    let tags = initialTags.value?.trim() || "";

    if (ratingFilter.value && RATING_MAP[ratingFilter.value]) {
      const shortRating = RATING_MAP[ratingFilter.value];
      if (!tags.includes(`rating:${shortRating}`)) {
        tags = tags ? `${tags} rating:${shortRating}` : `rating:${shortRating}`;
      }
    }

    const baseKey = [
      "posts",
      {
        tags: tags.trim(),
        limit: limit.value,
        mode: infiniteScroll?.value ? "infinite" : "paged",
        random: isRandomMode.value ? "random" : "ordered", // Incluir modo random en key
      },
    ];

    if (!infiniteScroll?.value && currentPageRef?.value) {
      baseKey.push({ page: currentPageRef.value });
    }

    return baseKey;
  });

  // ==========================================
  // INFINITE QUERY PRINCIPAL
  // ==========================================

  const {
    data,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,

    queryFn: async ({ pageParam = 1, queryKey }) => {
      const [, params] = queryKey;

      // Modo random: siempre usar página 1 para obtener posts aleatorios
      const pageToFetch = isRandomMode.value
        ? 1
        : infiniteScroll?.value
          ? pageParam
          : currentPageRef?.value || 1;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        let result;

        if (isRandomMode.value) {
          // En modo random, añadir orden aleatorio
          const randomTags = params.tags
            ? `${params.tags} order:random`
            : "order:random";
          result = await DanbooruService.getPosts(
            randomTags,
            params.limit,
            pageToFetch,
            { signal: controller.signal },
          );
        } else {
          result = await DanbooruService.getPosts(
            params.tags,
            params.limit,
            pageToFetch,
            { signal: controller.signal },
          );
        }

        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    },

    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.length) return undefined;

      // Modo random: deshabilitar paginación infinita
      if (isRandomMode.value) return undefined;

      const [, params] = queryKey.value;
      const contentTags = params.tags
        .split(" ")
        .filter((t) => t && !t.match(/^(rating:|order:|status:|age:|-)/));

      const isSmartSearch = contentTags.length > 2;

      if (isSmartSearch && lastPage.length > 0) {
        return allPages.length + 1;
      }

      if (lastPage.length < limit.value) return undefined;

      return allPages.length + 1;
    },

    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 2,
    retryDelay: (attempt) => attempt * 1000,
  });

  // ==========================================
  // COMPUTED: Posts procesados
  // ==========================================

  const posts = computed(() => {
    if (!data.value?.pages?.length) return [];

    // FIX: Inicializar acknowledgedId cuando se cargan posts nuevos
    const result = infiniteScroll?.value
      ? data.value.pages.flat()
      : data.value.pages[data.value.pages.length - 1] || [];

    // Inicializar solo si es nueva búsqueda (ack es 0)
    if (result.length > 0) {
      initializeAcknowledgedId(result);
    }

    return result;
  });

  // ==========================================
  // POLLING: Detección de nuevos posts (SOLO primera página)
  // ==========================================

  const { data: latestCheck, refetch: checkForNewPosts } = useQuery({
    queryKey: computed(() => ["latest-check", queryKey.value[1]?.tags]),

    queryFn: async ({ queryKey }) => {
      const tags = queryKey[1]; // FIX: El key contiene el string directo, no un objeto params
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        // Solo buscar 1 post el más reciente
        return await DanbooruService.getPosts(tags, 1, 1, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    },

    // FIX: Polling cada 60s solo si:
    // - Estamos en primera página
    // - Tenemos posts cargados
    // - No estamos en modo random
    refetchInterval: computed(() => {
      const isFirstPage = !currentPageRef?.value || currentPageRef.value === 1;
      const hasPosts = posts.value.length > 0;
      const canPoll = isFirstPage && hasPosts && !isRandomMode.value;
      return canPoll ? 60000 : false; // false = desactivar polling
    }),

    refetchIntervalInBackground: false,
    staleTime: 0,
    enabled: computed(() => {
      // Solo habilitar query si cumple condiciones
      const isFirstPage = !currentPageRef?.value || currentPageRef.value === 1;
      const hasPosts = posts.value.length > 0;
      return isFirstPage && hasPosts && !isRandomMode.value;
    }),
  });

  // FIX: hasNewPosts solo true si:
  // 1. Hay datos del poll
  // 2. Hay posts visibles
  // 3. El ID del poll es MAYOR AL PRIMER POST VISIBLE
  // 4. El ID es mayor al último acknowledge
  /* FIX: Validez estricta para notificación de nuevos posts */
  const hasNewPosts = computed(() => {
    // 1. Validaciones básicas de existencia
    if (!latestCheck.value?.[0] || !posts.value?.[0]) return false;

    // 2. Modos incompatibles
    if (isRandomMode.value) return false;
    if (currentPageRef?.value && currentPageRef.value > 1) return false; // Solo página 1

    const newestPost = latestCheck.value[0];
    const currentFirstPost = posts.value[0];

    // 3. Validación de ID: debe ser estrictamente mayor
    if (newestPost.id <= currentFirstPost.id) return false;
    if (newestPost.id <= lastAcknowledgedId.value) return false;

    // 4. Validación extra: Verificar que el post cumpla con el rating actual si existe
    // Esto evita falsos positivos si la API devuelve algo inconsistente momentáneamente
    if (ratingFilter.value) {
      const requiredRating = RATING_MAP[ratingFilter.value];
      if (requiredRating && newestPost.rating !== requiredRating) {
        return false;
      }
    }

    return true;
  });

  // Watcher para resetear acknowledge SÓLO cuando cambian los tags
  watch(
    () => queryKey.value[1]?.tags,
    (newTags, oldTags) => {
      if (newTags !== oldTags) {
        console.log("[DanbooruApi] Tags changed, resetting acknowledge");
        lastAcknowledgedId.value = 0;
      }
    },
    { flush: "post" },
  ); // 'post' para que corra después de que posts se actualice

  // ==========================================
  // MÉTODOS PÚBLICOS
  // ==========================================

  const searchPosts = async (targetPage = 1, isNewSearch = false) => {
    if (isNewSearch) {
      await refetch();

      const loadedPages = data.value?.pages.length || 0;
      for (let i = loadedPages; i < targetPage; i++) {
        if (!hasNextPage.value) break;
        await fetchNextPage();
      }
    } else {
      await fetchNextPage();
    }
  };

  const refreshGallery = async () => {
    await Promise.all([refetch(), checkForNewPosts()]);

    const currentMax = Math.max(
      posts.value[0]?.id || 0,
      latestCheck.value?.[0]?.id || 0,
      lastAcknowledgedId.value,
    );
    lastAcknowledgedId.value = currentMax;
  };

  return {
    posts,
    loading: computed(() => isFetching.value && !isFetchingNextPage.value),
    loadingNext: isFetchingNextPage,
    error: computed(() => (isError.value ? error.value?.message : null)),
    currentPage: computed(() => {
      if (!infiniteScroll?.value) {
        return currentPageRef?.value || 1;
      }
      return data.value?.pages.length || 1;
    }),
    hasNextPage,
    hasNewPosts,
    searchPosts,
    refreshGallery,
    refetch,
  };
}

// ==========================================
// FUNCIONES STANDALONE (Modal Detail)
// ==========================================

export const getPost = async (id) => {
  try {
    return await DanbooruService.getPost(id);
  } catch (e) {
    console.error("[useDanbooruApi] getPost error:", e);
    return null;
  }
};

export const getPostComments = async (postId, page = 1, limit = 20) => {
  try {
    return await DanbooruService.getComments(postId, page, limit);
  } catch (e) {
    console.error("[useDanbooruApi] getComments error:", e);
    return [];
  }
};

export const getArtist = async (id) => {
  try {
    const res = await fetch(`/api/danbooru?url=artists/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[useDanbooruApi] getArtist error:", e);
    return null;
  }
};

export const getNotes = async (postId) => {
  try {
    const res = await fetch(
      `/api/danbooru?url=notes.json&search[post_id]=${postId}&search[is_active]=true`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[useDanbooruApi] getNotes error:", e);
    return [];
  }
};

export function usePostNotes(postId) {
  return useQuery({
    queryKey: computed(() => ["post-notes", postId.value]),
    queryFn: () => getNotes(postId.value),
    enabled: computed(() => !!postId.value),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePostCommentary(postId) {
  return useQuery({
    queryKey: computed(() => ["post-commentary", postId.value]),
    queryFn: async () => {
      const data = await DanbooruService.getArtistCommentary(postId.value);
      return data?.[0] || null;
    },
    enabled: computed(() => !!postId.value),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePostFamily(postId, parentId, hasChildren) {
  return useQuery({
    queryKey: computed(() => ["post-family", postId.value, parentId.value]),
    queryFn: async () => {
      const rootId =
        parentId.value || (hasChildren.value ? postId.value : null);
      if (!rootId) return [];

      const tags = `~parent:${rootId} ~id:${rootId}`;
      const posts = await DanbooruService.getPosts(tags, 20);

      return (posts || [])
        .filter((p) => p.file_url || p.large_file_url)
        .sort((a, b) => a.id - b.id);
    },
    enabled: computed(() => {
      return !!postId.value && (!!parentId.value || !!hasChildren.value);
    }),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePostComments(postId, limit = 20) {
  return useInfiniteQuery({
    queryKey: computed(() => ["post-comments", postId.value, limit]),
    queryFn: ({ pageParam = 1 }) =>
      DanbooruService.getComments(postId.value, pageParam, limit),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage?.length === limit ? allPages.length + 1 : undefined;
    },
    enabled: computed(() => !!postId.value),
    staleTime: 5 * 60 * 1000,
  });
}
