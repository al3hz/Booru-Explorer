<template>
  <div class="home-view">
    <div class="app-layout" :class="{ 'no-sidebar-gap': !isSidebarVisible }">
      <!-- Sidebar Backdrop (Mobile Overlay) -->
      <transition name="fade">
        <div 
          v-if="isSidebarVisible" 
          class="sidebar-backdrop" 
          @click="toggleSidebar"
        ></div>
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
        @update:limit="limit = $event"
        @update:rating-filter="ratingFilter = $event"
        @update:infinite-scroll="infiniteScroll = $event"
        @update:masonry-mode="isMasonryMode = $event"
        @search="handleSearch"
        @example-clicked="setExample"
        @trigger-action="handleAction"
        @search-error="handleSearchError"
      />

      <main class="main-content" :class="{ 'sidebar-open': isSidebarVisible }">
        <transition name="slide-down">
          <div v-if="error" class="error-banner">
            <span class="icon">⚠️</span>
            <span class="error-text">{{ error }}</span>
            <button class="close-error-btn" @click="error = null" title="Close">✕</button>
          </div>
        </transition>
        
        <!-- Search Query Title -->
        <transition name="slide-fade">
          <div v-if="appliedQuery && !appliedQuery.includes('status:deleted') && !appliedQuery.includes('order:score') && !appliedQuery.includes('order:favcount')" class="search-title-container">
            <h2 class="search-title">
              <span class="results-text">Results for:</span>
              <span class="search-query">{{ appliedQuery }}</span>
            </h2>
          </div>
        </transition>
        
        <div v-if="appliedQuery.includes('status:deleted')" class="info-banner deleted-mode">
          <div class="banner-content">
            <span class="icon">🗑️</span>
            <span>Showing deleted posts of the {{ currentRangeFriendlyName }}</span>
          </div>
          <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
        </div>

        <div v-if="appliedQuery.includes('order:score')" class="likes-mode-container">
          <div class="info-banner likes-mode">
            <div class="banner-content">
              <span class="icon">❤️</span>
              <span>Showing top posts of the {{ currentRangeFriendlyName }}</span>
            </div>
            <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
          </div>
        </div>

        <div v-if="appliedQuery.includes('order:favcount')" class="favs-mode-container">
          <div class="info-banner favs-mode">
            <div class="banner-content">
              <span class="icon">⭐</span>
              <span>Showing most favorited of the {{ currentRangeFriendlyName }}</span>
            </div>
            <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
          </div>
        </div>

        <div v-if="appliedQuery.includes('order:rank')" class="trending-mode-container">
          <div class="info-banner trending-mode">
            <div class="banner-content">
              <span class="icon">🔥</span>
              <span>Showing trending posts of the {{ currentRangeFriendlyName }}</span>
            </div>
            <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
          </div>
        </div>


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

    <!-- Scroll to Top Button (Masonry Mode) -->
    <Transition name="fade">
      <button
        v-if="showScrollToTop && isMasonryMode && !selectedPost"
        @click="scrollToTop"
        class="scroll-to-top-btn"
        title="Scroll to top"
      >
        <i class="lni lni-arrow-up"></i>
      </button>
    </Transition>
  </div>
</template>

<script>
import { ref, watch, computed, onMounted, onUnmounted, onUpdated } from "vue";
import { useRoute, useRouter } from "vue-router";
import SearchForm from "../components/SearchForm.vue";
import PostGallery from "../components/PostGallery.vue";
import ImageDetailModal from "../components/ImageDetailModal.vue";
import { useDanbooruApi } from "../composables/useDanbooruApi";
import { useRatingCounts } from "../composables/useRatingCounts";
import { useLayout } from "../composables/useLayout";
import DanbooruService from '../services/danbooru';

export default {
  name: "HomeView",
  components: {
    SearchForm,
    PostGallery,
    ImageDetailModal,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const inputQuery = ref(""); // Lo que escribe el usuario
    const appliedQuery = ref(""); // Lo que realmente se está buscando (applied)
    // Initialize limit from localStorage or default to 10
    const savedLimit = localStorage.getItem('postsPerPage');
    const limit = ref(savedLimit ? parseInt(savedLimit, 10) : 10);
    
    // Default to All ("") if nothing saved. If saved, use saved value.
    const savedRating = localStorage.getItem('ratingFilter');
    const ratingFilter = ref(savedRating !== null ? savedRating : "general"); 
    const { isSidebarVisible, toggleSidebar, setSidebarVisible } = useLayout();
    const infiniteScroll = ref(false);
    const selectedPost = ref(null);
    const isRandomMode = ref(false);
    const showTimeoutInfo = ref(false);
    const isLoadingNextPage = ref(false);
    const showScrollToTop = ref(false);

    // Persist rating filter selection
    // Persist and sync rating filter
    watch(ratingFilter, (newVal) => {
       localStorage.setItem('ratingFilter', newVal);
       
       // Update URL if the valve actually changed from the one in route
       if (newVal !== (route.query.rating || "")) {
         router.push({
           query: { ...route.query, rating: newVal || undefined, page: 1 }
         });
       }
    });

    // State for user preferences (to restore when exiting Masonry)
    const storedLimit = localStorage.getItem('postsPerPage');
    const userLimit = ref(storedLimit ? parseInt(storedLimit) : 20);
    
    // Masonry Mode Logic - Define EARLY to use in initial limit calculation
    const savedMasonry = localStorage.getItem('masonryMode');
    const isMasonryMode = ref(savedMasonry === 'true'); // Default false

    // Initialize limit: 75 if Masonry, else user preference
    // Initialize limit: 75 if Masonry, else user preference
    // We can't easily change the `limit` ref definition above since it's passed to useDanbooruApi, 
    // but we can update its value here immediately if needed, or better yet, manage the logic before passing it.
    // However, `useDanbooruApi` is called below. Valid point. 
    // Let's rely on the watcher update for now or manually set it.
    if (savedMasonry === 'true') {
        limit.value = 75;
    }

    // Persist posts per page limit ONLY if not in Masonry mode
    // Persist and sync posts per page limit
    watch(limit, (newVal) => {
       if (!isMasonryMode.value) {
           userLimit.value = newVal;
           localStorage.setItem('postsPerPage', newVal);
       }
       
       // Sync with URL if changed
       const currentUrlLimit = parseInt(route.query.limit) || 20;
       if (newVal !== currentUrlLimit && !isMasonryMode.value) {
           router.push({
             query: { ...route.query, limit: newVal, page: 1 }
           });
       }
    });

    // Flag to control scroll on update
    const shouldScrollToTop = ref(false);
    
    // Flag to prevent race condition between manual navigation and route watcher
    const isManualNavigation = ref(false);

    watch(isMasonryMode, async (newVal) => {
      localStorage.setItem('masonryMode', newVal);
      
      if (newVal) {
        // Entering Masonry Mode
        infiniteScroll.value = true; 
        if (limit.value < 75) {
            limit.value = 75;
        }
      } else {
        // Exiting Masonry Mode -> Restore User Preferences
        infiniteScroll.value = false; // Restore pagination
        limit.value = userLimit.value; // Restore user limit
      }
      
      // Mark that we should scroll after the update is complete
      shouldScrollToTop.value = true;
      await handleSearch();
    });

    // Handle scroll in onUpdated to ensure DOM is ready
    onUpdated(() => {
      if (shouldScrollToTop.value) {
        shouldScrollToTop.value = false;
        // Immediate/Auto scroll as requested
        window.scrollTo({ top: 0, behavior: 'auto' });
        
        // Redundancy for different browsers/containers
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    });

    // Initial setup for Masonry props
    if (isMasonryMode.value) {
      infiniteScroll.value = true;
      // limit already set above
    }
    
    // Track current page for traditional pagination
    const currentPageRef = computed(() => parseInt(route.query.page) || 1);
    
    // useDanbooruApi usa appliedQuery (el valor confirmado)
    const { posts, loading, error, currentPage, hasNextPage, searchPosts } =
      useDanbooruApi(appliedQuery, limit, ratingFilter, infiniteScroll, currentPageRef);

    const currentRangeFriendlyName = computed(() => {
      if (appliedQuery.value.includes('age:<1d')) return 'day';
      if (appliedQuery.value.includes('age:<1w')) return 'week';
      if (appliedQuery.value.includes('age:<1month') || appliedQuery.value.includes('age:<1m')) return 'month';
      if (appliedQuery.value.includes('age:<1y')) return 'year';
      return 'all time';
    });

    const activeExtraAction = computed(() => {
      if (appliedQuery.value.includes('status:deleted')) return 'deleted';
      if (appliedQuery.value.includes('order:score')) return 'most-liked';
      if (appliedQuery.value.includes('order:favcount')) return 'most-favorited';
      if (appliedQuery.value.includes('order:rank')) return 'hot';
      return null;
    });

    const parsedTags = computed(() => {
      // Usamos inputQuery o appliedQuery? Para visualizar lo que se busca: appliedQuery
      return appliedQuery.value
        .trim()
        .split(/[,，\s]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    });

    const currentPostIndex = computed(() => {
      if (!selectedPost.value) return -1;
      return posts.value.findIndex(p => p.id === selectedPost.value.id);
    });

    const canPrev = computed(() => {
        if (!selectedPost.value || isRandomMode.value) return false;
        // Puede ir atras si:
        // 1. Hay un post anterior en la lista actual (index > 0)
        // 2. O estamos en una pagina > 1 (puede cargar anterior pagina)
        return currentPostIndex.value > 0 || currentPage.value > 1;
    });

    const canNext = computed(() => {
         if (!selectedPost.value || isRandomMode.value) return false;
         // Puede ir adelante si:
         // 1. Hay un post siguiente en la lista actual
         // 2. O hay mas paginas disponibles
         return currentPostIndex.value < posts.value.length - 1 || hasNextPage.value;
    });

    const lastListPost = ref(null); // Track the post we opened from the list

    const openModal = (post) => {
      isRandomMode.value = false;
      selectedPost.value = post;
      lastListPost.value = post; // Save reference for navigation fallback
    };

    const navigatePost = async (direction) => {
      if (!selectedPost.value || isRandomMode.value) return;
      
      let index = posts.value.findIndex(p => p.id === selectedPost.value.id);
      
      // Fallback: If current post is not in list (e.g. navigated to child), use last known list post
      if (index === -1 && lastListPost.value) {
         index = posts.value.findIndex(p => p.id === lastListPost.value.id);
      }

      // If still not found, we can't navigate safely
      if (index === -1) return;
      
      const newIndex = index + direction;
      
      // Caso 1: Navegación dentro de la página actual
      if (newIndex >= 0 && newIndex < posts.value.length) {
        selectedPost.value = posts.value[newIndex];
        lastListPost.value = posts.value[newIndex]; // Update anchor
        return;
      }

      // Caso 2: Siguiente página (Infinite Next)
      if (newIndex >= posts.value.length) {
        if (hasNextPage.value && !loading.value) {
          isLoadingNextPage.value = true;
          const nextPage = currentPage.value + 1;
          try {
            if (isMasonryMode.value) {
              // Masonry Override: Append posts directly without triggering route change/reset
              await searchPosts(nextPage, false); // false = append
              
              // Select the first post of the new batch (which is at the previous length index)
              if (posts.value.length > index + 1) {
                const nextPost = posts.value[index + 1];
                selectedPost.value = nextPost;
                lastListPost.value = nextPost;
              }
            } else {
              // Pagination behavior: Replace page
              await handlePageChange(nextPage);
              if (posts.value.length > 0) {
                selectedPost.value = posts.value[0];
                lastListPost.value = posts.value[0];
              }
            }
          } finally {
            isLoadingNextPage.value = false;
          }
        }
        return;
      }

      // Caso 3: Página anterior (Infinite Prev)
      if (newIndex < 0) {
        if (currentPage.value > 1 && !loading.value) {
          isLoadingNextPage.value = true;
          const prevPage = currentPage.value - 1;
          try {
            await handlePageChange(prevPage);
            if (posts.value.length > 0) {
              selectedPost.value = posts.value[posts.value.length - 1];
            }
          } finally {
            isLoadingNextPage.value = false;
          }
        }
        return;
      }
    };

    // Acción explicita de buscar (Enter o Botón)
    const handleSearch = async (overrideQuery) => {
      // Si overrideQuery es string (viene de click en tag), úsalo. Si es evento o nulo, usa inputQuery.
      const finalQuery = (typeof overrideQuery === 'string') ? overrideQuery : inputQuery.value;

      // Validate tag count (max 2 tags for non-premium users)
      const tags = finalQuery
        .split(/[,，\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && !t.startsWith('rating:') && !t.startsWith('order:') && !t.startsWith('status:') && !t.startsWith('age:') && !t.startsWith('-'));
      
      if (tags.length > 2) {
        error.value = `You can only search up to 2 tags at a time. You entered ${tags.length} tags: ${tags.join(', ')}`;
        setTimeout(() => {
          error.value = null;
        }, 5000);
        return;
      }

      // Auto-close sidebar on mobile
      if (window.innerWidth <= 768) {
        setSidebarVisible(false);
      }

      isRandomMode.value = false;
      
      // Update URL with tags and rating. The watcher will handle the actual searchPosts call.
      await router.push({ 
        path: '/', 
        query: { 
          tags: finalQuery || undefined,
          rating: ratingFilter.value || undefined
        } 
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Integrate Rating Counts
    const { ratingCounts, fetchRatingCounts } = useRatingCounts();

    const loadPage = async (page) => {
      // searchPosts usa internamente appliedQuery, que no ha cambiado si solo escribimos en el input
      // Force new search (isNewSearch=true) to bypass cache and ensure fresh content
      await searchPosts(page, true);
    };

    const handlePageChange = async (page) => {
      if (loading.value) return;
      
      // Set flag to prevent race condition with route watcher
      isManualNavigation.value = true;
      
      try {
        // Update URL if needed
        const currentRoutePage = parseInt(route.query.page) || 1;
        if (currentRoutePage !== page) {
          await router.push({ 
            query: { 
              ...route.query, 
              page: page.toString() 
            } 
          });
        }
        
        // Wait for Vue Query to finish loading the new page
        // The query key change will trigger the fetch automatically
        await new Promise(resolve => {
          let unwatch;
          const stop = () => { if (unwatch) unwatch(); };
          
          unwatch = watch(loading, (isLoading) => {
            if (!isLoading) {
              stop();
              resolve();
            }
          }, { immediate: true });
          
          // If immediate callback fired (sync), unwatch wasn't ready then.
          // Stop it now if we are already done.
          if (!loading.value) {
            stop();
          }
        });
        
        if (!selectedPost.value) {
           window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } finally {
        // Reset flag after navigation is complete
        setTimeout(() => {
          isManualNavigation.value = false;
        }, 100);
      }
    };

    const handleLoadMore = async () => {
      if (loading.value || !hasNextPage.value) return;
      const nextPage = currentPage.value + 1;
      // Pass false to append posts instead of replacing
      await searchPosts(nextPage, false);
    };

    const setExample = (example) => {
      inputQuery.value = example;
      handleSearch(); // Esto hará commit del example a appliedQuery
    };

    const handleSearchError = (errorMessage) => {
      error.value = errorMessage;
      setTimeout(() => {
        error.value = null;
      }, 5000);
    };

    // Watch para cambios en ratingFilter o limit
    // Estos refrescan la búsqueda ACTUAL (appliedQuery), no lo que se esté escribiendo pendiente
    watch([ratingFilter, limit], () => {
      searchPosts(1, true);
      // Update URL to include new rating
      router.push({ 
        path: '/', 
        query: { 
          tags: appliedQuery.value || undefined,
          rating: ratingFilter.value || undefined
        } 
      });
    });

    // Keyboard navigation
    let lastKeyTime = 0;
    const handleKeydown = (e) => {
      // Throttle key events (max 1 every 150ms)
      const now = Date.now();
      if (now - lastKeyTime < 150) return;
      
      // Ignore if typing in an input or textarea
      const target = e.target;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      
      lastKeyTime = now;

      const key = e.key.toLowerCase();

      // Si el modal está abierto, usamos A/D para navegar imágenes
      if (selectedPost.value) {
        if (key === 'a' || key === 'arrowleft') {
          navigatePost(-1);
        } else if (key === 'd' || key === 'arrowright') {
          navigatePost(1);
        }
        return;
      }

      // Si el modal está cerrado, paginación normal
      if (key === 'a') {
        if (currentPage.value > 1) {
          handlePageChange(currentPage.value - 1);
        }
      } else if (key === 'd') {
        if (hasNextPage.value) {
          handlePageChange(currentPage.value + 1);
        }
      }
    };

    // Scroll handler for scroll-to-top button
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      showScrollToTop.value = window.scrollY > 300;
    };

    // Scroll to top function
    const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Cargar datos al montar el componente
    onMounted(() => {
      // Check for query params
      if (route.query.tags) {
        inputQuery.value = route.query.tags;
        appliedQuery.value = route.query.tags;
      }
      
      // Initialize rating from URL if present
      if (route.query.rating) {
        ratingFilter.value = route.query.rating;
      }
      
      // Execute parallel search and count fetch
      const normalizedQuery = appliedQuery.value
        .split(/[,，\s]+/)
        .filter(t => t.trim())
        .join(' ');

      // Initialize page from URL
      const initialPage = parseInt(route.query.page) || 1;

      // Execute initial count fetch (searchPosts will trigger automatically because appliedQuery initialized)
      fetchRatingCounts(normalizedQuery);
      
      // Update URL to include rating if not present
      if (!route.query.rating && ratingFilter.value) {
        router.replace({ 
          path: '/', 
          query: { 
            tags: route.query.tags || undefined,
            rating: ratingFilter.value,
            page: route.query.page || undefined
          } 
        });
      }
      
      window.addEventListener('keydown', handleKeydown);
      window.addEventListener('scroll', handleScroll);
    });

    // Unified watch for route query changes
    watch(() => route.query, (newQuery) => {
      const normalizedTags = newQuery.tags || "";
      const newRating = newQuery.rating || ""; // Default ""
      const newLimit = parseInt(newQuery.limit) || (isMasonryMode.value ? 75 : userLimit.value);
      
      // Update internal states to match URL
      if (appliedQuery.value !== normalizedTags) {
        inputQuery.value = normalizedTags;
        appliedQuery.value = normalizedTags;
        isRandomMode.value = false;
        
        // Fetch counts only when tags change
        const normalizedQueryForCounts = normalizedTags
          .split(/[,，\s]+/)
          .filter(t => t.trim())
          .join(' ');
        fetchRatingCounts(normalizedQueryForCounts);
      }
      
      if (ratingFilter.value !== newRating) {
        ratingFilter.value = newRating;
      }
      
      if (limit.value !== newLimit) {
        limit.value = newLimit;
      }
    }, { deep: true });

    // Watch for page changes in URL (e.g. Back Button)
    watch(() => route.query.page, (newPage) => {
      const p = parseInt(newPage) || 1;
      // Fetch only if we aren't already on this page AND not manually navigating
      if (p !== currentPage.value && !isManualNavigation.value) {
         handlePageChange(p);
      }
    });

    // Dynamic Title Logic
    watch(appliedQuery, (newVal) => {
      if (newVal) {
        // Format: "tag1 AND tag2 | Booru Explorer"
        const formattedTags = newVal.split(/[,，\s]+/).filter(t => t).join(' AND ');
        document.title = `${formattedTags} | Booru Explorer`;
      } else {
        document.title = 'Booru Explorer | Anime Image Board';
      }
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('scroll', handleScroll);
    });

    // Optimize background videos when modal is open


    const handleTagSearch = async (tag, clearFilter = false) => {
       isRandomMode.value = false;
       
       if (clearFilter) {
          ratingFilter.value = ""; // Reset to All
       }
       
       selectedPost.value = null; // Cerrar modal
       
       // Update URL first
       await router.push({ path: '/', query: { tags: tag } });
       
       // Scroll to top
       window.scrollTo({ top: 0, behavior: 'smooth' });

       // Auto-close sidebar on mobile
       if (window.innerWidth <= 768) {
         setSidebarVisible(false);
       }
    };

    const handleAction = async (action, timeRange) => {
      let ageFilter = '';
      if (timeRange && timeRange !== 'all') {
        const mapping = {
          day: 'age:<1d',
          week: 'age:<1w',
          month: 'age:<1month',
          year: 'age:<1y'
        };
        ageFilter = mapping[timeRange] || '';
      }

      if (action === 'deleted') {
        handleSearch(`status:deleted ${ageFilter}`.trim());
      } else if (action === 'most-liked') {
        handleSearch(`order:score ${ageFilter}`.trim());
      } else if (action === 'most-favorited') {
        handleSearch(`order:favcount ${ageFilter}`.trim());
      } else if (action === 'hot') {
        handleSearch(`order:rank ${ageFilter}`.trim()); // Hot is inherently time-based (trending)
      } else if (action === 'random') {
        isRandomMode.value = true;
        try {
          const post = await DanbooruService.getRandomPost();
          if (post) {
            selectedPost.value = post;
          }
        } catch (e) {
          console.error("Error fetching random post", e);
        }
      } else if (action === 'related') {
        console.log("Related action clicked - Placeholder");
      }

      // Auto-close sidebar on mobile after action
      if (window.innerWidth <= 768) {
        setSidebarVisible(false);
      }
    };

    return {
      inputQuery,
      appliedQuery,
      posts,
      loading,
      error,
      limit,
      ratingFilter,
      currentPage,
      hasNextPage,
      parsedTags,
      infiniteScroll,
      handleSearch,
      handleTagSearch,
      handlePageChange,
      loadPage,
      setExample,
      handleSearchError,
      selectedPost,
      isMasonryMode,
      handleLoadMore,
      openModal,
      navigatePost,
      canPrev,
      canNext,
      handleAction,
      showTimeoutInfo,
      ratingCounts,
      isSidebarVisible,
      toggleSidebar,
      showScrollToTop,
      scrollToTop,
      currentRangeFriendlyName,
      activeExtraAction
    };
  },
};
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
    border: 1px solid rgba(59, 130, 246, .3);
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
  background: rgba(236, 72, 153, 0.15); /* Pinkish */
  border-color: rgba(236, 72, 153, 0.3);
  color: #fbcfe8;
}

.info-banner.favs-mode {
  background: rgba(251, 191, 36, 0.15); /* Amber/Gold */
  border-color: rgba(251, 191, 36, 0.3);
  color: #fde68a;
}

.info-banner.trending-mode {
  background: rgba(249, 115, 22, 0.15); /* Orange */
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


.info-banner {
    display: flex;
    align-items: center;
    gap: 12px;
}

.info-help-btn {
    margin-left: 0;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: inherit;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

.info-help-btn:hover {
    background: rgba(255, 255, 255, 0.2);
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

.timeout-explanation strong {
    color: #fff;
    display: block;
    margin-bottom: 8px;
}

.danbooru-info-box {
    background: rgba(0, 0, 0, 0.2);
    border-left: 3px solid #64748b;
    padding: 8px 12px;
    margin: 12px 0;
    font-style: italic;
}

.expand-enter-active, .expand-leave-active {
    transition: all 0.3s ease;
    max-height: 300px;
    overflow: hidden;
}

.expand-enter-from, .expand-leave-to {
    max-height: 0;
    opacity: 0;
    margin-bottom: 0;
    padding-top: 0;
    padding-bottom: 0;
}

/* Mobile Responsiveness Styles */
.mobile-menu-trigger {
  display: none; /* Hidden on desktop */
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .mobile-menu-trigger {
    display: flex;
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #a78bfa;
    color: white;
    border: none;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 4px 15px rgba(167, 139, 250, 0.4);
    z-index: 900;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .mobile-menu-trigger:active {
    transform: scale(0.9);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 998; /* Below sidebar (1000), above content */
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
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  overflow-wrap: anywhere; /* Ensure long tags break */
  word-break: break-word;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

/* Slide fade transition */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@media (max-width: 768px) {
  .search-title {
    font-size: 16px;
    gap: 6px;
  }
  
  .search-title-container {
    margin-bottom: 16px;
    padding: 10px 12px; /* Reduced side padding */
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(167, 139, 250, 0.1);
}

.scroll-to-top-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.4);
  color: #c084fc;
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4),
              0 0 20px rgba(167, 139, 250, 0.2);
}

.scroll-to-top-btn:active {
  transform: translateY(-2px);
  background: rgba(167, 139, 250, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3),
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

</style>
