<template>
  <div class="post-gallery" :class="{ 'is-sidebar-collapsed': !isSidebarVisible }">
    <!-- Estados de carga mejorados -->
    <div v-if="loading && posts.length === 0" class="state-container loading" role="status">
      <div class="loader-ring"></div>
      <p>Loading content...</p>
    </div>

    <div
      v-else-if="posts.length === 0 && !loading"
      class="state-container no-posts"
      role="status"
    >
      <i class="lni lni-search-alt icon-large"></i>
      <h3>No results found</h3>
      <p>Try adjusting your search filters.</p>
    </div>

    <!-- Gallery Grid with Overlay -->
    <div v-else class="gallery-wrapper">
      
      <!-- Rating Distribution Container (prevents layout shift) -->
      <div class="rating-container">
        <!-- Rating Distribution Loading State -->
        <Transition name="fade-slide" mode="out-in">
          <div v-if="loadingCounts" key="loading" class="rating-bar loading">
             <div class="loader-dots">
                <span></span><span></span><span></span>
             </div>
             <span class="loading-text">Calculating rating distribution...</span>
          </div>

          <!-- Rating Distribution Bar -->
          <div v-else-if="!loading && isLimited" key="limited" class="rating-limit-info">
            <span class="icon">⚠️</span>
            <span>Counts by rating are unavailable for this tag due to API complexity limits.</span>
          </div>
          <div v-else-if="!loading && (tagCount || ratingCounts.g?.count !== null || ratingCounts.s?.count !== null || ratingCounts.q?.count !== null || ratingCounts.e?.count !== null)" key="ratings" class="rating-bar-container">
           <div class="rating-bar">
              <!-- Left: Total Count -->
              <div class="rating-bar-left">
                <span v-if="tagCount" class="total-badge">Total Tag Count: {{ formatCount(tagCount) }}</span>
              </div>
              
              <!-- Center: Rating Stats -->
              <div class="rating-bar-center">
                <div class="rating-stat general" title="General">
                  <span class="r-dot"></span>
                  <span class="r-label">General</span>
                  <span class="r-count">{{ formatCount(ratingCounts.g) }}</span>
                </div>
                <div class="rating-stat safe" title="Safe">
                  <span class="r-dot"></span>
                  <span class="r-label">Safe</span>
                  <span class="r-count">{{ formatCount(ratingCounts.s) }}</span>
                </div>
                <div class="rating-stat questionable" title="Questionable">
                  <span class="r-dot"></span>
                  <span class="r-label">Questionable</span>
                  <span class="r-count">{{ formatCount(ratingCounts.q) }}</span>
                </div>
                <div class="rating-stat explicit" title="Explicit">
                  <span class="r-dot"></span>
                  <span class="r-label">Explicit</span>
                  <span class="r-count">{{ formatCount(ratingCounts.e) }}</span>
                </div>
              </div>

              <!-- Right: Legend -->
              <div class="rating-bar-right">
                <div class="rating-legend">
                  <span title="Exact count">Exact</span>
                  <span title="Includes deleted posts">~ Approx</span>
                </div>
              </div>
            </div>
         </div>
        </Transition>
      </div>

      <!-- Overlay de carga para grid existente -->
      <div v-if="loading && posts.length > 0" class="grid-loading-overlay">
        <div class="loader-ring small"></div>
        <span>Loading more...</span>
      </div>
      
      <!-- Grid optimizado -->
      <div class="gallery-grid" :class="{ 'is-dimmed': loading }">
        <PostCard
          v-for="(post, index) in posts"
          :key="post.id"
          :post="post"
          :priority="index < 8"
          :pause-animations="pauseAnimations"
          @click="$emit('post-clicked', post)"
        />
      </div>

      <!-- Paginación accesible -->
      <nav v-if="!infiniteScroll && (currentPage > 1 || hasNextPage)" 
           class="pagination-wrapper" 
           aria-label="Pagination">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          class="nav-btn"
          :aria-label="`Go to previous page ${currentPage - 1}`"
        >
          <i class="lni lni-chevron-left arrow"></i>
          <span class="nav-text">Previous</span>
        </button>
        
        <div class="page-numbers">
          <button
            v-for="page in getPageNumbers()"
            :key="page"
            @click="goToPage(page)"
            :disabled="loading"
            :class="['num-btn', { active: page === currentPage }]"
            :aria-label="`Go to page ${page}`"
            :aria-current="page === currentPage ? 'page' : null"
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="goToPage(currentPage + 1)"
          :disabled="!hasNextPage || loading"
          class="nav-btn"
          :aria-label="`Go to next page ${currentPage + 1}`"
        >
          <span class="nav-text">Next</span>
          <i class="lni lni-chevron-right arrow"></i>
        </button>
      </nav>

      <!-- Infinite scroll optimizado -->
      <div
        v-if="infiniteScroll && hasNextPage"
        ref="infiniteScrollTrigger"
        class="infinite-loader"
        :aria-busy="loading"
      >
        <div v-if="loading" class="spinner-dots">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div class="results-meta" role="status">
        <span v-if="!infiniteScroll">Page {{ currentPage }} • </span>
        {{ posts.length }} results shown
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRatingCounts } from "../composables/useRatingCounts";
import { useLayout } from '../composables/useLayout';
import PostCard from './PostCard.vue';

const props = defineProps({
  posts: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  currentPage: {
    type: Number,
    default: 1,
  },
  hasNextPage: {
    type: Boolean,
    default: false,
  },
  infiniteScroll: {
    type: Boolean,
    default: false,
  },
  ratingCounts: {
    type: Object,
    default: () => ({ g: 0, s: 0, q: 0, e: 0 }),
  },
  pauseAnimations: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["load-more", "change-page", "post-clicked"]);

const { isLimited, loadingCounts, tagCount } = useRatingCounts();
const { isSidebarVisible } = useLayout();
const infiniteScrollTrigger = ref(null);
let observer = null;

const setupIntersectionObserver = () => {
  if (!props.infiniteScroll || !props.hasNextPage || props.loading) return;

  // Limpiar observer existente
  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasNextPage && !props.loading) {
        emit("load-more");
      }
    },
    {
      rootMargin: "300px",
      threshold: 0.1
    }
  );

  if (infiniteScrollTrigger.value) {
    observer.observe(infiniteScrollTrigger.value);
  }
};

onMounted(() => {
  if (props.infiniteScroll) {
    nextTick(setupIntersectionObserver);
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

watch(
  [
    () => props.infiniteScroll,
    () => props.hasNextPage,
    () => props.loading,
  ],
  setupIntersectionObserver
);

watch(
  () => props.posts.length,
  () => {
    if (props.infiniteScroll) {
      nextTick(setupIntersectionObserver);
    }
  }
);

const getPageNumbers = () => {
  const pages = [];
  const maxVisible = 5;
  
  if (props.currentPage <= maxVisible) {
    // Mostrar primeras páginas
    for (let i = 1; i <= Math.min(maxVisible, props.currentPage + 2); i++) {
      pages.push(i);
    }
  } else {
    // Mostrar páginas alrededor de la actual
    pages.push(1, '...');
    for (let i = props.currentPage - 2; i <= props.currentPage + 2; i++) {
      if (i > 1 && i <= props.currentPage + 2) {
        pages.push(i);
      }
    }
  }
  
  if (props.hasNextPage && !pages.includes(props.currentPage + 1)) {
    pages.push(props.currentPage + 1);
  }
  
  return pages;
};

const goToPage = (page) => {
  if (page !== '...') {
    emit("change-page", page);
  }
};

const formatCount = (countData) => {
  if (countData === null || countData === undefined) return '0';
  
  // Handle legacy number case
  if (typeof countData === 'number') {
    const val = countData;
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val.toString();
  }

  // Handle object case
  const val = countData.count;
  const approx = countData.isApproximate ? '~' : '';
  
  if (val === null || val === undefined) return '?';
  if (val === 0) return '0';
  
  let formatted = val.toString();
  if (val >= 1000000) {
    formatted = (val / 1000000).toFixed(1) + 'M';
  } else if (val >= 1000) {
    formatted = (val / 1000).toFixed(1) + 'k';
  } else {
    formatted = val.toString();
  }
  
  return `${approx}${formatted}`;
};
</script>

<style scoped>
/* Base Layout */
.post-gallery {
  width: 100%;
  font-family: 'Inter', sans-serif;
}

/* State Containers (Loading / No Posts) */
.state-container {
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
  max-width: 100%;
}

/* Rating Bar */
.rating-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
  background: rgba(20, 20, 25, 0.4);
  padding: 12px 24px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.rating-bar-left { justify-self: start; }

.rating-bar-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.rating-bar-right { justify-self: end; }

.rating-limit-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  background: rgba(234, 179, 8, 0.05);
  padding: 12px 24px;
  border-radius: 16px;
  border: 1px solid rgba(234, 179, 8, 0.1);
  color: #94a3b8;
  font-size: 13px;
}

.rating-limit-info .icon { color: #eab308; }

@media (max-width: 1024px) {
  .rating-bar {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px 16px;
    text-align: center;
  }
  
  .rating-bar-left, .rating-bar-center, .rating-bar-right {
    justify-self: center;
    width: 100%;
  }

  .rating-bar-center { gap: 12px; }
}

@media (max-width: 480px) {
  .rating-bar { padding: 10px 8px; }
  .rating-bar-center { gap: 8px; }
}

.rating-bar-container { margin-bottom: 24px; }

.total-badge {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  background: rgba(139, 92, 246, 0.2);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.rating-legend {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #94a3b8;
  flex-wrap: wrap;
  justify-content: center;
}

.rating-legend span {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}

.rating-legend span::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Loading State in Rating Bar */
.rating-bar.loading {
  display: flex !important;
  justify-content: center;
  align-items: center;
  flex-direction: row;
  min-height: 50px;
  gap: 12px;
  background: rgba(139, 92, 246, 0.05);
  border-color: rgba(139, 92, 246, 0.1);
}

.loading-text {
  font-size: 13px;
  color: #a78bfa;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.loader-dots {
  display: flex;
  gap: 4px;
}

.loader-dots span {
  width: 6px;
  height: 6px;
  background: #a78bfa;
  border-radius: 50%;
  animation: pulse 1.4s infinite ease-in-out both;
}

.loader-dots span:nth-child(1) { animation-delay: -0.32s; }
.loader-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes pulse {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

.rating-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #cbd5e1;
}

.r-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.rating-stat.general .r-dot { background: #3b82f6; box-shadow: 0 0 8px rgba(59, 130, 246, 0.4); }
.rating-stat.safe .r-dot { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.4); }
.rating-stat.questionable .r-dot { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }
.rating-stat.explicit .r-dot { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }

.r-label {
  font-weight: 600;
  opacity: 0.9;
}

.r-count {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loader-ring {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(139, 92, 246, 0.2);
  border-left-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loader-ring.small {
  width: 40px;
  height: 40px;
  border-width: 3px;
  margin-bottom: 0;
}

.gallery-wrapper {
  position: relative;
  min-height: 400px;
}

.grid-loading-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.9);
  padding: 24px;
  border-radius: 16px;
  backdrop-filter: blur(10px);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, -40%); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

.gallery-grid.is-dimmed {
  opacity: 0.6;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

@keyframes fadeIn { to { opacity: 1; } }

.icon-large {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.8;
}

/* Grid Layout */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: clamp(12px, 2vw, 24px);
  padding-bottom: 40px;
  will-change: transform;
  contain: layout style paint;
  content-visibility: auto;
}

@media (max-width: 1024px) {
  .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
}

@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (max-width: 640px) {
  .gallery-grid {
    grid-template-columns: 1fr !important;
    gap: 20px;
  }
}

@media (max-width: 480px) {
  .gallery-grid { gap: 16px; }
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 40px;
  gap: 20px;
  flex-wrap: wrap;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #a78bfa;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.num-btn {
  min-width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
}

.num-btn.active {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: white;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  font-weight: 700;
}

.num-btn:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.results-meta {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  margin-top: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

@media (max-width: 640px) {
  .nav-text { display: none; }
  .pagination-wrapper { gap: 10px; margin-top: 20px; }
  .page-numbers { gap: 2px; }
  .gallery-grid { gap: 10px; }
  
  .rating-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .rating-bar-center {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .rating-stat {
    flex: 1;
    min-width: 120px;
    justify-content: center;
  }

  .state-container {
    padding: 40px 16px;
    border-radius: 12px;
    min-height: 200px;
  }
}

.rating-container {
  position: relative;
  min-height: 60px;
  margin-bottom: 20px;
}

.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(-10px); }
.fade-slide-leave-to { opacity: 0; transform: translateY(10px); }

.nav-btn:focus-visible, .num-btn:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}

.arrow { font-size: 14px; }
</style>
