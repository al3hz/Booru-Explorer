<template>
  <div class="pools-view">
    <div class="pools-container">
      <!-- Header Section -->
      <div class="pools-header">
        <div class="header-top">
          <h1 class="page-title">
            <i class="lni lni-layers"></i>
            Pools
          </h1>
          <p class="page-description">Browse organized collections of posts, comics, and doujinshi</p>
        </div>

        <!-- Search and Filters -->
        <div class="pools-controls">
          <div class="search-wrapper">
            <input
              type="text"
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              placeholder="Search pools..."
              class="pool-search-input"
            />
            <button class="search-btn" @click="handleSearch" :disabled="loading">
              <i class="lni lni-search-alt"></i>
            </button>
          </div>

          <div class="category-filters">
            <button
              v-for="cat in categories"
              :key="cat.value"
              @click="selectCategory(cat.value)"
              class="category-btn"
              :class="{ active: selectedCategory === cat.value }"
            >
              <i :class="cat.icon"></i>
              <span>{{ cat.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && pools.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Loading pools...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <i class="lni lni-warning"></i>
        <p>{{ error }}</p>
        <button @click="fetchPools(1, searchQuery, selectedCategory)" class="retry-btn">
          Retry
        </button>
      </div>

      <!-- Pools Grid -->
      <div v-else-if="pools.length > 0" class="pools-grid">
        <router-link
          v-for="pool in pools"
          :key="pool.id"
          :to="`/pools/${pool.id}`"
          class="pool-card"
        >
          <!-- Pool Cover (first post thumbnail) -->
          <div class="pool-cover">
            <!-- Animated Video Cover -->
            <SmartVideo
              v-if="pool.coverUrl && isAnimatedCover(pool)"
              :src="pool.coverUrl"
              :alt="pool.name"
              className="cover-image"
            />

            <!-- Static Image Cover -->
            <img
              v-else-if="pool.coverUrl"
              :src="pool.coverUrl"
              :alt="pool.name"
              class="cover-image"
              loading="lazy"
            />

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
        </router-link>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <i class="lni lni-inbox"></i>
        <p>No pools found</p>
        <p class="empty-hint">Try a different search or category</p>
      </div>

      <!-- Pagination -->
      <div v-if="pools.length > 0" class="pagination">
        <button
          @click="handlePageChange(currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          class="page-btn"
        >
          <i class="lni lni-chevron-left"></i>
          Previous
        </button>
        
        <span class="page-info">Page {{ currentPage }}</span>
        
        <button
          @click="handlePageChange(currentPage + 1)"
          :disabled="!hasNextPage || loading"
          class="page-btn"
        >
          Next
          <i class="lni lni-chevron-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePools } from '../composables/usePools';
import { useDText } from '../composables/useDText';
import SmartVideo from '../components/SmartVideo.vue';

export default {
  name: 'PoolsView',
  components: {
    SmartVideo
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { pools, loading, error, currentPage, hasNextPage, fetchPools } = usePools();
    const { parseDText } = useDText();
    
    const searchQuery = ref('');
    const selectedCategory = ref('');
    
    const categories = [
      { value: '', label: 'All', icon: 'lni lni-grid-alt' },
      { value: 'series', label: 'Series', icon: 'lni lni-bookmark' },
      { value: 'collection', label: 'Collection', icon: 'lni lni-folder' }
    ];

    const handleSearch = () => {
      fetchPools(1, searchQuery.value, selectedCategory.value);
      updateURL();
    };

    const selectCategory = (category) => {
      selectedCategory.value = category;
      fetchPools(1, searchQuery.value, category);
      updateURL();
    };

    const handlePageChange = (page) => {
      if (page < 1 || loading.value) return;
      fetchPools(page, searchQuery.value, selectedCategory.value);
      updateURL();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const updateURL = () => {
      router.push({
        path: '/pools',
        query: {
          q: searchQuery.value || undefined,
          category: selectedCategory.value || undefined,
          page: currentPage.value > 1 ? currentPage.value : undefined
        }
      });
    };

    const formatCategory = (cat) => {
      if (!cat) return 'Unknown';
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatPoolName = (name) => {
      if (!name) return '';
      // Replace underscores with spaces
      return name.replace(/_/g, ' ');
    };

    const handleDescriptionClick = (e) => {
      const target = e.target;
      
      // Handle wiki links
      if (target.classList.contains('wiki-link')) {
        e.preventDefault();
        const wikiPage = target.dataset.link;
        if (wikiPage) {
          router.push({ name: 'wiki', params: { query: wikiPage } });
        }
      }
      
      // Handle pool links
      if (target.classList.contains('pool-link')) {
        e.preventDefault();
        const poolId = target.dataset.poolId;
        if (poolId) {
          router.push({ name: 'pool-detail', params: { id: poolId } });
        }
      }
    };

    const isAnimatedCover = (pool) => {
      if (!pool.coverUrl) return false;
      // Check if the cover URL ends with video extensions
      return pool.coverUrl.match(/\.(mp4|webm)$/i);
    };

    onMounted(() => {
      // Parse URL params
      if (route.query.q) {
        searchQuery.value = route.query.q;
      }
      if (route.query.category) {
        selectedCategory.value = route.query.category;
      }
      const page = parseInt(route.query.page) || 1;
      
      // Fetch pools
      fetchPools(page, searchQuery.value, selectedCategory.value);
    });

    return {
      pools,
      loading,
      error,
      currentPage,
      hasNextPage,
      searchQuery,
      selectedCategory,
      categories,
      handleSearch,
      selectCategory,
      handlePageChange,
      formatCategory,
      formatDate,
      formatPoolName,
      parseDText,
      handleDescriptionClick,
      isAnimatedCover,
      fetchPools
    };
  }
};
</script>

<style scoped>
.pools-view {
  min-height: 100vh;
  padding: 20px;
}

.pools-container {
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.pools-header {
  margin-bottom: 32px;
}

.header-top {
  margin-bottom: 24px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(90deg, #fff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-title i {
  font-size: 28px;
  color: #a78bfa;
  -webkit-text-fill-color: initial;
}

.page-description {
  color: #94a3b8;
  font-size: 15px;
  margin: 0;
}

/* Controls */
.pools-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-wrapper {
  position: relative;
  max-width: 500px;
}

.pool-search-input {
  width: 100%;
  padding: 14px 50px 14px 16px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
}

.pool-search-input:focus {
  outline: none;
  border-color: #a78bfa;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.1);
}

.search-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.search-btn:hover {
  background: rgba(167, 139, 250, 0.2);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Category Filters */
.category-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.category-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(167, 139, 250, 0.2);
  color: #fff;
}

.category-btn.active {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #fff;
}

.category-btn i {
  font-size: 16px;
  color: #a78bfa;
}

/* Pools Grid */
.pools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.pool-card {
  background: rgba(20, 20, 28, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.pool-card:hover {
  transform: translateY(-4px);
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.pool-cover {
  position: relative;
  width: 100%;
  height: 180px;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(192, 132, 252, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.pool-card:hover .cover-image {
  transform: scale(1.05);
}

.pool-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 12px;
  gap: 8px;
}

.post-count {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.pool-category {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 6px;
  width: fit-content;
}

.category-series {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.category-collection {
  background: rgba(236, 72, 153, 0.2);
  border: 1px solid rgba(236, 72, 153, 0.3);
  color: #fbcfe8;
}

.pool-info {
  padding: 16px;
}

.pool-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #fff;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: break-word;
}

.pool-description {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 12px 0;
  line-height: 1.5;
  max-height: 80px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* DText formatting in descriptions */
.pool-description :deep(.wiki-link),
.pool-description :deep(.pool-link) {
  color: #a78bfa;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.pool-description :deep(.wiki-link):hover,
.pool-description :deep(.pool-link):hover {
  color: #c084fc;
}

.pool-description :deep(b),
.pool-description :deep(strong) {
  font-weight: 600;
  color: #e2e8f0;
}

.pool-description :deep(h5),
.pool-description :deep(h6) {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
  margin: 8px 0 4px 0;
}

.pool-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.meta-item i {
  font-size: 14px;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state i,
.empty-state i {
  font-size: 48px;
  color: #64748b;
  margin-bottom: 16px;
}

.retry-btn {
  margin-top: 16px;
  padding: 10px 20px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  color: #a78bfa;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(167, 139, 250, 0.2);
}

.empty-hint {
  font-size: 13px;
  margin-top: 8px;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.2);
  color: #fff;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .pools-view {
    padding: 12px;
  }

  .page-title {
    font-size: 24px;
  }

  .pools-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .category-filters {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 8px;
  }

  .category-btn {
    white-space: nowrap;
  }
}
</style>
