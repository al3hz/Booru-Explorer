<template>
  <div class="pool-detail-view">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading pool...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="lni lni-warning"></i>
      <p>{{ error }}</p>
      <router-link to="/pools" class="back-btn">
        <i class="lni lni-arrow-left"></i>
        Back to Pools
      </router-link>
    </div>

    <!-- Pool Content -->
    <div v-else-if="pool" class="pool-content">
      <!-- Pool Header -->
      <div class="pool-header">
        <router-link to="/pools" class="back-link">
          <i class="lni lni-arrow-left"></i>
          Back to Pools
        </router-link>

        <div class="pool-title-section">
          <h1 class="pool-title">{{ formatPoolName(pool.name) }}</h1>
          <div class="pool-badges">
            <span class="badge category" :class="`category-${pool.category}`">
              {{ formatCategory(pool.category) }}
            </span>
            <span class="badge count">
              <i class="lni lni-gallery"></i>
              {{ poolPosts.length }} posts
            </span>
          </div>
        </div>

        <div 
          v-if="pool.description" 
          class="pool-description"
          v-html="parseDText(pool.description)"
          @click="handleDescriptionClick"
        ></div>

        <div class="pool-meta">
          <span class="meta-item">
            <i class="lni lni-calendar"></i>
            Updated: {{ formatDate(pool.updated_at) }}
          </span>
          <a :href="`https://danbooru.donmai.us/pools/${pool.id}`" target="_blank" class="meta-item danbooru-link">
            <i class="lni lni-link"></i>
            View on Danbooru
          </a>
        </div>
      </div>

      <!-- No Posts State -->
      <div v-if="poolPosts.length === 0" class="empty-posts">
        <i class="lni lni-inbox"></i>
        <p>This pool has no posts</p>
      </div>

      <!-- Pool Gallery -->
      <div v-else class="pool-gallery">
        <div
          v-for="(post, index) in poolPosts"
          :key="post.id"
          class="pool-post-card"
          @click="openPost(index)"
        >
          <div class="post-thumbnail">
            <!-- Animated Video -->
            <SmartVideo
              v-if="isAnimatedVideo(post)"
              :src="getVideoUrl(post)"
              :poster="getVideoPoster(post)"
              :alt="`Post ${index + 1}`"
              className="post-thumbnail-media"
            />
            
            <!-- Static Image or GIF -->
            <img
              v-else
              :src="post.large_file_url || post.file_url || post.preview_file_url"
              :alt="`Post ${index + 1}`"
              loading="lazy"
              @error="handleImageError"
              class="post-thumbnail-media"
            />
            <div class="post-overlay">
              <span class="post-number">#{{ index + 1 }}</span>
              <div class="post-icons">
                <span v-if="isVideo(post)" class="icon-badge">
                  <i class="lni lni-play"></i>
                </span>
                <span v-if="post.file_ext === 'gif'" class="icon-badge">
                  <i class="lni lni-image"></i> GIF
                </span>
              </div>
            </div>
          </div>
          <div class="post-info">
            <span class="rating-badge" :class="post.rating">
              {{ formatRating(post.rating) }}
            </span>
            <span class="score">
              <i class="lni lni-heart"></i>
              {{ post.score }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Detail Modal with Pool Navigation -->
    <Transition name="modal">
      <ImageDetailModal
        v-if="selectedPost"
        :post="selectedPost"
        @close="selectedPost = null"
        @next="navigatePost(1)"
        @prev="navigatePost(-1)"
        @search-tag="handleTagSearch"
        @update-post="selectedPost = $event"
        :has-next="canGoNext"
        :has-prev="canGoPrev"
      >
        <!-- Pool Navigation Banner -->
        <template #pool-nav v-if="pool">
          <div class="pool-nav-banner">
            <div class="pool-nav-info">
              <i class="lni lni-layers"></i>
              <span>{{ pool.name }}</span>
              <span class="nav-position">{{ currentPostIndex + 1 }} / {{ poolPosts.length }}</span>
            </div>
            <div class="pool-nav-controls">
              <button
                @click.stop="navigatePost(-1)"
                :disabled="!canGoPrev"
                class="nav-btn"
                title="Previous"
              >
                <i class="lni lni-chevron-left"></i>
              </button>
              <button
                @click.stop="navigatePost(1)"
                :disabled="!canGoNext"
                class="nav-btn"
                title="Next"
              >
                <i class="lni lni-chevron-right"></i>
              </button>
            </div>
          </div>
        </template>
      </ImageDetailModal>
    </Transition>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePoolDetail } from '../composables/usePools';
import { useDText } from '../composables/useDText';
import ImageDetailModal from '../components/ImageDetailModal.vue';
import SmartVideo from '../components/SmartVideo.vue';

export default {
  name: 'PoolDetailView',
  components: {
    ImageDetailModal,
    SmartVideo
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { pool, poolPosts, loading, error, fetchPoolDetail } = usePoolDetail();
    const { parseDText } = useDText();
    
    const selectedPost = ref(null);
    const currentPostIndex = ref(-1);

    const canGoPrev = computed(() => {
      return selectedPost.value && currentPostIndex.value > 0;
    });

    const canGoNext = computed(() => {
      return selectedPost.value && currentPostIndex.value < poolPosts.value.length - 1;
    });

    const openPost = (index) => {
      currentPostIndex.value = index;
      selectedPost.value = poolPosts.value[index];
    };

    const navigatePost = (direction) => {
      const newIndex = currentPostIndex.value + direction;
      if (newIndex >= 0 && newIndex < poolPosts.value.length) {
        currentPostIndex.value = newIndex;
        selectedPost.value = poolPosts.value[newIndex];
      }
    };

    const handleTagSearch = (tag) => {
      selectedPost.value = null;
      router.push({ path: '/', query: { tags: tag } });
    };

    const formatCategory = (cat) => {
      if (!cat) return 'Unknown';
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatRating = (rating) => {
      const map = {
        'g': 'G',
        's': 'S',
        'q': 'Q',
        'e': 'E'
      };
      return map[rating] || rating;
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

    const isAnimatedVideo = (post) => {
      return (
        ['webm', 'mp4'].includes(post.file_ext) ||
        (post.file_ext === 'zip' && post.large_file_url && post.large_file_url.endsWith('.webm'))
      );
    };

    const getVideoUrl = (post) => {
      return (
        post.large_file_url ||
        post.file_url ||
        post.sample_url ||
        post.preview_url ||
        ''
      );
    };

    const getVideoPoster = (post) => {
      // Try to get high quality thumbnail from variants
      if (post.media_asset && post.media_asset.variants) {
        const variants = post.media_asset.variants;
        const bestVariant = variants.find(v => v.type === '720x720' && ['webp', 'jpg'].includes(v.file_ext)) ||
                            variants.find(v => v.type === '360x360' && ['webp', 'jpg'].includes(v.file_ext)) ||
                            variants.find(v => v.type === 'sample');
        
        if (bestVariant) return bestVariant.url;
      }
      
      // Fallback
      return post.preview_file_url || post.preview_url || '';
    };

    const isVideo = (post) => {
      return ['mp4', 'webm', 'gifv'].includes(post.file_ext);
    };

    const handleImageError = (e) => {
      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4/PC90ZXh0Pjwvc3ZnPg==';
    };

    onMounted(() => {
      const poolId = route.params.id;
      if (poolId) {
        fetchPoolDetail(poolId);
      }
    });

    return {
      pool,
      poolPosts,
      loading,
      error,
      selectedPost,
      currentPostIndex,
      canGoPrev,
      canGoNext,
      openPost,
      navigatePost,
      handleTagSearch,
      formatCategory,
      formatDate,
      formatRating,
      formatPoolName,
      parseDText,
      handleDescriptionClick,
      isAnimatedVideo,
      getVideoUrl,
      getVideoPoster,
      isVideo,
      handleImageError
    };
  }
};
</script>

<style scoped>
.pool-detail-view {
  min-height: 100vh;
  padding: 20px;
}

/* Loading/Error States */
.loading-container,
.error-container {
  text-align: center;
  padding: 80px 20px;
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

.error-container i {
  font-size: 48px;
  color: #ef4444;
  margin-bottom: 16px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 20px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  color: #a78bfa;
  text-decoration: none;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(167, 139, 250, 0.2);
}

/* Pool Content */
.pool-content {
  max-width: 1400px;
  margin: 0 auto;
}

/* Pool Header */
.pool-header {
  margin-bottom: 32px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: #a78bfa;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-link:hover {
  color: #c084fc;
  gap: 12px;
}

.pool-title-section {
  margin-bottom: 16px;
}

.pool-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px 0;
  background: linear-gradient(90deg, #fff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  word-break: break-word;
  overflow-wrap: break-word;
}

.pool-badges {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.badge {
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge.category {
  text-transform: uppercase;
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

.badge.count {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

.pool-description {
  color: #cbd5e1;
  font-size: 15px;
  line-height: 1.6;
  margin: 0 0 16px 0;
  max-width: 800px;
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
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin: 12px 0 6px 0;
}

.pool-description :deep(ul) {
  margin: 8px 0;
  padding-left: 20px;
}

.pool-description :deep(li) {
  margin: 4px 0;
}

.pool-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}

.meta-item i {
  font-size: 16px;
}

.danbooru-link {
  color: #a78bfa;
  text-decoration: none;
  transition: color 0.2s;
}

.danbooru-link:hover {
  color: #c084fc;
}

/* Empty Posts */
.empty-posts {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.empty-posts i {
  font-size: 48px;
  color: #64748b;
  margin-bottom: 16px;
}

/* Pool Gallery */
.pool-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.pool-post-card {
  background: rgba(20, 20, 28, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
}

.pool-post-card:hover {
  transform: translateY(-4px);
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.post-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.post-thumbnail-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.pool-post-card:hover .post-thumbnail-media {
  transform: scale(1.05);
}

.post-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 10px;
  opacity: 0;
  transition: opacity 0.3s;
}

.pool-post-card:hover .post-overlay {
  opacity: 1;
}

.post-number {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.post-icons {
  display: flex;
  gap: 6px;
}

.icon-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 6px;
  background: rgba(167, 139, 250, 0.3);
  border-radius: 4px;
  color: #fff;
}

.post-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
}

.rating-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
}

.rating-badge.g {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.rating-badge.s {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.rating-badge.q {
  background: rgba(251, 191, 36, 0.2);
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.rating-badge.e {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.score {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.score i {
  color: #f87171;
}

/* Pool Navigation Banner (inside modal) */
.pool-nav-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 10px;
  margin-bottom: 16px;
}

.pool-nav-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #cbd5e1;
}

.pool-nav-info i {
  color: #a78bfa;
  font-size: 16px;
}

.nav-position {
  color: #94a3b8;
  font-size: 12px;
  margin-left: 8px;
}

.pool-nav-controls {
  display: flex;
  gap: 8px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 6px;
  color: #a78bfa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .pool-detail-view {
    padding: 12px;
  }

  .pool-title {
    font-size: 24px;
  }

  .pool-gallery {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .pool-nav-banner {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .pool-nav-info {
    justify-content: center;
  }

  .pool-nav-controls {
    justify-content: center;
  }
}
</style>
