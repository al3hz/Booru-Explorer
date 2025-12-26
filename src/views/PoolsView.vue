<template>
  <div class="pools-view-layout">
    <PoolsSidebar 
      :filters="filters" 
      :loading="loading"
      @update:filters="filters = $event"
      @search="handleSearch"
    />
    
    <div class="pools-main-content" :class="{ 'with-sidebar': filtersVisible }">
      <div class="pools-container">


        <!-- Loading State -->
        <div v-if="loading && pools.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>Loading pools...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <i class="lni lni-warning"></i>
          <p>{{ error }}</p>
          <button @click="handleSearch" class="retry-btn">
            Retry
          </button>
        </div>

        <!-- Pools Grid -->
        <div v-else-if="pools.length > 0">
          <!-- Results Header -->
          <div class="results-header">
            <div class="results-divider is-left"></div>
            <div class="results-info">
              <i class="lni lni-layers"></i>
              <h2 class="results-title">Collections</h2>
            </div>
            <div class="results-divider is-right"></div>
          </div>

          <div class="pools-grid">
            <div
              v-for="pool in pools"
              :key="pool.id"
              @click="handleCardClick(pool.id)"
              class="pool-card cursor-pointer"
              role="button"
              tabindex="0"
              @keydown.enter="handleCardClick(pool.id)"
            >
              <!-- Pool Cover -->
              <div class="pool-cover">
                <div class="cover-image-container">
                  <SmartVideo
                    v-if="pool.coverUrl && isAnimatedCover(pool)"
                    :src="pool.coverUrl"
                    :alt="pool.name"
                    className="cover-image"
                  />
                  <img
                    v-else-if="pool.coverUrl"
                    :src="pool.coverUrl"
                    :alt="pool.name"
                    class="cover-image"
                    loading="lazy"
                  />
                </div>

                <div class="pool-overlay">
                  <span class="post-count">
                    <i class="lni lni-gallery"></i>
                    {{ pool.post_count }} posts
                  </span>
                  <span class="pool-category" :class="`category-${pool.category}`">
                    {{ formatCategory(pool.category) }}
                  </span>
                </div>
              </div>

              <!-- Pool Info -->
              <div class="pool-info">
                <h3 class="pool-name">{{ formatPoolName(pool.name) }}</h3>
                <!-- Description: prevent card click when clicking links inside -->
                <div
                  v-if="pool.description"
                  class="pool-description"
                  v-html="parseDText(pool.description)"
                  @click="handleDescriptionClick"
                ></div>
                <div class="pool-meta">
                  <span class="meta-item">
                    <i class="lni lni-calendar"></i>
                    {{ formatDate(pool.updated_at) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="pagination">
            <button
              @click="handlePageChange(currentPage - 1)"
              :disabled="currentPage === 1 || loading"
              class="page-btn"
            >
              <i class="lni lni-chevron-left"></i>
            </button>

            <span class="page-info">Page {{ currentPage }}</span>

            <button
              @click="handlePageChange(currentPage + 1)"
              :disabled="!hasNextPage || loading"
              class="page-btn"
            >
              <i class="lni lni-chevron-right"></i>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!loading && pools.length === 0" class="empty-state">
          <i class="lni lni-inbox"></i>
          <p>No pools found</p>
          <p class="empty-hint">Try a different search or category</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePools } from '../composables/usePools';
import { useDText } from '../composables/useDText';
import { usePoolFilters } from '../composables/usePoolFilters';
import SmartVideo from '../components/SmartVideo.vue';
import PoolsSidebar from '../components/PoolsSidebar.vue';

export default {
  name: 'PoolsView',
  components: {
    SmartVideo,
    PoolsSidebar
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { pools, loading, error, currentPage, hasNextPage, fetchPools } = usePools();
    const { parseDText } = useDText();
    // Shared filters visibility state
    const { filtersVisible } = usePoolFilters();
    
    const filters = ref({
      name: '',
      description: '',
      category: '',
      order: 'updated_at'
    });

    // Watch for URL changes AND initial load to handle browser navigation and sync state
    watch(() => route.query, (newQuery) => {
      const page = parseInt(newQuery.page) || 1;
      
      // Update filters from URL
      if (newQuery['search[name_matches]']) {
        filters.value.name = newQuery['search[name_matches]'].replace(/^\*/, '').replace(/\*$/, '');
      } else {
         filters.value.name = ''; // Reset if not in URL
      }

      if (newQuery['search[description_matches]']) {
        filters.value.description = newQuery['search[description_matches]'];
      } else {
        filters.value.description = '';
      }

      if (newQuery['search[category]']) {
        filters.value.category = newQuery['search[category]'];
      } else {
        filters.value.category = '';
      }

      if (newQuery['search[order]']) {
        filters.value.order = newQuery['search[order]'];
      } else {
        filters.value.order = 'updated_at';
      }

      // Always update state and fetch
      currentPage.value = page;
      fetchPools(page, filters.value);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, { immediate: true });

    const handleKeydown = (e) => {
       // Ignore if user is typing in input
       if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

       if (e.key === 'a' || e.key === 'A') {
         if (currentPage.value > 1 && !loading.value) {
           handlePageChange(currentPage.value - 1);
         }
       } else if (e.key === 'd' || e.key === 'D') {
         if (hasNextPage.value && !loading.value) {
           handlePageChange(currentPage.value + 1);
         }
       }
    };

    onMounted(() => {
       window.addEventListener('keydown', handleKeydown);
    });

    onUnmounted(() => {
       window.removeEventListener('keydown', handleKeydown);
    });

    const handleSearch = () => {
      // Search just updates URL (resetting to page 1)
      const query = { ...route.query, page: 1 };
      updateURL(query);
    };

    const handlePageChange = (page) => {
      if (page < 1 || (page > currentPage.value && !hasNextPage.value)) return;
      // Just update URL, let watcher handle fetch
      const query = { ...route.query, page };
      router.push({ query });
    };

    const updateURL = (queryOverride = null) => {
      const query = queryOverride || { page: currentPage.value };
      
      if (filters.value.name) {
        query['search[name_matches]'] = `*${filters.value.name}*`;
      }
      
      if (filters.value.description) {
        query['search[description_matches]'] = filters.value.description;
      }
      
      if (filters.value.category) {
        query['search[category]'] = filters.value.category;
      }
      
      if (filters.value.order !== 'updated_at') {
        query['search[order]'] = filters.value.order;
      }
      
      router.push({ query });
    };

    /* Helper Functions */
    const isAnimatedCover = (pool) => {
      // Check if the cover post is a video or gif based on file ext or tags if available
      // Since we only have the url here, we rely on extensions
      if (!pool.coverUrl) return false;
      return pool.coverUrl.match(/\.(mp4|webm|gif)$/i);
    };

    const formatCategory = (cat) => {
      if (!cat) return '';
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    };

    const formatPoolName = (name) => {
      return name.replace(/_/g, ' ');
    };

    const formatDate = (dateStr) => {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const handleDescriptionClick = (e) => {
      // If user clicks an internal link, stop propagation to prevent card navigation
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        e.stopPropagation();
        return;
      }
      // Otherwise let it bubble to card click handler
    };

    return {
      pools,
      loading,
      error,
      currentPage,
      hasNextPage,
      filters,
      filtersVisible,
      handleSearch,
      handlePageChange,
      parseDText,
      fetchPools,
      formatCategory,
      formatPoolName,
      formatDate,
      isAnimatedCover,
      isAnimatedCover,
      handleDescriptionClick,
      handleCardClick: (id) => router.push(`/pools/${id}`)
    };
  }
};
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pools-view-layout {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 10px 20px 20px 0; /* No left padding on container */
  gap: 0; /* Gap removed to prevent space when sidebar closed */
}

.pools-main-content {
  flex: 1;
  min-width: 0; /* Standard flexbox text overflow fix */
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}



.pools-container {
  width: 100%;
  max-width: 100%;
}

/* Header */
.pools-header {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  justify-content: center;
  align-items: center;
}

.header-title-section {
  text-align: center;
}

.page-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
  background: linear-gradient(90deg, #fff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-title i {
  font-size: 22px;
  color: #a78bfa;
  -webkit-text-fill-color: initial;
}

.page-description {
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
}


/* Results Header */
.results-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  margin-top: 20px;
}

.results-info {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.results-info i {
  color: #a78bfa;
  font-size: 20px;
}

.results-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.results-divider {
  height: 1px;
  flex-grow: 1;
}

.results-divider.is-right {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), transparent);
}

.results-divider.is-left {
  background: linear-gradient(-90deg, rgba(255, 255, 255, 0.1), transparent);
}

/* Pools Grid - More columns on large screens */
.pools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.pool-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  background: rgba(20, 20, 28, 0.6);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  animation: fadeIn 0.3s ease-in backwards;
  transform: translateZ(0); /* Ya está presente */
  /* Añade isolation para crear un nuevo stacking context */
  isolation: isolate;
}

/* Pseudo-element border to mask sub-pixel gaps */
.pool-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
  z-index: 5;
  transition: border-color 0.3s;
}

.pool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.pool-card:hover::after {
  border-color: rgba(167, 139, 250, 0.3);
}

.pool-cover {
  position: relative;
  width: 100%;
  height: 240px;
  background: #0f172a;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
  /* Solución definitiva: crear un contenedor interno para la imagen */
  isolation: isolate;
}

.cover-image-container {
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
}

.cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  /* Extender ligeramente para cubrir completamente */
  transform: scale(1.01); /* Pequeño scale inicial */
}

.pool-card:hover .cover-image {
  transform: scale(1.06); /* Un poco más para compensar */
}


.pool-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 12px;
  background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.post-count {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pool-category {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.category-series {
  background: rgba(59, 130, 246, 0.6);
}

.category-collection {
  background: rgba(168, 85, 247, 0.6);
}

.pool-info {
  padding: 16px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.pool-name {
  font-size: 16px; 
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px 0;
  line-height: 1.4;
  /* Limit to 2 lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Fix CSS warning workaround */
.pool-name {
  line-clamp: 2;
}

.pool-description {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 12px;
  line-height: 1.5;
  /* Limit to 3 lines */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex-grow: 1;
}

/* Styles for simple DText in preview */
.pool-description :deep(b) { font-weight: 700; color: #cbd5e1; }
.pool-description :deep(i) { font-style: italic; }

.pool-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 12px;
  margin-top: auto;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

/* Loading & States */
.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 80px 20px;
  background: rgba(20, 20, 25, 0.4);
  border-radius: 20px;
  color: #e2e8f0;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  width: 100%;
  box-sizing: border-box; /* Ensure padding doesn't affect width */
}

.loading-state .spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(167, 139, 250, 0.2);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.empty-state i,
.error-state i {
  font-size: 48px;
  color: #64748b;
  margin-bottom: 16px;
  display: block;
}

.error-state p {
  color: #fca5a5;
  margin-bottom: 16px;
}

.retry-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.page-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  color: #fff;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  transform: translateY(-2px);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
}

/* Responsive */
@media (max-width: 768px) {
  .pools-view-layout {
    flex-direction: column;
    padding: 0; /* Remove layout padding on mobile */
  }

  .pools-main-content {
    width: 100%;
    padding: 10px 16px; /* Balanced padding for mobile */
  }
  
  .pools-grid {
    grid-template-columns: 1fr; /* Single column on mobile */
  }
}
</style>
