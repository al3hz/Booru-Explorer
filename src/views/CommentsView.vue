<template>
  <div class="comments-view">
    <div class="comments-container">
      <h2>Recent Comments</h2>
      
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>Loading comments...</span>
      </div>

      <div v-else-if="error" class="error-state">
        {{ error }}
      </div>

      <div v-else class="comments-list">
        <transition-group name="list" tag="div" appear>
          <div 
            v-for="(comment, index) in comments" 
            :key="comment.id" 
            class="comment-card"
            :style="{ transitionDelay: `${index * 0.05}s` }"
          >
            
            <!-- Post Preview Section -->
            <div class="post-preview-column">
              <div 
                v-if="postsMap[comment.post_id]" 
                class="preview-link"
                @click="openModal(postsMap[comment.post_id])"
                title="View image details"
              >
                <img 
                  :src="postsMap[comment.post_id].preview_file_url || postsMap[comment.post_id].file_url" 
                  :alt="`Post #${comment.post_id}`"
                  class="preview-image"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>
              <div v-else class="preview-placeholder">
                <span class="icon">🖼️</span>
                <span class="text">#{{ comment.post_id }}</span>
              </div>
            </div>

            <!-- Comment Content Section -->
            <div class="comment-content-column">
              <div class="comment-header">
                <span class="comment-author">User #{{ comment.creator_id }}</span>
                <span class="separator">•</span>
                <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
                <a :href="`https://danbooru.donmai.us/posts/${comment.post_id}`" target="_blank" class="post-link">
                  On Post #{{ comment.post_id }}
                </a>
              </div>
              
              <div class="comment-body" v-html="formatBody(comment.body)"></div>
              
              <div class="comment-footer">
                <span class="score" :class="{ positive: comment.score > 0, negative: comment.score < 0 }">
                  Score: {{ comment.score }}
                </span>
              </div>
            </div>

          </div>
        </transition-group>
      </div>

      <!-- Pagination Controls -->
      <div class="pagination-controls" v-if="comments.length > 0 || page > 1">
        <button 
          class="page-btn" 
          :disabled="page === 1 || loading"
          @click="changePage(page - 1)"
        >
          <i class="lni lni-arrow-left"></i> Previous
        </button>
        <span class="page-info">Page {{ page }}</span>
        <button 
          class="page-btn" 
          :disabled="comments.length < 10 || loading"
          @click="changePage(page + 1)"
        >
           Next <i class="lni lni-arrow-right"></i>
        </button>
      </div>

      <!-- Image Detail Modal -->
      <transition name="modal">
        <ImageDetailModal
          v-if="selectedPost"
          :post="selectedPost"
          @close="selectedPost = null"
          @search-tag="handleTagSearch"
        />
      </transition>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ImageDetailModal from '../components/ImageDetailModal.vue';

export default {
  name: "CommentsView",
  components: {
    ImageDetailModal
  },
  setup() {
    const router = useRouter();
    const comments = ref([]);
    const postsMap = ref({}); // Map post_id -> post object
    const loading = ref(true);
    const error = ref(null);
    const page = ref(1);
    const selectedPost = ref(null);

    const openModal = (post) => {
      selectedPost.value = post;
    };

    const handleTagSearch = (tag) => {
      selectedPost.value = null; // Close modal
      router.push({ path: '/', query: { tags: tag } });
    };

    const fetchCommentsAndPosts = async () => {
      loading.value = true;
      comments.value = []; // Clear for animation
      postsMap.value = {};
      error.value = null;

      try {
        const response = await fetch(`https://danbooru.donmai.us/comments.json?group_by=comment&limit=10&page=${page.value}`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        const commentsData = await response.json();
        comments.value = commentsData;

        const postIds = [...new Set(commentsData.map(c => c.post_id))];
        
        if (postIds.length > 0) {
           const idsQuery = postIds.join(',');
           const postsResponse = await fetch(`https://danbooru.donmai.us/posts.json?tags=id:${idsQuery}&limit=${postIds.length}`);
           
           if (postsResponse.ok) {
             const postsData = await postsResponse.json();
             const map = {};
             postsData.forEach(post => {
               map[post.id] = post;
             });
             postsMap.value = map;
           }
        }

      } catch (err) {
        error.value = err.message;
      } finally {
        loading.value = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    const changePage = (newPage) => {
      if (newPage < 1) return;
      page.value = newPage;
      fetchCommentsAndPosts();
    };

    const handleKeydown = (e) => {
      // Ignore if user is typing in an input (though currently none exist, good practice)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Ignore if modal is open
      if (selectedPost.value) return;

      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        if (page.value > 1 && !loading.value) {
          changePage(page.value - 1);
        }
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        // Simple check for next page availability (assuming < 10 items means end)
        if (comments.value.length >= 10 && !loading.value) {
          changePage(page.value + 1);
        }
      }
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatBody = (body) => {
      if (!body) return '';
      let formatted = body
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      // Handle [quote] tags
      formatted = formatted.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>');
      
      // Handle newlines after quotes (and general newlines)
      formatted = formatted.replace(/\n/g, '<br>');
        
      formatted = formatted.replace(/post #(\d+)/gi, '<a href="https://danbooru.donmai.us/posts/$1" target="_blank" class="text-link">post #$1</a>');
      formatted = formatted.replace(/"(.*?)"\:\[(.*?)\]/g, '<a href="$2" target="_blank" class="text-link">$1</a>');
      
      return formatted;
    };

    const handleImageError = (e) => {
      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4/PC90ZXh0Pjwvc3ZnPg==';
    };

    onMounted(() => {
      fetchCommentsAndPosts();
      window.addEventListener('keydown', handleKeydown);
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
    });

    return {
      comments,
      postsMap,
      loading,
      error,
      page,
      selectedPost,
      changePage,
      formatDate,
      formatBody,
      handleImageError,
      openModal,
      handleTagSearch
    };
  }
};
</script>

<style scoped>
.comments-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.comments-container h2 {
  font-size: 24px;
  margin-bottom: 20px;
  color: #a78bfa;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}

/* List Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.comment-card {
  background: rgba(30, 30, 40, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  gap: 20px;
  transition: transform 0.2s;
}

.comment-card:hover {
  background: rgba(30, 30, 40, 0.8);
  border-color: rgba(167, 139, 250, 0.2);
}

/* Column Styles */
.post-preview-column {
  flex-shrink: 0;
  width: 120px;
}

.preview-link {
  display: block;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  background: rgba(0,0,0,0.2);
}

.preview-link:hover {
  border-color: #a78bfa;
}

.preview-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  min-height: 120px;
  background-color: #1a1a24;
}

.preview-placeholder {
  width: 100%;
  height: 120px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  gap: 5px;
}

.comment-content-column {
  flex-grow: 1;
  min-width: 0; /* Prevent flex overflow */
}

/* Header */
.comment-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.separator {
  color: rgba(255,255,255,0.2);
}

.comment-author {
  color: #a78bfa;
  font-weight: 600;
}

.post-link {
  margin-left: auto;
  color: #64748b;
  text-decoration: none;
  font-size: 12px;
  background: rgba(255,255,255,0.05);
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.post-link:hover {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}

/* Body */
.comment-body {
  color: #e2e8f0;
  line-height: 1.6;
  font-size: 14px;
  word-wrap: break-word; /* Ensure text wraps */
  overflow-wrap: break-word;
}

/* Quote Styles */
.comment-body :deep(blockquote) {
  margin: 10px 0;
  padding: 10px 15px;
  border-left: 3px solid #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  color: #c4b5fd;
  border-radius: 0 8px 8px 0;
  font-style: italic;
}

/* Links inside comments */
.comment-body :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}
.comment-body :deep(a):hover {
  text-decoration: underline;
}

/* Footer */
.comment-footer {
  margin-top: 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.score {
  font-weight: 600;
  color: #94a3b8;
  background: rgba(0,0,0,0.2);
  padding: 2px 8px;
  border-radius: 4px;
}

.score.positive { text-shadow: 0 0 10px rgba(74, 222, 128, 0.2); color: #4ade80; }
.score.negative { color: #f87171; }

/* Pagination */
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.page-btn {
  background: rgba(30, 30, 40, 0.8);
  border: 1px solid rgba(167, 139, 250, 0.3);
  color: #c084fc;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: rgba(255,255,255,0.1);
  color: #64748b;
}

.page-btn:not(:disabled):hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: #a78bfa;
  transform: translateY(-1px);
}

.page-info {
  color: #94a3b8;
  font-weight: 600;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  border-top-color: #a78bfa;
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .comments-container {
    padding: 0;
  }
  
  .comment-card {
    flex-direction: column;
    gap: 12px;
  }
  
  .post-preview-column {
    width: 100%;
    max-width: none;
  }

  .preview-link {
    max-width: 100%;
  }

  .preview-image {
    max-height: 200px; /* Limit height so it doesn't take up whole screen */
    width: 100%;
    object-position: center top;
  }

  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    position: relative;
  }

  .post-link {
    margin-left: 0;
    margin-top: 4px;
    display: inline-block;
  }
  
  .separator {
    display: none;
  }
}
</style>
