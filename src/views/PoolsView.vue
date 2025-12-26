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
          <!-- Text Filters Row -->
          <div class="filter-text-row">
            <!-- Name Search -->
            <div class="filter-field">
              <label class="filter-label">Name</label>
              <input
                type="text"
                v-model="filters.name"
                @keyup.enter="handleSearch"
                placeholder="Search by pool name..."
                class="filter-input"
              />
            </div>

            <!-- Description Search -->
            <div class="filter-field">
              <label class="filter-label">Description</label>
              <input
                type="text"
                v-model="filters.description"
                @keyup.enter="handleSearch"
                placeholder="Search in description..."
                class="filter-input"
              />
            </div>

          </div>

          <!-- Dropdown Filters Row -->
          <div class="filter-dropdown-row">
            <!-- Category -->
            <div class="filter-col">
              <label class="filter-label">Category</label>
              <div class="custom-select" :class="{ 'is-open': categoryDropdownOpen }">
                <button class="select-trigger" @click.stop="toggleCategoryDropdown">
                  <span class="selected-value">{{ getCategoryLabel(filters.category) }}</span>
                  <span class="chevron">▼</span>
                </button>
                
                <transition name="dropdown-fade">
                  <ul v-if="categoryDropdownOpen" class="custom-options">
                    <li 
                      v-for="opt in categoryOptions" 
                      :key="opt.value"
                      class="custom-option"
                      :class="{ 'selected': filters.category === opt.value }"
                      @click="selectCategory(opt.value)"
                    >
                      <span class="option-label">{{ opt.label }}</span>
                      <span v-if="filters.category === opt.value" class="check">✓</span>
                    </li>
                  </ul>
                </transition>
              </div>
            </div>



            <!-- Order -->
            <div class="filter-col">
              <label class="filter-label">Order</label>
              <div class="custom-select" :class="{ 'is-open': orderDropdownOpen }">
                <button class="select-trigger" @click.stop="toggleOrderDropdown">
                  <span class="selected-value">{{ getOrderLabel(filters.order) }}</span>
                  <span class="chevron">▼</span>
                </button>
                
                <transition name="dropdown-fade">
                  <ul v-if="orderDropdownOpen" class="custom-options">
                    <li 
                      v-for="opt in orderOptions" 
                      :key="opt.value"
                      class="custom-option"
                      :class="{ 'selected': filters.order === opt.value }"
                      @click="selectOrder(opt.value)"
                    >
                      <span class="option-label">{{ opt.label }}</span>
                      <span v-if="filters.order === opt.value" class="check">✓</span>
                    </li>
                  </ul>
                </transition>
              </div>
            </div>
          </div>

          <!-- Search Button -->
          <button class="search-submit-btn" @click="handleSearch" :disabled="loading">
            <i class="lni lni-search-alt"></i>
            Search Pools
          </button>
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
      <div v-else-if="pools.length > 0">
        <!-- Results Header -->
        <div class="results-header">
          <div class="results-info">
            <i class="lni lni-layers"></i>
            <h2 class="results-title">Collections</h2>
          </div>
          <div class="results-divider"></div>
        </div>

        <div class="pools-grid">
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
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading && pools.length === 0" class="empty-state">
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
import { ref, onMounted, onUnmounted } from 'vue';
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
    
    const filters = ref({
      name: '',
      description: '',
      category: '',
      order: 'updated_at'
    });

    // Dropdown states
    const categoryDropdownOpen = ref(false);
    const orderDropdownOpen = ref(false);

    // Options for dropdowns
    const categoryOptions = [
      { value: '', label: 'All' },
      { value: 'series', label: 'Series' },
      { value: 'collection', label: 'Collection' }
    ];



    const orderOptions = [
      { value: 'updated_at', label: 'Last Updated' },
      { value: 'name', label: 'Name' },
      { value: 'created_at', label: 'Recently Created' },
      { value: 'post_count', label: 'Post Count' }
    ];

    // Dropdown toggle functions
    const toggleCategoryDropdown = () => {
      categoryDropdownOpen.value = !categoryDropdownOpen.value;
      orderDropdownOpen.value = false;
    };

    const toggleOrderDropdown = () => {
      orderDropdownOpen.value = !orderDropdownOpen.value;
      categoryDropdownOpen.value = false;
    };

    const selectCategory = (value) => {
      filters.value.category = value;
      categoryDropdownOpen.value = false;
    };

    const selectOrder = (value) => {
      filters.value.order = value;
      orderDropdownOpen.value = false;
    };

    // Label getter functions
    const getCategoryLabel = (value) => {
      const opt = categoryOptions.find(o => o.value === value);
      return opt ? opt.label : 'All';
    };



    const getOrderLabel = (value) => {
      const opt = orderOptions.find(o => o.value === value);
      return opt ? opt.label : 'Last Updated';
    };

    const handleSearch = () => {
      currentPage.value = 1;
      updateURL(1);
      fetchPools(1, filters.value);
    };

    const handlePageChange = (page) => {
      if (page < 1 || loading.value) return;
      currentPage.value = page;
      updateURL(page);
      fetchPools(page, filters.value);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const updateURL = (page = currentPage.value) => {
      const query = {};
      
      if (filters.value.name) query.name = filters.value.name;
      if (filters.value.description) query.description = filters.value.description;
      if (filters.value.category) query.category = filters.value.category;
      if (filters.value.order && filters.value.order !== 'updated_at') query.order = filters.value.order;
      if (page > 1) query.page = page;
      
      router.push({ path: '/pools', query });
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

    const handleDescriptionClick = async (e) => {
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

      // Handle post links - navigate to home with that post open
      if (target.classList.contains('post-link')) {
        e.preventDefault();
        const postId = target.dataset.postId;
        if (postId) {
          // Navigate to home page with the post ID in query
          // The home page can then fetch and open it
          window.open(`https://danbooru.donmai.us/posts/${postId}`, '_blank');
        }
      }
    };

    const isAnimatedCover = (pool) => {
      if (!pool.coverUrl) return false;
      // Check if the cover URL ends with video extensions
      return pool.coverUrl.match(/\.(mp4|webm)$/i);
    };

    const handleKeydown = (e) => {
      // Ignore if user is typing in input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      
      // Only handle if no filters are active
      const hasActiveFilters = filters.value.name || filters.value.description || 
                               filters.value.postTags || filters.value.category || 
                               filters.value.deleted;
      if (hasActiveFilters) return;
      
      if (e.key === 'a' || e.key === 'A') {
        if (currentPage.value > 1 && !loading.value) {
          e.preventDefault();
          handlePageChange(currentPage.value - 1);
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (hasNextPage.value && !loading.value) {
          e.preventDefault();
          handlePageChange(currentPage.value + 1);
        }
      }
    };

    onMounted(() => {
      // Parse URL params
      if (route.query.name) filters.value.name = route.query.name;
      if (route.query.description) filters.value.description = route.query.description;
      if (route.query.category) filters.value.category = route.query.category;
      if (route.query.order) filters.value.order = route.query.order;
      
      const page = parseInt(route.query.page) || 1;
      
      // Fetch pools
      fetchPools(page, filters.value);
      
      // Add keyboard listener
      window.addEventListener('keydown', handleKeydown);
      
      // Close dropdowns when clicking outside
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.closest('.custom-select')) {
          categoryDropdownOpen.value = false;
          orderDropdownOpen.value = false;
        }
      });
    });

    onUnmounted(() => {
      // Remove keyboard listener
      window.removeEventListener('keydown', handleKeydown);
    });

    return {
      pools,
      loading,
      error,
      currentPage,
      hasNextPage,
      filters,
      
      // Dropdown states
      categoryDropdownOpen,
      orderDropdownOpen,
      
      // Options
      categoryOptions,
      orderOptions,
      
      // Dropdown functions
      toggleCategoryDropdown,
      toggleOrderDropdown,
      selectCategory,
      selectOrder,
      getCategoryLabel,
      getOrderLabel,
      
      // Other functions
      handleSearch,
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
  margin-bottom: 64px;
  text-align: center;
}

.header-top {
  margin-bottom: 24px;
}

.page-title {
  display: flex;
  align-items: center;
  justify-content: center;
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
  align-items: center;
}

.search-wrapper {
  position: relative;
  max-width: 500px;
  width: 100%;
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
  justify-content: center;
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

/* Advanced Filter Styles */
.pools-controls {
  max-width: 1000px;
  margin: 0 auto;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

/* Text Filters Row - 2 inputs in one row */
.filter-text-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Dropdown Filters Row - 2 selects in one row */
.filter-dropdown-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

/* Old filter-row (keep for compatibility) */
.filter-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.filter-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-input {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: #a78bfa;
  background: rgba(0, 0, 0, 0.5);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.1);
}

.filter-input::placeholder {
  color: #64748b;
  font-size: 12px;
}

.filter-row-group {
  display: grid;
  grid-template-columns: 120px repeat(3, 1fr);
  gap: 12px;
  align-items: start;
  margin-bottom: 20px;
}

.filter-row-group > label:first-child {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
  text-align: right;
  padding-top: 10px;
}

.filter-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-col > .filter-label {
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Custom Select Styles */
.custom-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  width: 100%;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.select-trigger:hover,
.custom-select.is-open .select-trigger {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(167, 139, 250, 0.5);
}

.selected-value {
  flex: 1;
}

.chevron {
  font-size: 10px;
  opacity: 0.6;
  transition: transform 0.2s;
  margin-left: 8px;
}

.custom-select.is-open .chevron {
  transform: rotate(180deg);
}

.custom-options {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  min-width: 160px;
  background: #1a1a23;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  padding: 4px;
  list-style: none;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  max-height: 250px;
  overflow-y: auto;
}

.custom-option {
  padding: 10px 12px;
  font-size: 13px;
  color: #cbd5e1;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.15s;
  user-select: none;
}

.custom-option:hover {
  background: rgba(167, 139, 250, 0.15);
  color: #fff;
}

.custom-option.selected {
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  font-weight: 600;
}

.custom-option .check {
  font-size: 14px;
  color: #a78bfa;
  margin-left: 8px;
}

/* Dropdown Animation */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* Scrollbar for dropdown */
.custom-options::-webkit-scrollbar {
  width: 6px;
}

.custom-options::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.custom-options::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.3);
  border-radius: 4px;
}

.custom-options::-webkit-scrollbar-thumb:hover {
  background: rgba(167, 139, 250, 0.5);
}

.search-submit-btn {
  padding: 10px 28px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  margin: 0;
}

.search-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, #9333ea, #7c3aed);
}

.search-submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.search-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .filter-text-row,
  .filter-dropdown-row {
    grid-template-columns: 1fr;
  }
  
  .search-submit-btn {
    width: 100%;
  }
  
  .pools-controls {
    padding: 16px;
  }
}

/* Results Header */
.results-header {
  margin-bottom: 32px;
}

.results-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.results-info i {
  font-size: 24px;
  color: #a78bfa;
}

.results-title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.results-count {
  padding: 4px 12px;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 20px;
  color: #c084fc;
  font-size: 13px;
  font-weight: 600;
}

.results-divider {
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(167, 139, 250, 0.3) 10%, 
    rgba(167, 139, 250, 0.3) 90%, 
    transparent 100%
  );
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
.pool-description :deep(.pool-link),
.pool-description :deep(.post-link) {
  color: #a78bfa;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.pool-description :deep(.wiki-link):hover,
.pool-description :deep(.pool-link):hover,
.pool-description :deep(.post-link):hover {
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
