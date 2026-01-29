<template>
  <div class="home-view">
    <div class="app-layout" :class="{ 'no-sidebar-gap': !isSidebarVisible }">
      <!-- Backdrop Mobile -->
      <transition name="fade">
        <div
          v-if="isSidebarVisible"
          class="sidebar-backdrop"
          @click="toggleSidebar"
        />
      </transition>

      <SearchForm
        :search-query="inputQuery"
        :loading="loading"
        :limit="limit"
        :rating-filter="ratingFilter"
        :posts="posts"
        :infinite-scroll="infiniteScroll"
        :masonry-mode="isMasonryMode"
        :active-extra-action="activeExtraAction"
        @update:search-query="inputQuery = $event"
        @update:limit="updateLimit"
        @update:rating-filter="updateRatingFilter"
        @update:infinite-scroll="infiniteScroll = $event"
        @update:masonry-mode="toggleMasonry"
        @search="handleSearch"
        @example-clicked="setExample"
        @trigger-action="handleAction"
        @search-error="handleSearchError"
      />

      <main class="main-content" :class="{ 'sidebar-open': isSidebarVisible }">
        <!-- Error Banner -->
        <transition name="slide-down">
          <div v-if="error" class="error-banner">
            <span class="icon">⚠️</span>
            <span class="error-text">{{ error }}</span>
            <button class="close-error-btn" @click="error = null">✕</button>
          </div>
        </transition>

        <!-- Search Title -->
        <transition name="slide-fade">
          <div v-if="showSearchTitle" class="search-title-container">
            <h2 class="search-title">
              <span class="results-text">Results for:</span>
              <span class="search-query">{{ appliedQuery }}</span>
            </h2>
          </div>
        </transition>

        <!-- Mode Banners -->
        <ModeBanner
          v-if="modeBannerConfig"
          v-bind="modeBannerConfig"
          @clear="handleSearch('')"
        />

        <!-- New Posts Notification -->
        <transition name="fade-up">
          <div v-if="hasNewPosts && !loading" class="new-posts-notification">
            <button @click="handleRefresh" class="new-posts-btn">
              <span class="icon">✨</span> New images available
            </button>
          </div>
        </transition>

        <PostGallery
          :posts="posts"
          :loading="loading"
          :current-page="currentPage"
          :has-next-page="hasNextPage"
          :infinite-scroll="infiniteScroll"
          :rating-counts="ratingCounts"
          :pause-animations="!!selectedPost"
          :masonry="isMasonryMode"
          @change-page="handlePageChange"
          @load-more="handleLoadMore"
          @post-clicked="openModal"
        />
      </main>
    </div>

    <Transition name="modal">
      <ImageDetailModal
        v-if="selectedPost"
        :post="selectedPost"
        @close="selectedPost = null"
        @next="navigatePost(1)"
        @prev="navigatePost(-1)"
        @search-tag="handleTagSearch"
        @update-post="selectedPost = $event"
        :has-next="canNext"
        :has-prev="canPrev"
        :is-loading-next-page="isLoadingNextPage"
      />
    </Transition>

    <Transition name="fade">
      <button
        v-if="showScrollToTop && isMasonryMode && !selectedPost"
        @click="scrollToTop"
        class="scroll-to-top-btn"
        aria-label="Scroll to top"
      >
        <i class="lni lni-arrow-up" />
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import SearchForm from "../components/SearchForm.vue";
import PostGallery from "../components/PostGallery.vue";
import ImageDetailModal from "../components/ImageDetailModal.vue";
import ModeBanner from "../components/ModeBanner.vue";
import { useDanbooruApi } from "../composables/useDanbooruApi";
import { useRatingCounts } from "../composables/useRatingCounts";
import { useLayout } from "../composables/useLayout";
import DanbooruService from "../services/danbooru";

// ==========================================
// ROUTER Y ESTADO GLOBAL
// ==========================================
const route = useRoute();
const router = useRouter();
const { isSidebarVisible, toggleSidebar, setSidebarVisible } = useLayout();

// ==========================================
// ESTADO DEL FORMULARIO
// ==========================================
const inputQuery = ref("");
const appliedQuery = ref("");
const selectedPost = ref(null);
const error = ref(null);
const isRandomMode = ref(false);
const isLoadingNextPage = ref(false);
const showScrollToTop = ref(false);

// Persistencia local
const ls = {
  limit: localStorage.getItem("postsPerPage"),
  rating: localStorage.getItem("ratingFilter"),
  masonry: localStorage.getItem("masonryMode"),
};

const isMasonryMode = ref(ls.masonry === "true");
const infiniteScroll = ref(isMasonryMode.value);

const userLimit = ref(ls.limit ? parseInt(ls.limit, 10) : 20);
const limit = ref(isMasonryMode.value ? 75 : userLimit.value);
// Default to 'general' (G) if no preference is saved
const ratingFilter = ref(ls.rating !== null ? ls.rating : "general");

const lastListPost = ref(null);

// ==========================================
// COMPOSABLES DE API
// ==========================================
const currentPageRef = computed(() => parseInt(route.query.page) || 1);

const {
  posts,
  loading,
  error: apiError,
  currentPage,
  hasNextPage,
  searchPosts,
  hasNewPosts,
  refreshGallery,
} = useDanbooruApi(
  appliedQuery,
  limit,
  ratingFilter,
  infiniteScroll,
  currentPageRef,
);

watch(apiError, (val) => {
  if (val) error.value = val;
});

const {
  ratingCounts,
  fetchRatingCounts,
  cleanup: cleanupRatingCounts,
} = useRatingCounts();

// ==========================================
// COMPUTED PROPERTIES
// ==========================================
const showSearchTitle = computed(() => {
  if (!appliedQuery.value) return false;
  const excluded = ["status:deleted", "order:score", "order:favcount"];
  return !excluded.some((tag) => appliedQuery.value.includes(tag));
});

const currentRangeFriendlyName = computed(() => {
  const q = appliedQuery.value;
  if (q.includes("age:<1d")) return "day";
  if (q.includes("age:<1w")) return "week";
  if (q.includes("age:<1month") || q.includes("age:<1m")) return "month";
  if (q.includes("age:<1y")) return "year";
  return "all time";
});

const activeExtraAction = computed(() => {
  const q = appliedQuery.value;
  if (q.includes("status:deleted")) return "deleted";
  if (q.includes("order:score")) return "most-liked";
  if (q.includes("order:favcount")) return "most-favorited";
  if (q.includes("order:rank")) return "hot";
  return null;
});

const modeBannerConfig = computed(() => {
  const q = appliedQuery.value;
  if (!q) return null;

  const configs = {
    "status:deleted": {
      icon: "🗑️",
      text: `Showing deleted posts of the ${currentRangeFriendlyName.value}`,
      type: "deleted",
    },
    "order:score": {
      icon: "❤️",
      text: `Showing top posts of the ${currentRangeFriendlyName.value}`,
      type: "likes",
    },
    "order:favcount": {
      icon: "⭐",
      text: `Showing most favorited of the ${currentRangeFriendlyName.value}`,
      type: "favs",
    },
    "order:rank": {
      icon: "🔥",
      text: `Showing trending posts of the ${currentRangeFriendlyName.value}`,
      type: "trending",
    },
  };

  const key = Object.keys(configs).find((k) => q.includes(k));
  return key ? configs[key] : null;
});

const currentPostIndex = computed(() => {
  if (!selectedPost.value) return -1;
  return posts.value.findIndex((p) => p.id === selectedPost.value.id);
});

const canPrev = computed(() => {
  if (!selectedPost.value || isRandomMode.value) return false;
  return currentPostIndex.value > 0 || currentPage.value > 1;
});

const canNext = computed(() => {
  if (!selectedPost.value || isRandomMode.value) return false;
  return currentPostIndex.value < posts.value.length - 1 || hasNextPage.value;
});

// ==========================================
// WATCHERS OPTIMIZADOS (INTEGRADOS)
// ==========================================

// 1. Sincronización URL <-> Estado (con FIX de tags y comas)
watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    // 1. Sincronización URL <-> Estado
    const newTags = newQuery.tags || "";
    const newRating = newQuery.rating; // undefined if missing
    const newPage = parseInt(newQuery.page) || 1;

    // Handle Rating Logic First
    if (newRating !== undefined) {
      if (newRating !== ratingFilter.value) {
        ratingFilter.value = newRating;
      }
    } else {
      // URL has no rating -> Enforce current preference
      if (ratingFilter.value !== "") {
        // Redirect to include the rating in URL
        router.replace({
          query: { ...newQuery, rating: ratingFilter.value },
        });
        return; // Stop processing to avoid double-fetch
      }
    }

    const tagsChanged = newTags !== appliedQuery.value;

    if (tagsChanged) {
      appliedQuery.value = newTags;
      isRandomMode.value = false;

      const isSpecialMode = [
        "status:deleted",
        "order:score",
        "order:favcount",
        "order:rank",
      ].some((tag) => newTags.includes(tag));

      if (isSpecialMode) {
        inputQuery.value = "";
      } else {
        inputQuery.value = newTags;
      }

      // FIX: Normalización mejorada soportando coma arabe (،) y coma estandar
      const normalized = newTags
        .split(/[,،\s]+/)
        .filter((t) => t.trim())
        .join(" ");
      fetchRatingCounts(normalized);

      if (oldQuery && tagsChanged) {
        await searchPosts(1, true);
      }
    }

    if (oldQuery && newPage !== currentPage.value && !loading.value) {
      await searchPosts(newPage, !infiniteScroll.value);
    }
  },
  { immediate: true },
);

// 2. Persistencia rating
watch(ratingFilter, (val) => {
  localStorage.setItem("ratingFilter", val);
  if (route.query.rating !== val) {
    router.replace({
      query: { ...route.query, rating: val || undefined, page: 1 },
    });
  }
});

// 3. Persistencia limit (solo si no es masonry)
watch(limit, (val) => {
  if (!isMasonryMode.value) {
    userLimit.value = val;
    localStorage.setItem("postsPerPage", val);
  }
});

// 4. Título dinámico
watch(
  appliedQuery,
  (val) => {
    if (val) {
      const formatted = val
        .split(/[,،\s]+/)
        .filter((t) => t)
        .join(" AND ");
      document.title = `${formatted} | Booru Explorer`;
    } else {
      document.title = "Booru Explorer | Anime Image Board";
    }
  },
  { immediate: true },
);

// ==========================================
// MANEJADORES DE EVENTOS
// ==========================================

const updateLimit = (val) => {
  limit.value = val;
  if (!isMasonryMode.value) {
    router.push({ query: { ...route.query, limit: val, page: 1 } });
  }
};

const updateRatingFilter = (val) => {
  ratingFilter.value = val;
};

const toggleMasonry = async (val) => {
  isMasonryMode.value = val;
  localStorage.setItem("masonryMode", val);

  if (val) {
    infiniteScroll.value = true;
    if (limit.value < 75) limit.value = 75;
  } else {
    infiniteScroll.value = false;
    limit.value = userLimit.value;
  }

  await nextTick();
  window.scrollTo({ top: 0, behavior: "auto" });
};

const handleSearch = async (overrideQuery) => {
  const finalQuery =
    typeof overrideQuery === "string" ? overrideQuery : inputQuery.value;

  // Validación de tags (máximo 2 sin meta-tags)
  const contentTags = finalQuery
    .split(/[,،\s]+/)
    .map((t) => t.trim())
    .filter((t) => t && !t.match(/^(rating:|order:|status:|age:|-)/));

  if (contentTags.length > 2) {
    error.value = `You can only search up to 2 tags at a time. You entered ${contentTags.length} tags: ${contentTags.join(", ")}`;
    setTimeout(() => (error.value = null), 5000);
    return;
  }

  if (window.innerWidth <= 768) setSidebarVisible(false);

  isRandomMode.value = false;
  error.value = null;

  const queryParams = {};
  if (finalQuery) queryParams.tags = finalQuery;
  if (ratingFilter.value) queryParams.rating = ratingFilter.value;
  queryParams.page = 1;

  await router.push({ path: "/", query: queryParams });

  const isSpecialMode = [
    "status:deleted",
    "order:score",
    "order:favcount",
    "order:rank",
  ].some((tag) => finalQuery.includes(tag));

  if (isSpecialMode) {
    inputQuery.value = "";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};

const handlePageChange = async (page) => {
  if (loading.value) return;
  await router.push({ query: { ...route.query, page: page.toString() } });
};

const handleLoadMore = async () => {
  if (loading.value || !hasNextPage.value) return;
  await searchPosts(currentPage.value + 1, true);
};

const setExample = (example) => {
  inputQuery.value = example;
  handleSearch();
};

const handleSearchError = (msg) => {
  error.value = msg;
  setTimeout(() => (error.value = null), 5000);
};

const handleTagSearch = async (tag, clearFilter = false) => {
  isRandomMode.value = false;
  selectedPost.value = null;

  const queryParams = { tags: tag };
  if (!clearFilter && ratingFilter.value)
    queryParams.rating = ratingFilter.value;

  await router.push({ path: "/", query: queryParams });
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (window.innerWidth <= 768) setSidebarVisible(false);
};

const handleAction = async (action, timeRange) => {
  const ageMap = {
    day: "age:<1d",
    week: "age:<1w",
    month: "age:<1month",
    year: "age:<1y",
  };
  const ageFilter = ageMap[timeRange] || "";

  if (action === "random") {
    isRandomMode.value = true;
    inputQuery.value = "";
    try {
      const post = await DanbooruService.getRandomPost();
      if (post) selectedPost.value = post;
    } catch (e) {
      console.error("Error fetching random post", e);
      error.value = "Failed to load random post";
    }
    return;
  }

  const actionMap = {
    deleted: `status:deleted ${ageFilter}`,
    "most-liked": `order:score ${ageFilter}`,
    "most-favorited": `order:favcount ${ageFilter}`,
    hot: `order:rank ${ageFilter}`,
  };

  const searchQuery = actionMap[action]?.trim();
  if (!searchQuery) return;

  error.value = null;

  const queryParams = {
    tags: searchQuery,
    page: 1,
  };

  if (ratingFilter.value) {
    queryParams.rating = ratingFilter.value;
  }

  await router.push({ path: "/", query: queryParams });

  if (window.innerWidth <= 768) setSidebarVisible(false);
};

const handleRefresh = async () => {
  console.log("[HomeView] Refreshing gallery...");
  await refreshGallery();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ==========================================
// MODAL NAVIGATION
// ==========================================

const openModal = (post) => {
  isRandomMode.value = false;
  selectedPost.value = post;
  lastListPost.value = post;
};

const navigatePost = async (direction) => {
  if (!selectedPost.value || isRandomMode.value) return;

  let index = posts.value.findIndex((p) => p.id === selectedPost.value.id);
  if (index === -1 && lastListPost.value) {
    index = posts.value.findIndex((p) => p.id === lastListPost.value.id);
  }
  if (index === -1) return;

  const newIndex = index + direction;

  if (newIndex >= 0 && newIndex < posts.value.length) {
    selectedPost.value = posts.value[newIndex];
    lastListPost.value = posts.value[newIndex];
    return;
  }

  if (newIndex >= posts.value.length && hasNextPage.value && !loading.value) {
    if (isMasonryMode.value) {
      isLoadingNextPage.value = true;
      try {
        await searchPosts(currentPage.value + 1, true);
        if (posts.value.length > index + 1) {
          selectedPost.value = posts.value[index + 1];
          lastListPost.value = posts.value[index + 1];
        }
      } finally {
        isLoadingNextPage.value = false;
      }
    } else {
      const nextPage = currentPage.value + 1;
      await handlePageChange(nextPage);
      if (posts.value.length > 0) {
        selectedPost.value = posts.value[0];
        lastListPost.value = posts.value[0];
      }
    }
    return;
  }

  if (newIndex < 0 && currentPage.value > 1 && !loading.value) {
    isLoadingNextPage.value = true;
    try {
      await handlePageChange(currentPage.value - 1);
      if (posts.value.length > 0) {
        selectedPost.value = posts.value[posts.value.length - 1];
        lastListPost.value = posts.value[posts.value.length - 1];
      }
    } finally {
      isLoadingNextPage.value = false;
    }
  }
};

// ==========================================
// KEYBOARD NAVIGATION
// ==========================================
let lastKeyTime = 0;
const KEY_THROTTLE = 150;

const handleKeydown = (e) => {
  const now = Date.now();
  if (now - lastKeyTime < KEY_THROTTLE) return;

  const target = e.target;
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.isContentEditable
  )
    return;

  const key = e.key.toLowerCase();
  lastKeyTime = now;

  if (selectedPost.value) {
    if (key === "a" || key === "arrowleft") navigatePost(-1);
    else if (key === "d" || key === "arrowright") navigatePost(1);
  } else {
    if (key === "a" && currentPage.value > 1)
      handlePageChange(currentPage.value - 1);
    else if (key === "d" && hasNextPage.value)
      handlePageChange(currentPage.value + 1);
  }
};

// ==========================================
// SCROLL HANDLER (DEBOUNCED)
// ==========================================
let scrollTimeout;
const handleScroll = () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    showScrollToTop.value = window.scrollY > 300;
  }, 100);
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ==========================================
// LIFECYCLE - INTEGRADO CON FIX
// ==========================================
let removeAfterEach = null;

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("scroll", handleScroll, { passive: true });

  // FIX: Garantizar fetch inicial de counts, incluso sin tags (del primer código)
  const initialTags = route.query.tags || "";
  const normalized = initialTags
    .split(/[,،\s]+/)
    .filter((t) => t.trim())
    .join(" ");

  fetchRatingCounts(normalized);

  // Mantener el scroll automático después de navegación (del segundo código)
  removeAfterEach = router.afterEach(() => {
    nextTick(() => {
      if (!selectedPost.value) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("scroll", handleScroll);
  if (removeAfterEach) removeAfterEach();
  clearTimeout(scrollTimeout);
});

if (typeof cleanupRatingCounts === "function") {
  cleanupRatingCounts();
}
</script>

<style scoped>
/* Page Layout Adjustments */
.app-layout {
  transition: gap 0.3s ease;
}

.app-layout.no-sidebar-gap {
  gap: 0;
}

/* Image Slide Transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.info-banner {
  background: #3b82f626;
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
  position: relative;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-banner.deleted-mode {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.info-banner.likes-mode {
  background: rgba(236, 72, 153, 0.15);
  border-color: rgba(236, 72, 153, 0.3);
  color: #fbcfe8;
}

.info-banner.favs-mode {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fde68a;
}

.info-banner.trending-mode {
  background: rgba(249, 115, 22, 0.15);
  border-color: rgba(249, 115, 22, 0.3);
  color: #fdba74;
}

.clear-mode-btn {
  position: absolute;
  right: 16px;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  padding: 4px;
}

.clear-mode-btn:hover {
  opacity: 1;
}

/* Error Banner */
.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
}

.error-banner .icon {
  font-size: 20px;
  flex-shrink: 0;
}

.error-banner .error-text {
  flex: 1;
  color: #fca5a5;
  font-size: 14px;
  line-height: 1.5;
}

.close-error-btn {
  background: transparent;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.7;
  padding: 4px;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.close-error-btn:hover {
  opacity: 1;
}

/* Slide down transition */
.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.2s ease-in;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.timeout-explanation {
  margin-top: -10px;
  margin-bottom: 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #cbd5e1;
}

.timeout-explanation ul {
  margin-left: 20px;
  margin-top: 5px;
}

.danbooru-info-box {
  background: rgba(0, 0, 0, 0.2);
  border-left: 3px solid #64748b;
  padding: 8px 12px;
  margin: 12px 0;
  font-style: italic;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Mobile Responsiveness Styles */
.sidebar-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999;
  display: none;
}

@media (max-width: 768px) {
  .sidebar-backdrop {
    display: block;
  }
}

/* Search Title */
.search-title-container {
  text-align: center;
  margin-bottom: 20px;
  padding: 12px 20px;
  background: rgba(167, 139, 250, 0.05);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.results-text {
  color: #94a3b8;
  font-weight: 500;
}

.search-query {
  background: linear-gradient(135deg, #a78bfa 0%, #c084fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: "Inter", sans-serif;
  font-weight: 700;
  overflow-wrap: anywhere;
  word-break: break-word;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

/* Slide fade transition */
@media (max-width: 768px) {
  .search-title {
    font-size: 16px;
    gap: 6px;
  }

  .search-title-container {
    margin-bottom: 16px;
    padding: 10px 12px;
    width: 100%;
    box-sizing: border-box;
  }
}

@media (max-width: 480px) {
  .search-title {
    font-size: 14px;
    gap: 4px;
  }

  .search-title-container {
    padding: 8px 10px;
  }
}

/* Scroll to Top Button */
.scroll-to-top-btn {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(20, 20, 28, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #a78bfa;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(167, 139, 250, 0.1);
}

.scroll-to-top-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.4);
  color: #c084fc;
  transform: translateY(-4px);
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(167, 139, 250, 0.2);
}

.scroll-to-top-btn:active {
  transform: translateY(-2px);
  background: rgba(167, 139, 250, 0.2);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(167, 139, 250, 0.1);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .scroll-to-top-btn {
    bottom: 24px;
    right: 24px;
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .scroll-to-top-btn {
    bottom: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    font-size: 18px;
  }
}

/* New Posts Notification */
.new-posts-notification {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.new-posts-btn {
  pointer-events: auto;
  background: rgba(167, 139, 250, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px 28px;
  border-radius: 50px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.new-posts-btn .icon {
  font-size: 18px;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4));
}

.new-posts-btn:hover {
  background: rgba(167, 139, 250, 0.6);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-6px);
  box-shadow:
    0 15px 50px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(167, 139, 250, 0.3);
}

.new-posts-btn:active {
  transform: translateY(-2px);
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 40px);
}
</style>
