<template>
    <div class="modal-backdrop">
      <!-- Nav Buttons -->
      <transition name="fade-arrow">
        <button v-if="canGoPrev" class="nav-arrow prev" @click.stop="triggerPrev" title="Previous image">
          ‹
        </button>
      </transition>
      
      <div class="modal-container">
        <!-- Close Button Moved Inside but better positioned -->
        <button class="close-btn" @click="$emit('close')">×</button>
        
        <div class="modal-content">
          <div class="main-column">
            <!-- Relationship Banner -->
            <transition name="slide-down">
              <div v-if="familyPosts.length > 0" class="relationship-banner">
                <div class="family-info">
                    This post belongs to a <strong v-if="post.parent_id">parent</strong><strong v-else>group</strong> and has <strong>{{ familyPosts.length - 1 }} siblings</strong>.
                </div>
                <div class="family-scroll">
                    <div 
                      v-for="fPost in familyPosts" 
                      :key="fPost.id" 
                      class="family-thumb"
                      :class="{ 'active': fPost.id === post.id }"
                      @click.stop="handleBannerClick(fPost)"
                    >
                      <img 
                        :src="fPost.preview_file_url || fPost.file_url" 
                        :alt="`Post ${fPost.id}`"
                        loading="lazy"
                      />
                    </div>
                </div>
              </div>
            </transition>

            <!-- Image Section -->
            <div class="image-section">
            
            <!-- Pending Overlay -->
            <transition name="fade">
              <div v-if="post.is_pending && showPendingOverlay" class="pending-overlay">
                <i class="lni lni-warning"></i>
                <span>Pending Approval</span>
                <span class="separator">•</span>
                <a href="#" @click.prevent="goToWiki('about:mod_queue')" class="overlay-link" title="Read about moderation queue">Learn more</a>
                <button class="overlay-close" @click.stop="showPendingOverlay = false">×</button>
              </div>
            </transition>

            <div v-if="loading" class="image-loader">
              <div class="loader-spinner"></div>
            </div>
            <transition :name="transitionName" mode="out-in">
              <div v-if="isFlash" class="ruffle-container" ref="ruffleContainer"></div>
              <video
                v-else-if="isVideo"
                :key="`vid-${post.id}`"
                :src="post.large_file_url || post.file_url"
                class="detail-image"
                autoplay
                loop
                muted
                controls
                @loadeddata="onImageLoad"
                @error="handleImageError"
              ></video>
              <img 
                v-else
                :key="`img-${post.id}`"
                :src="post.large_file_url || post.file_url || post.preview_file_url" 
                :alt="`Post ${post.id}`"
                class="detail-image"
                @load="onImageLoad"
                @error="handleImageError"
              />
            </transition>
            
          </div>

          </div>
          <!-- Info Sidebar -->
          <div class="info-sidebar">
            <div class="info-header">
              <div class="header-left">
                <h2 class="post-id">Post #{{ post.id }}</h2>
                <!-- Status Labels -->
                <div class="status-indicators-modal">
                    <span v-if="post.is_pending" class="status-badge pending">PENDING</span>
                    <span v-if="post.is_deleted" class="status-badge deleted">DELETED</span>
                    <span v-if="post.is_flagged" class="status-badge flagged">FLAGGED</span>
                </div>
                <div class="header-actions">
                  <a 
                    :href="post.file_url || post.large_file_url" 
                    target="_blank" 
                    download 
                    class="action-btn"
                    :class="{ 'disabled': downloading }"
                    title="Download original image"
                    @click.prevent="!downloading && downloadImage()"
                  >
                    <i v-if="downloading" class="lni lni-spinner lni-is-spinning"></i>
                    <i v-else class="lni lni-download"></i>
                  </a>
                  <button 
                    @click="copyImageLink" 
                    class="action-btn"
                    :class="{ 'copied': linkCopied }"
                    title="Copy image link"
                  >
                    <i class="lni" :class="linkCopied ? 'lni-checkmark' : 'lni-link'"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="scrollable-info">
              <!-- Stats Grid -->
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="label">Dimensions</span>
                  <span class="value">{{ post.image_width }}x{{ post.image_height }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">Size</span>
                  <span class="value">{{ formatFileSize(post.file_size) }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">Format</span>
                  <span 
                    class="value rating-pill format" 
                    :class="getExtensionClass(post.file_ext)"
                  >
                    {{ post.file_ext ? post.file_ext.toUpperCase() : 'N/A' }}
                  </span>
                </div>
                <div class="stat-item">
                  <span class="label">Rating</span>
                  <span class="value rating-pill" :class="post.rating">
                    {{ formatRating(post.rating) }}
                  </span>
                </div>
                <div class="stat-item">
                  <span class="label">Score</span>
                  <span class="value">{{ post.score }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">Uploaded</span>
                  <span class="value">{{ formatDate(post.created_at) }}</span>
                </div>
                <div class="stat-item" v-if="post.source">
                  <span class="label">Source</span>
                  <a :href="post.source" target="_blank" class="value source-link" title="Open original source">Link ↗</a>
                </div>
                <div class="stat-item">
                  <span class="label">Uploader</span>
                  <a :href="`https://danbooru.donmai.us/users/${post.uploader_id}`" target="_blank" class="value source-link">User #{{ post.uploader_id }}</a>
                </div>
                <!-- Parent/Children removed as requested -->
              </div>

              <!-- Artist Commentary -->
              <div v-if="commentary" class="commentary-section">
                <h3>Artist Commentary</h3>
                <div class="commentary-content">
                  <h4 v-if="commentary.original_title">{{ commentary.original_title }}</h4>
                  <div class="commentary-body" v-html="parseDText(commentary.original_description)"></div>
                </div>
              </div>

              <!-- Tags Section -->
              <div class="tags-section">
                <!-- Artist Tags -->
                <div v-if="artistTags.length" class="tag-group">
                  <h3>Artists</h3>
                  <div class="tag-list">
                    <div 
                      v-for="tag in artistTags" 
                      :key="tag" 
                      class="tag-wrapper"
                    >
                        <span 
                          class="tag artist"
                          @click="$emit('search-tag', tag)"
                          title="Search by artist"
                        >{{ tag }}</span>
                        <button class="info-icon-btn" @click.stop="openArtistInfo(tag)" title="Artist Info">
                            <i class="lni lni-user"></i>
                        </button>
                    </div>
                  </div>
                </div>

                <!-- Copyright Tags -->
                <div v-if="copyrightTags.length" class="tag-group">
                  <h3>Series</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in copyrightTags" 
                      :key="tag" 
                      class="tag copyright"
                      @click="$emit('search-tag', tag)"
                      title="Search by series"
                    >{{ tag }}</span>
                  </div>
                </div>

                <!-- Character Tags -->
                <div v-if="characterTags.length" class="tag-group">
                  <h3>Characters</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in characterTags" 
                      :key="tag" 
                      class="tag character"
                      @click="$emit('search-tag', tag)"
                      title="Search by character"
                    >{{ tag }}</span>
                  </div>
                </div>

                <!-- General Tags -->
                <div v-if="generalTags.length" class="tag-group">
                  <h3>Tags</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in generalTags" 
                      :key="tag" 
                      class="tag general"
                      @click="$emit('search-tag', tag)"
                    >{{ tag }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Comments Section -->
              <div v-if="comments.length > 0" class="comments-section">
                <h3>
                  Comments
                  <span style="font-size: 11px; opacity: 0.7;">{{ comments.length }}</span>
                </h3>
                <transition-group name="list" tag="div" class="comment-list" appear>
                  <div 
                    v-for="(comment, index) in comments" 
                    :key="comment.id" 
                    class="comment-item"
                    :style="{ transitionDelay: `${index * 0.05}s` }"
                  >
                    <div class="comment-meta">
                      <span class="comment-author">User #{{ comment.creator_id }}</span>
                      <span class="comment-score" :class="{ positive: comment.score > 0, negative: comment.score < 0 }">
                        Score: {{ comment.score }}
                      </span>
                      <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
                    </div>
                    <div class="comment-body" v-html="parseDText(comment.body)"></div>
                  </div>
                </transition-group>
                
                <div v-if="hasMoreComments" class="load-more-container">
                    <button 
                      class="load-more-btn" 
                      @click="loadMoreComments" 
                      :disabled="commentsLoading"
                    >
                      <span v-if="commentsLoading" class="mini-spinner"></span>
                      <span v-else>Load more comments</span>
                    </button>
                </div>
              </div>
              <div v-if="!commentsLoading && comments.length === 0" class="no-comments">
                No comments
              </div>


            </div>
          </div>
        </div>
      </div>

      <transition name="fade-arrow">
        <button v-if="canGoNext" class="nav-arrow next" @click.stop="triggerNext" title="Next image">
          ›
        </button>
      </transition>
      

    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDanbooruApi } from '../composables/useDanbooruApi';
import { useDText } from '../composables/useDText';

export default {
  name: 'ImageDetailModal',
  // ... props ...
  props: {
    post: {
      type: Object,
      required: true
    },
    hasPrev: {
      type: Boolean,
      default: false
    },
    hasNext: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'next', 'prev', 'search-tag', 'update-post'],
  setup(props, { emit }) {
    const router = useRouter();
    const { getPost, getTooglePostConfig, getPostComments, getArtist } = useDanbooruApi();
    const { parseDText } = useDText();
    
    // Pending Overlay Logic
    const showPendingOverlay = ref(true);

    const loading = ref(true);
    const comments = ref([]);
    const commentsLoading = ref(false);
    const commentsPage = ref(1);
    const hasMoreComments = ref(false);
    const COMMENTS_LIMIT = 20;
    
    // Ruffle logic
    const ruffleContainer = ref(null);
    let rufflePlayer = null;

    // Copy Link Logic
    const linkCopied = ref(false);
    
    const copyImageLink = async () => {
      const url = props.post.file_url || props.post.large_file_url || props.post.sample_url;
      if (!url) return;
      
      try {
        await navigator.clipboard.writeText(url);
        linkCopied.value = true;
        setTimeout(() => {
          linkCopied.value = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    };

    const downloading = ref(false);

    const downloadImage = async () => {
      if (downloading.value) return;
      
      const url = props.post.file_url || props.post.large_file_url;
      const filename = `danbooru-${props.post.id}.${props.post.file_ext}`;
      
      if (!url) return;

      downloading.value = true;
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.error("Download failed, falling back to new tab", e);
        window.open(url, '_blank');
      } finally {
        downloading.value = false;
      }
    };

    const handleImageError = (e) => {
      imageReady.value = true; // Treat error as ready to show fallback
      checkLoading();
      loading.value = false; // Ensure fallback shows
      const target = e.target;
      if (target) {
        // Simple fallback or hide
        target.style.opacity = '0.5';
      }
    };

    // Unified Loading Logic
    const imageReady = ref(false);
    const familyReady = ref(false);
    
    // Check if both are ready
    const checkLoading = () => {
      if (imageReady.value && familyReady.value) {
        loading.value = false;
      }
    };
    
    const onImageLoad = () => {
       imageReady.value = true;
       checkLoading();
    };

    const fetchComments = async (append = false) => {
      if (!props.post || !props.post.id) return;
      
      commentsLoading.value = true;
      if (!append) {
        comments.value = [];
        commentsPage.value = 1;
      }
      
      try {
        const res = await fetch(`https://danbooru.donmai.us/comments.json?group_by=comment&search[post_id]=${props.post.id}&limit=${COMMENTS_LIMIT}&page=${commentsPage.value}`);
        if (res.ok) {
          const newComments = await res.json();
          if (append) {
            comments.value = [...comments.value, ...newComments];
          } else {
            comments.value = newComments;
          }
          
          // If we got fewer items than limit, we've reached the end
          hasMoreComments.value = newComments.length === COMMENTS_LIMIT;
        }
      } catch (e) {
        console.error("Error fetching comments", e);
      } finally {
        commentsLoading.value = false;
      }
    };

    const loadMoreComments = () => {
      commentsPage.value++;
      fetchComments(true);
    };

    // Artist Commentary Logic
    const commentary = ref(null);
    const commentaryLoading = ref(false);

    const fetchCommentary = async () => {
      if (!props.post || !props.post.id) return;
      
      commentaryLoading.value = true;
      commentary.value = null;

      try {
        const res = await fetch(`https://danbooru.donmai.us/artist_commentaries.json?search[post_id]=${props.post.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            commentary.value = data[0];
          }
        }
      } catch (e) {
        console.error("Error fetching commentary", e);
      } finally {
        commentaryLoading.value = false;
      }
    };

    // Family Logic
    const familyPosts = ref([]);
    const familyLoading = ref(false);
    const currentRootId = ref(null);

    const fetchFamily = async () => {
       if (!props.post) return;

       let rootId = null;
       if (props.post.parent_id) {
         rootId = props.post.parent_id;
       } else if (props.post.has_children) {
         rootId = props.post.id;
       }

       if (!rootId) {
         familyPosts.value = [];
         currentRootId.value = null;
         familyReady.value = true;
         checkLoading();
         return;
       }

       if (rootId === currentRootId.value && familyPosts.value.length > 0) {
          familyReady.value = true; 
          checkLoading();
          return;
       }

       familyPosts.value = [];
       currentRootId.value = rootId;
       familyLoading.value = true;
       
       try {
         const tags = `~parent:${rootId} ~id:${rootId}`;
         const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tags)}&limit=20`);
         if (res.ok) {
           let data = await res.json();
           familyPosts.value = data
            .filter(p => p.file_url || p.large_file_url || p.preview_file_url)
            .sort((a, b) => a.id - b.id);
         }
       } catch (e) {
         console.error("Error fetching family", e);
         familyPosts.value = [];
         currentRootId.value = null;
       } finally {
         familyLoading.value = false;
         familyReady.value = true;
         checkLoading();
       }
    };



    const formatFileSize = (bytes) => {
      if (!bytes) return 'N/A';
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatRating = (rating) => {
      const map = {
        'g': 'General',
        's': 'Safe',
        'q': 'Questionable',
        'e': 'Explicit'
      };
      return map[rating] || rating;
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString();
    };

    const splitTags = (str) => str ? str.split(' ').filter(t => t) : [];

    const artistTags = computed(() => splitTags(props.post.tag_string_artist));
    const copyrightTags = computed(() => splitTags(props.post.tag_string_copyright));
    const characterTags = computed(() => splitTags(props.post.tag_string_character));
    const generalTags = computed(() => splitTags(props.post.tag_string_general));

    const isVideo = computed(() => {
      const ext = props.post.file_ext;
      if (['mp4', 'webm', 'gifv'].includes(ext)) return true;
      if (ext === 'zip' && props.post.large_file_url && props.post.large_file_url.endsWith('.webm')) {
        return true;
      }
      return false;
    });

    const isFlash = computed(() => {
      return props.post.file_ext === 'swf';
    });

    const loadRuffle = () => {
      if (!isFlash.value) return;

      requestAnimationFrame(() => {
        if (!ruffleContainer.value) return;
        
        ruffleContainer.value.innerHTML = '';
        
        if (window.RufflePlayer) {
          const ruffle = window.RufflePlayer.newest();
          rufflePlayer = ruffle.createPlayer();
          ruffleContainer.value.appendChild(rufflePlayer);
          
          rufflePlayer.load(props.post.file_url || props.post.large_file_url);
          loading.value = false;
        } else {
          console.error("Ruffle not loaded");
          ruffleContainer.value.innerHTML = '<div style="color:white">Player script missing.</div>';
          loading.value = false;
        }
      });
    };

    watch(() => props.post.id, async () => {
       showPendingOverlay.value = true; // Reset overlay visibility
       imageReady.value = false;
       familyReady.value = false;
       
       if (isFlash.value) {
          imageReady.value = true;
          loadRuffle();
       } else {
         if (ruffleContainer.value) ruffleContainer.value.innerHTML = '';
       }

       fetchComments(false);
       fetchCommentary();
       fetchFamily();
    }, { immediate: true });

    onMounted(() => {
       if (isFlash.value) {
          setTimeout(() => loadRuffle(), 100);
       }
       window.addEventListener('keydown', handleKeydown);
       document.body.style.overflow = 'hidden'; 
    });

    const getExtensionClass = (ext) => {
      if (!ext) return "";
      const imageExts = ["jpg", "jpeg", "png", "bmp", "tiff", "webp"];
      const videoExts = ["mp4", "webm", "avi", "mov", "zip", "rar"];
      const animatedExts = ["gif"];
      const flashExts = ["swf"];

      if (imageExts.includes(ext.toLowerCase())) return "format-image";
      if (videoExts.includes(ext.toLowerCase())) return "format-video";
      if (animatedExts.includes(ext.toLowerCase())) return "format-animated";
      if (flashExts.includes(ext.toLowerCase())) return "format-flash";
      return "";
    };

    const transitionName = ref('fade');

    const canGoNext = computed(() => props.hasNext);
    const canGoPrev = computed(() => props.hasPrev);

    const triggerNext = () => {
        if (props.hasNext) {
            transitionName.value = 'fade';
            emit('next');
        }
    };

    const triggerPrev = () => {
        if (props.hasPrev) {
            transitionName.value = 'fade';
            emit('prev');
        }
    };
    
    const handleBannerClick = (post) => {
        transitionName.value = 'fade'; 
        emit('update-post', post);
    };

       // Artist Info Navigation
    const openArtistInfo = (tag) => {
        emit('close'); // Close modal
        router.push({ name: 'wiki', params: { query: tag } });
    };
    // Helper to navigate to wiki
    const goToWiki = (page) => {
        emit('close'); // Close modal
        router.push({ name: 'wiki', params: { query: page } });
    };
    
    const handleKeydown = (e) => {
      if (e.key === 'Escape') emit('close');
      if (e.key === 'ArrowRight') triggerNext();
      if (e.key === 'ArrowLeft') triggerPrev();
    };

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    });

    return {
      loading,
      handleImageError,
      formatFileSize,
      formatRating,
      formatDate,
      artistTags,
      copyrightTags,
      characterTags,
      generalTags,
      isVideo,
      comments,
      commentsLoading,
      hasMoreComments,
      loadMoreComments,
      copyImageLink,
      linkCopied,
      downloadImage,
      downloading,
      getExtensionClass,
      isFlash,
      ruffleContainer,
      commentary,
      commentaryLoading,
      familyPosts,
      familyLoading,
      onImageLoad,
      transitionName,
      canGoNext,
      canGoPrev,
      triggerNext,
      triggerPrev,
      handleBannerClick,
      openArtistInfo,
      goToWiki,
      showPendingOverlay,
      parseDText
    };

  }
}
</script>

<style scoped>
/* Previous Styles... */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(15px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.modal-container {
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  background: rgba(20, 20, 28, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(90deg);
}

.modal-content {
  display: flex;
  height: 100%;
}

.main-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Fix flex overflow */
    background: rgba(0, 0, 0, 0.3);
}

/* Relationship Banner */
.relationship-banner {
    background: #332b00; /* Darker yellow/brown theme */
    border-bottom: 1px solid #665c00;
    padding: 10px;
    flex-shrink: 0;
}

.family-info {
    font-size: 13px;
    color: #e2e8f0;
    margin-bottom: 8px;
}

.family-info strong {
    color: #ffd700;
}

.family-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 5px;
}

.family-scroll::-webkit-scrollbar { height: 6px; }
.family-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

.family-thumb {
    width: 60px;
    height: 60px;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    flex-shrink: 0;
    opacity: 0.6;
    transition: all 0.2s;
}

.family-thumb:hover {
    opacity: 1;
}

.family-thumb.active {
    border-color: #ffd700;
    opacity: 1;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.family-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Image Section */
.image-section {
  flex: 1;
  /* background: rgba(0, 0, 0, 0.3); Removed as parent has it */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* Simple fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide down transition for relationship banner */
.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.2s ease-in;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
  max-height: 0;
}

.slide-down-enter-to {
  opacity: 1;
  transform: translateY(0);
  max-height: 200px;
}

.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 200px;
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
  max-height: 0;
}

/* Fade transition for navigation arrows */
.fade-arrow-enter-active,
.fade-arrow-leave-active {
  transition: all 0.25s ease;
}

.fade-arrow-enter-from,
.fade-arrow-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.fade-arrow-enter-to,
.fade-arrow-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* Artist Commentary */
.commentary-section {
  margin-bottom: 25px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(167, 139, 250, 0.1);
}

.commentary-section h3 {
  font-size: 11px;
  text-transform: uppercase;
  color: #a78bfa;
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.commentary-content h4 {
  font-size: 13px;
  color: #fff;
  margin: 0 0 6px 0;
}

.commentary-body {
  font-size: 13px;
  color: #e2e8f0;
  line-height: 1.5;
  word-wrap: break-word; /* Ensure text wraps */
  overflow-wrap: break-word;
}

.commentary-body :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.commentary-body :deep(a):hover {
  text-decoration: underline;
}

.ruffle-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.ruffle-container :deep(ruffle-player) {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}

.detail-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.pending-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
  background: rgba(245, 158, 11, 0.9);
  backdrop-filter: blur(8px);
  padding: 8px 14px;
  border-radius: 30px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.2s;
}

.pending-overlay:hover {
  background: rgba(245, 158, 11, 1);
  transform: translateY(1px);
}

.pending-overlay .separator {
  opacity: 0.5;
}

.overlay-link {
  color: #fff;
  text-decoration: underline;
  cursor: pointer;
  opacity: 0.9;
}

.overlay-link:hover {
  opacity: 1;
}

.overlay-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
  margin-left: 6px;
  cursor: pointer;
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-close:hover {
  opacity: 1;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}

.info-sidebar {
  width: 350px;
  background: rgba(30, 30, 40, 0.8);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
}

.info-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 50px; /* Keep space for close button visual separation */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  flex-wrap: wrap; /* Allow wrapping for badges */
}

.post-id {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.status-indicators-modal {
    display: flex;
    gap: 6px;
}

/* Copied from PostGallery for consistency */
.status-badge {
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  color: white;
  text-transform: uppercase;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.status-badge.pending { background: rgba(217, 119, 6, 0.9); color: #fff; }
.status-badge.deleted { background: rgba(220, 38, 38, 0.9); color: #fff; }
.status-badge.flagged { background: rgba(147, 51, 234, 0.9); color: #fff; }

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 16px;
  transition: all 0.2s;
  cursor: pointer;
}

.action-btn:hover {
  background: #a78bfa;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
}

.action-btn.copied {
  background: #4ade80;
  border-color: #4ade80;
  color: #0f172a;
}

.action-btn.disabled {
  opacity: 0.7;
  cursor: not-allowed;
  pointer-events: none;
}



.scrollable-info {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Custom Scrollbar */
.scrollable-info::-webkit-scrollbar { width: 6px; }
.scrollable-info::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 30px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-item .label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-item .value {
  font-size: 14px;
  color: #e2e8f0;
  font-weight: 500;
}

.rating-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  width: fit-content;
}

.rating-pill.g { color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.2); background: rgba(96, 165, 250, 0.1); }
.rating-pill.s { color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.2); background: rgba(74, 222, 128, 0.1); }
.rating-pill.q { color: #facc15; border: 1px solid rgba(250, 204, 21, 0.2); background: rgba(250, 204, 21, 0.1); }
.rating-pill.e { color: #f87171; border: 1px solid rgba(248, 113, 113, 0.2); background: rgba(248, 113, 113, 0.1); }

.rating-pill.format {
  font-weight: 700;
  letter-spacing: 0.5px;
}

.format-image { color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.2); }
.format-video { color: #a78bfa; border: 1px solid rgba(167, 139, 250, 0.2); }
.format-animated { color: #34d399; border: 1px solid rgba(52, 211, 153, 0.2); }
.format-flash { color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }

.tags-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.tag-group h3 {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 5px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-icon-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a78bfa;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  height: 100%; /* Match tag height if possible */
}

.info-icon-btn:hover {
  background: #a78bfa;
  color: #fff;
  border-color: #a78bfa;
  transform: translateY(-1px);
}

.tag {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  transition: all 0.2s;
  word-break: break-word; /* Allow lazy wrapping */
  white-space: normal;    /* Ensure it wraps */
  line-height: 1.4;       /* Improve readability when wrapped */
  text-align: left;       /* Ensure left align */
}

.tag:hover {
  background: rgba(255,255,255,0.1);
}

.tag.artist { color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.2); }
.tag.character { color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.2); }
.tag.copyright { color: #d8b4fe; border: 1px solid rgba(216, 180, 254, 0.2); }
.tag.general { color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }

/* Comments Section Styles */
.comments-section {
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 20px;
  margin-bottom: 20px;
}

/* List Transitions for Comments */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.comments-section h3 {
  font-size: 14px;
  margin-bottom: 15px;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.comment-item {
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
}

.comment-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11px;
  color: #64748b;
}

.comment-author {
  color: #a78bfa;
  font-weight: 600;
}

.comment-score {
  font-weight: 600;
  color: #94a3b8;
  font-size: 10px;
  background: rgba(0,0,0,0.3);
  padding: 1px 6px;
  border-radius: 4px;
}

.comment-score.positive { text-shadow: 0 0 10px rgba(74, 222, 128, 0.2); color: #4ade80; }
.comment-score.negative { color: #f87171; }

.comment-body {
  color: #cbd5e1;
  line-height: 1.5;
  word-wrap: break-word;
}

.comment-body :deep(blockquote) {
  margin: 6px 0;
  padding: 6px 10px;
  border-left: 2px solid #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  color: #c4b5fd;
  font-style: italic;
  font-size: 12px;
}

.comment-text :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.comment-text :deep(a):hover {
  text-decoration: underline;
}

/* DText Styles */
.comment-text :deep(.dtext-quote), .commentary-content :deep(.dtext-quote) {
    border-left: 3px solid #a78bfa;
    padding-left: 10px;
    margin: 10px 0;
    color: #94ab38;
    background: rgba(255,255,255,0.05);
    padding: 10px;
    border-radius: 4px;
}

.comment-text :deep(.dtext-code), .commentary-content :deep(.dtext-code) {
    background: #000;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
}

.comment-text :deep(.dtext-link), .commentary-content :deep(.dtext-link) {
    color: #38bdf8;
    text-decoration: none;
}

.comment-text :deep(.dtext-link):hover, .commentary-content :deep(.dtext-link):hover {
    text-decoration: underline;
}

.comment-text :deep(strong), .commentary-content :deep(strong) { color: #fff; }
.comment-text :deep(em), .commentary-content :deep(em) { color: #ddd; }

.no-comments {
  color: #64748b;
  font-size: 13px;
  font-style: italic;
  text-align: center;
  padding: 10px;
}

.meta-footer {
  margin-top: 30px;
  font-size: 12px;
  color: #64748b;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 15px;
}

.source-link {
  color: #a78bfa;
  text-decoration: none;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.source-link:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .modal-backdrop {
    padding: 0;
  }

  .modal-container {
    height: 100%;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    border: none;
  }
  
  .modal-content {
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; 
  }
  
  .image-section {
    min-height: 40vh;
    max-height: 60vh;
    padding: 10px;
    background: #000;
    flex-shrink: 0;
  }
  
  .info-sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    flex: none; /* Don't force fit, let it grow */
    height: auto;
    display: block;
  }

  .scrollable-info {
    overflow-y: visible;
    padding-bottom: 80px; 
  }
  
  .info-header {
    padding-top: 20px; 
  }
  
  .nav-arrow {
    position: fixed; /* Fix to viewport */
    top: auto;
    bottom: 30px;
    transform: none;
    width: 56px;
    height: 56px;
    font-size: 28px;
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.15);
  }
  
  .nav-arrow.prev { left: 20px; margin: 0; }
  .nav-arrow.next { right: 20px; margin: 0; }
  
  /* Active state for touch feedback */
  .nav-arrow:active {
    transform: scale(0.95);
    background: #a78bfa;
  }
}

/* Animations */
/* ... existing animations ... */
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Nav Arrows */
.nav-arrow {
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1010;
  padding-bottom: 4px; /* Fix visual center */
}

.nav-arrow:hover {
  background: rgba(167, 139, 250, 0.8);
  transform: scale(1.1);
}

.nav-arrow.prev {
  margin-right: 20px;
}

.nav-arrow.next {
  margin-left: 20px;
}

/* Close btn adjustment */
.close-btn {
  top: 15px;
  right: 15px; 
}

/* Image Loader */
.image-loader {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: #a78bfa;
  animation: spin 1s linear infinite;
}

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 15px;
}

.load-more-btn {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.3);
  color: #c084fc;
  font-size: 12px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.load-more-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  border-color: #a78bfa;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.mini-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(192, 132, 252, 0.3);
  border-top-color: #c084fc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.lni-is-spinning {
  animation: spin 1s infinite linear;
}
</style>
