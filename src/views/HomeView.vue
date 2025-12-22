<template>
  <div class="home-view">
    <div class="app-layout">
      <!-- Mobile Toggle Button -->
      <button 
        class="mobile-menu-trigger" 
        @click="sidebarVisible = !sidebarVisible"
        v-if="!sidebarVisible"
        title="Abrir menú"
      >
        ☰
      </button>

      <!-- Mobile Sidebar Backdrop -->
      <div 
        class="sidebar-backdrop" 
        v-if="sidebarVisible"
        @click="sidebarVisible = false"
      ></div>

      <SearchForm
        :search-query="inputQuery"
        :loading="loading"
        :limit="limit"
        :rating-filter="ratingFilter"
        :posts="posts"
        :sidebar-visible="sidebarVisible"
        :infinite-scroll="infiniteScroll"
        @update:search-query="inputQuery = $event"
        @update:limit="limit = $event"
        @update:rating-filter="ratingFilter = $event"
        @update:infinite-scroll="infiniteScroll = $event"
        @search="handleSearch"
        @example-clicked="setExample"
        @toggle-sidebar="sidebarVisible = !sidebarVisible"
        @trigger-action="handleAction"
        @search-error="handleSearchError"
      />

      <main class="main-content" :class="{ 'sidebar-open': sidebarVisible }">
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
        
        <div v-if="appliedQuery === 'status:deleted' || appliedQuery.includes('status:deleted age:<1month')" class="info-banner deleted-mode">
          <span class="icon">🗑️</span>
          <span>Showing deleted posts of the month</span>
          <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
        </div>

        <div v-if="appliedQuery === 'order:score' || appliedQuery.includes('order:score age:<1month')" class="likes-mode-container">
          <div class="info-banner likes-mode">
            <span class="icon">❤️</span>
            <span>Showing top posts of the month</span>
            <button class="info-help-btn" @click="showTimeoutInfo = !showTimeoutInfo" title="Why only a month?">
              {{ showTimeoutInfo ? 'Hide info' : 'Why a month?' }}
            </button>
            <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
          </div>
          <Transition name="expand">
            <div v-if="showTimeoutInfo" class="timeout-explanation">
              <strong>Search Timeout Explanation</strong>
              <p>Some kinds of searches are slower than others on Danbooru. Global rankings (like <code>order:score</code>) are extremely heavy and usually time out.</p>
              <div class="danbooru-info-box">
                <p><strong>Danbooru says:</strong> Usually this happens when your search is too complex, or when there aren't many recent posts matching your search.</p>
                <p>To ensure stability, we automatically apply <code>age:&lt;1month</code>.</p>
              </div>
              <p><strong>Tips:</strong></p>
              <ul>
                <li><code>order:score age:&lt;1week</code> (Best of the week)</li>
                <li><code>tag_name order:score</code> (Best of a specific tag)</li>
              </ul>
            </div>
          </Transition>
        </div>

        <div v-if="appliedQuery === 'order:favcount' || appliedQuery.includes('order:favcount age:<1month')" class="favs-mode-container">
          <div class="info-banner favs-mode">
            <span class="icon">⭐</span>
            <span>Showing most favorited of the month</span>
            <button class="info-help-btn" @click="showTimeoutInfo = !showTimeoutInfo" title="Why only a month?">
              {{ showTimeoutInfo ? 'Hide info' : 'Why a month?' }}
            </button>
            <button class="clear-mode-btn" @click="handleSearch('')" title="Clear filter">✕</button>
          </div>
          <Transition name="expand">
            <div v-if="showTimeoutInfo" class="timeout-explanation">
               <div class="danbooru-info-box">
                <p><strong>Danbooru says:</strong> Usually this happens when your search is too complex, or when there aren't many recent posts matching your search.</p>
                <p>To ensure stability, we automatically apply <code>age:&lt;1month</code>.</p>
              </div>
              <p><strong>Tips:</strong></p>
              <ul>
                <li><code>order:score age:&lt;1week</code> (Best of the week)</li>
                <li><code>tag_name order:score</code> (Best of a specific tag)</li>
              </ul>
            </div>
          </Transition>
        </div>

        <div v-if="appliedQuery === 'order:rank'" class="trending-mode-container">
          <div class="info-banner trending-mode">
            <span class="icon">🔥</span>
            <span>Showing trending posts of the day</span>
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
          @change-page="handlePageChange"
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
      />
    </Transition>
  </div>
</template>

<script>
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import SearchForm from "../components/SearchForm.vue";
import PostGallery from "../components/PostGallery.vue";
import ImageDetailModal from "../components/ImageDetailModal.vue";
import { useDanbooruApi } from "../composables/useDanbooruApi";
import { useRatingCounts } from "../composables/useRatingCounts";

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
    const sidebarVisible = ref(window.innerWidth > 768);
    const infiniteScroll = ref(false);
    const selectedPost = ref(null);
    const isRandomMode = ref(false);
    const showTimeoutInfo = ref(false);

    // Persist rating filter selection
    watch(ratingFilter, (newVal) => {
       localStorage.setItem('ratingFilter', newVal);
    });

    // Persist posts per page limit
    watch(limit, (newVal) => {
       localStorage.setItem('postsPerPage', newVal);
    });
    
    // useDanbooruApi usa appliedQuery (el valor confirmado)
    const { posts, loading, error, currentPage, hasNextPage, searchPosts } =
      useDanbooruApi(appliedQuery, limit, ratingFilter);

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
          const nextPage = currentPage.value + 1;
          await handlePageChange(nextPage);
          if (posts.value.length > 0) {
            selectedPost.value = posts.value[0];
          }
        }
        return;
      }

      // Caso 3: Página anterior (Infinite Prev)
      if (newIndex < 0) {
        if (currentPage.value > 1 && !loading.value) {
          const prevPage = currentPage.value - 1;
          await handlePageChange(prevPage);
          if (posts.value.length > 0) {
            selectedPost.value = posts.value[posts.value.length - 1];
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
        sidebarVisible.value = false;
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
    const { ratingCounts, loadingCounts, fetchRatingCounts } = useRatingCounts();

    const loadPage = async (page) => {
      // searchPosts usa internamente appliedQuery, que no ha cambiado si solo escribimos en el input
      await searchPosts(page, true);
    };

    const handlePageChange = async (page) => {
      if (loading.value) return; 
      await loadPage(page);
      if (!selectedPost.value) {
         window.scrollTo({ top: 0, behavior: "smooth" });
      }
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
      currentPage.value = 1;
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
    const handleKeydown = (e) => {
      // Ignore if typing in an input or textarea
      const target = e.target;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

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

      Promise.all([
        searchPosts(1, true),
        fetchRatingCounts(normalizedQuery)
      ]);
      
      // Update URL to include rating if not present
      if (!route.query.rating && ratingFilter.value) {
        router.replace({ 
          path: '/', 
          query: { 
            tags: route.query.tags || undefined,
            rating: ratingFilter.value
          } 
        });
      }
      
      window.addEventListener('keydown', handleKeydown);
    });

    // Watch for route query changes (navigation from other views or same view)
    watch(() => route.query.tags, (newTags) => {
      // Update internal states to match URL
      const normalizedTags = newTags || "";
      
      // Validate tag count (max 2 tags for non-premium users)
      const tags = normalizedTags
        .split(/[,，\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && !t.startsWith('rating:') && !t.startsWith('order:') && !t.startsWith('order:') && !t.startsWith('status:') && !t.startsWith('age:') && !t.startsWith('-'));
      
      if (tags.length > 2) {
        error.value = `You can only search up to 2 tags at a time. You entered ${tags.length} tags: ${tags.join(', ')}`;
        setTimeout(() => {
          error.value = null;
        }, 5000);
        // Reset to previous valid query
        inputQuery.value = appliedQuery.value;
        return;
      }
      
      inputQuery.value = normalizedTags;
      appliedQuery.value = normalizedTags;
      isRandomMode.value = false;
      currentPage.value = 1;
      
      // Execute fresh parallel search and count fetch
      const normalizedQueryForCounts = normalizedTags
        .split(/[,，\s]+/)
        .filter(t => t.trim())
        .join(' ');
      
      Promise.all([
        searchPosts(1, true),
        fetchRatingCounts(normalizedQueryForCounts)
      ]);
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
    });

    // Optimize background videos when modal is open
    watch(selectedPost, (newPost) => {
      // PostGallery uses .art-card video
      const videos = document.querySelectorAll('.post-gallery video');
      videos.forEach(video => {
        if (newPost) {
          video.pause();
        } else {
          try {
            video.play();
          } catch (e) {
            // Ignore auto-play errors
          }
        }
      });
    });

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
    };

    const handleAction = async (action) => {
      if (action === 'deleted') {
        handleSearch('status:deleted');
      } else if (action === 'most-liked') {
        handleSearch('order:score');
      } else if (action === 'most-favorited') {
        handleSearch('order:favcount');
      } else if (action === 'hot') {
        handleSearch('order:rank');
      } else if (action === 'random') {
        isRandomMode.value = true;
        try {
          // Usamos el endpoint dedicado /posts/random.json que es más rápido y no failea por timeout
          const res = await fetch(`https://danbooru.donmai.us/posts/random.json`);
          if (res.ok) {
            const data = await res.json();
            // Este endpoint devuelve un solo objeto, no un array
            if (data && data.id) {
              selectedPost.value = data;
            }
          }
        } catch (e) {
          console.error("Error fetching random post", e);
        }
      } else if (action === 'related') {
        console.log("Related action clicked - Placeholder");
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
      sidebarVisible,
      infiniteScroll,
      handleSearch,
      handleTagSearch,
      handlePageChange,
      loadPage,
      setExample,
      handleSearchError,
      selectedPost,
      openModal,
      navigatePost,
      openModal,
      navigatePost,
      canPrev,
      canNext,
      handleAction,
      showTimeoutInfo,
      ratingCounts
    };
  },
};
</script>

<style scoped>


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
    gap: 12px;
    font-size: 14px;
    font-weight: 500;
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
  margin-left: auto;
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
    padding: 10px 16px;
  }
}


</style>
