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
                  <div class="commentary-body" v-html="formatCommentBody(commentary.original_description)"></div>
                </div>
              </div>

              <!-- Tags Section -->
              <div class="tags-section">
                <!-- Artist Tags -->
                <div v-if="artistTags.length" class="tag-group">
                  <h3>Artists</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in artistTags" 
                      :key="tag" 
                      class="tag artist"
                      @click="$emit('search-tag', tag)"
                      title="Search by artist"
                    >{{ tag }}</span>
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
                    <div class="comment-body" v-html="formatCommentBody(comment.body)"></div>
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

export default {
  name: 'ImageDetailModal',
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
    const currentRootId = ref(null); // Track current root to prevent refetching

    const fetchFamily = async () => {
       if (!props.post) return;

       // Determine root ID
       let rootId = null;
       if (props.post.parent_id) {
         rootId = props.post.parent_id;
       } else if (props.post.has_children) {
         rootId = props.post.id;
       }

       // Checks if we need to fetch
       if (!rootId) {
         familyPosts.value = [];
         currentRootId.value = null;
         familyReady.value = true; // Nothing to fetch
         checkLoading();
         return;
       }

       // If same family, just return (don't clear, don't refetch)
       // This prevents flickering when navigating between siblings
       if (rootId === currentRootId.value && familyPosts.value.length > 0) {
          familyReady.value = true; // Already have data
          checkLoading();
          return;
       }

       familyPosts.value = [];
       currentRootId.value = rootId;
       familyLoading.value = true;
       
       try {
         // Search for parent OR siblings
         // variants: ~parent:123 ~id:123
         const tags = `~parent:${rootId} ~id:${rootId}`;
         const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tags)}&limit=20`); // Limit 20 for preview
         if (res.ok) {
           let data = await res.json();
           
           // Filter invalid posts (must have image URL)
           familyPosts.value = data
            .filter(p => p.file_url || p.large_file_url || p.preview_file_url)
            .sort((a, b) => a.id - b.id);
         }
       } catch (e) {
         console.error("Error fetching family", e);
         familyPosts.value = [];
         currentRootId.value = null; // Reset on error so we can try again
       } finally {
         familyLoading.value = false;
         familyReady.value = true;
         checkLoading();
       }
    };



    const formatCommentBody = (body) => {
      if (!body) return '';
      let formatted = body
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      formatted = formatted.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>');
      formatted = formatted.replace(/\n/g, '<br>');
      formatted = formatted.replace(/post #(\d+)/gi, '<a href="https://danbooru.donmai.us/posts/$1" target="_blank">post #$1</a>');
      formatted = formatted.replace(/"(.*?)"\:\[(.*?)\]/g, '<a href="$2" target="_blank">$1</a>');
      
      // Handle {{tag}}
      formatted = formatted.replace(/\{\{(.*?)\}\}/g, '<a href="https://danbooru.donmai.us/posts?tags=$1" target="_blank">$1</a>');
      
      // Handle [[wiki]] or [[wiki|label]]
      formatted = formatted.replace(/\[\[(.*?)\]\]/g, (match, content) => {
        const [page, text] = content.split('|');
        return `<a href="https://danbooru.donmai.us/wiki_pages/${page}" target="_blank">${text || page}</a>`;
      });
      
      return formatted;
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
      // Handle Ugoira (ZIP) that has a converted video url
      if (ext === 'zip' && props.post.large_file_url && props.post.large_file_url.endsWith('.webm')) {
        return true;
      }
      return false;
    });

    const isFlash = computed(() => {
      return props.post.file_ext === 'swf';
    });

    // Initialize Ruffle
    const loadRuffle = () => {
      if (!isFlash.value) return;

      requestAnimationFrame(() => {
        if (!ruffleContainer.value) return;
        
        // Limpiar anterior
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

    // Watch for post changes to re-fetch comments, commentary AND family
    watch(() => props.post.id, async () => {
       // Reset ready states (but don't force loading spinner)
       imageReady.value = false;
       familyReady.value = false;
       
       // Handle special cases
       if (isFlash.value) {
          imageReady.value = true;
          loadRuffle();
       } else {
         // Clear ruffle if needed
         if (ruffleContainer.value) ruffleContainer.value.innerHTML = '';
       }

       fetchComments(false);
       fetchCommentary();
       fetchFamily();
    }, { immediate: true });


    // Initial load
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

    // Navigation Logic
    const transitionName = ref('fade');

    const canGoNext = computed(() => {
        if (familyPosts.value.length > 0) {
            const idx = familyPosts.value.findIndex(p => p.id === props.post.id);
            if (idx !== -1 && idx < familyPosts.value.length - 1) return true;
        }
        return props.hasNext;
    });

    const canGoPrev = computed(() => {
        if (familyPosts.value.length > 0) {
            const idx = familyPosts.value.findIndex(p => p.id === props.post.id);
            if (idx > 0) return true;
        }
        return props.hasPrev;
    });

    const triggerNext = () => {
        // Priority 1: Standard gallery navigation (if available)
        if (props.hasNext) {
            transitionName.value = 'fade';
            emit('next');
            return;
        }
        
        // Priority 2: Family navigation (only if no standard next available)
        if (familyPosts.value.length > 0) {
            const idx = familyPosts.value.findIndex(p => p.id === props.post.id);
            if (idx !== -1 && idx < familyPosts.value.length - 1) {
                transitionName.value = 'fade'; // Enable smooth transition for family
                emit('update-post', familyPosts.value[idx + 1]);
                return;
            }
        }
    };

    const triggerPrev = () => {
        // Priority 1: Standard gallery navigation (if available)
        if (props.hasPrev) {
            transitionName.value = 'fade';
            emit('prev');
            return;
        }
        
        // Priority 2: Family navigation (only if no standard prev available)
        if (familyPosts.value.length > 0) {
            const idx = familyPosts.value.findIndex(p => p.id === props.post.id);
            if (idx > 0) {
               transitionName.value = 'fade'; // Enable smooth transition for family
               emit('update-post', familyPosts.value[idx - 1]);
               return;
            }
        }
    };
    
    // Handle banner click
    const handleBannerClick = (post) => {
        transitionName.value = 'fade'; // Enable smooth transition for banner clicks
        emit('update-post', post);
    };

    // Handle Esc key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') emit('close');
      if (e.key === 'ArrowRight') triggerNext();
      if (e.key === 'ArrowLeft') triggerPrev();
    };

    onMounted(() => {
      // Logic moved up to handle Ruffle
    });

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
      formatCommentBody,
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
      handleBannerClick
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
  gap: 15px;
}

.post-id {
  margin: 0;
  font-size: 20px;
  color: #fff;
}

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

.tag {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  transition: all 0.2s;
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

.comment-body :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.comment-body :deep(a):hover {
  text-decoration: underline;
}

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
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    font-size: 24px;
    background: rgba(0,0,0,0.6);
  }
  
  .nav-arrow.prev { left: 10px; margin: 0; }
  .nav-arrow.next { right: 10px; margin: 0; }
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
