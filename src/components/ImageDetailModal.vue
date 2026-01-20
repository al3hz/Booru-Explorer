<template>
    <div class="modal-backdrop">
      <!-- Fullscreen Zoom Overlay (Mobile) -->
      <transition name="fade">
        <div 
          v-if="isMobileFullscreen" 
          class="fullscreen-zoom-overlay"
          @touchstart.stop="onZoomTouchStart"
          @touchmove.stop="onZoomTouchMove"
          @touchend.stop="onZoomTouchEnd"
        >
          <button class="fullscreen-close" @click.stop="toggleMobileFullscreen">×</button>
          
          <transition :name="transitionName" mode="out-in">
            <VideoPlayer
              v-if="isVideo && mediaSource"
              :key="`fs-vid-${post.id}`"
              :src="mediaSource"
              class="fullscreen-image"
              :autoplay="true"
              :controls="true"
              @click.stop
            />
            <img 
              v-else
              :key="`fs-img-${post.id}`"
              :src="mediaSource" 
              class="fullscreen-image"
              :style="{ transform: `scale(${imageScale}) translate(${translateX / imageScale}px, ${translateY / imageScale}px)` }"
              alt="Fullscreen view"
            />
          </transition>
        </div>
      </transition>
      <!-- Nav Buttons -->
      <transition name="fade-arrow">
        <button v-if="canGoPrev && !isMobileFullscreen" class="nav-arrow prev" @click.stop="triggerPrev" title="Previous image">
          ‹
        </button>
      </transition>
      
      <div class="modal-container">
        <!-- Close Button Moved Inside but better positioned -->
        <button class="close-btn" @click="$emit('close')">×</button>
        
        <!-- Loading Next Page Overlay -->
        <transition name="fade">
          <div v-if="isLoadingNextPage" class="loading-page-overlay">
            <div class="loading-content">
              <div class="loader-spinner-large"></div>
              <p class="loading-text">Loading next page...</p>
            </div>
          </div>
        </transition>
        
        <div class="modal-content" ref="modalContent">
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
            <div 
              class="image-section"
              @touchstart="onTouchStart"
              @touchend="onTouchEnd"
            >
            
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
            
            <!-- Image Container with Notes -->
            <div class="image-wrapper" ref="imageContainer">
              <transition :name="transitionName" mode="out-in">
                <div v-if="isFlash" class="ruffle-container" ref="ruffleContainer"></div>
                <VideoPlayer
                  v-else-if="isVideo && mediaSource"
                  :key="`vid-${post.id}`"
                  :src="mediaSource"
                  class="detail-image"
                  @loaded="onImageLoad"
                  @error="handleImageError"
                  @click="toggleMobileFullscreen"
                />
                <img 
                  v-else
                  :key="`img-${post.id}`"
                  :src="mediaSource || post.preview_file_url" 
                  :alt="`Post ${post.id}`"
                  class="detail-image"
                  ref="imageElement"
                  @load="onImageLoad"
                  @error="handleImageError"
                  @click="toggleMobileFullscreen"
                />
              </transition>
              
              <!-- Interactive Notes Overlay -->
              <div v-if="notesEnabled && scaledNotes.length > 0 && !isVideo && !isFlash" class="notes-overlay">
                <div 
                  v-for="note in scaledNotes" 
                  :key="note.id" 
                  class="note-box"
                  :style="getNoteStyle(note)"
                  @mouseenter="hoveredNote = note"
                  @mouseleave="hoveredNote = null"
                  @touchstart.stop.prevent="toggleNote(note)"
                  @touchend.stop
                  @touchmove.stop
                >
                  <transition name="fade">
                    <div 
                      v-if="hoveredNote?.id === note.id" 
                      class="note-tooltip" 
                      :class="{ 
                        'bottom': note.isTopNote,
                        'left': note.isLeftNote && !note.isVertical,
                        'right': note.isRightNote && !note.isVertical,
                        'vertical-left': note.isVertical && note.isLeftNote,
                        'vertical-right': note.isVertical && !note.isLeftNote 
                      }"
                      v-html="note.body"
                    ></div>
                  </transition>
                </div>
              </div>

             <!-- Mobile Bottom Sheet (Reader Mode) -->
             <transition name="slide-up">
               <div v-if="hoveredNote" class="note-bottom-sheet" @click.stop>
                 <div class="sheet-header">
                   <span class="sheet-title">Translation</span>
                   <button class="sheet-close" @click="hoveredNote = null">×</button>
                 </div>
                 <div class="sheet-content" v-html="hoveredNote.body"></div>
               </div>
             </transition>
            </div>
            
          </div>

          </div>
          <!-- Info Sidebar -->
          <div class="info-sidebar">
            <div class="info-header">
              <div class="header-top-row">
                <h2 class="post-id">Post #{{ post.id }}</h2>
                <!-- Status Labels -->
                <div class="status-indicators-modal">
                    <span v-if="post.is_pending" class="status-badge pending">PENDING</span>
                    <span v-if="post.is_deleted" class="status-badge deleted">DELETED</span>
                    <span v-if="post.is_flagged" class="status-badge flagged">FLAGGED</span>
                </div>
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
                
                <!-- Reverse Image Search Dropdown -->
                <div class="reverse-search-dropdown">
                  <button 
                    @click="toggleSearchDropdown" 
                    class="action-btn search-trigger"
                    :class="{ 'active': searchDropdownOpen }"
                    title="Find Source"
                  >
                    <i class="lni lni-search-alt"></i>
                  </button>
                  
                  <transition name="dropdown-fade">
                    <div v-if="searchDropdownOpen" class="search-dropdown-menu">
                      <button 
                        @click="searchSauceNAO" 
                        class="search-option"
                        title="Search on SauceNAO"
                      >
                        <img src="https://saucenao.com/favicon.ico" alt="SauceNAO" class="service-icon">
                        <span>SauceNAO</span>
                      </button>
                      <button 
                        @click="searchIQDB" 
                        class="search-option"
                        title="Search on IQDB"
                      >
                        <img src="https://iqdb.org/favicon.ico" alt="IQDB" class="service-icon">
                        <span>IQDB</span>
                      </button>
                      <button 
                        @click="searchGoogle" 
                        class="search-option"
                        title="Search on Google Lens"
                      >
                        <img src="https://www.google.com/favicon.ico" alt="Google" class="service-icon">
                        <span>Google Lens</span>
                      </button>
                    </div>
                  </transition>
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
              <div class="commentary-wrapper">
                <transition name="fade-slide">
                  <div v-if="commentaryLoading" key="loading" class="commentary-section skeleton">
                    <h3>Artist Commentary</h3>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                  </div>
                  <div v-else-if="commentary" key="content" class="commentary-section">
                    <h3>Artist Commentary</h3>
                    <div class="commentary-content">
                      <h4 v-if="commentary.original_title">{{ commentary.original_title }}</h4>
                      <div class="commentary-body" v-html="parseDText(commentary.original_description)"></div>
                    </div>
                  </div>
                </transition>
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
        <button v-if="canGoNext && !isMobileFullscreen" class="nav-arrow next" @click.stop="triggerNext" title="Next image">
          ›
        </button>
      </transition>
      

    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { 
  usePostNotes, 
  usePostCommentary, 
  usePostFamily, 
  usePostComments 
} from '../composables/useDanbooruApi';
import { useDText } from '../composables/useDText';
import VideoPlayer from './VideoPlayer.vue';

export default {
  name: 'ImageDetailModal',
  components: { VideoPlayer },
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
    },
    isLoadingNextPage: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'next', 'prev', 'search-tag', 'update-post'],
  setup(props, { emit }) {
    const router = useRouter();
    const { parseDText } = useDText();
    
    onUnmounted(() => {
       if (resizeObserver) resizeObserver.disconnect();
    });
    
    // Pending Overlay Logic
    const showPendingOverlay = ref(true);
    
    // Core IDs for queries
    const postId = computed(() => props.post.id);
    const parentId = computed(() => props.post.parent_id);
    const hasChildren = computed(() => props.post.has_children);

    // TanStack Queries (Caching)
    const { data: notesData } = usePostNotes(postId);
    const { data: commentaryData, isLoading: commentaryLoading } = usePostCommentary(postId);
    const { data: familyData, isFetching: familyLoading, isSuccess: familyLoaded } = usePostFamily(postId, parentId, hasChildren);
    const { 
      data: commentsData, 
      fetchNextPage: loadMoreComments, 
      hasNextPage: hasMoreComments, 
      isFetching: commentsLoading 
    } = usePostComments(postId, 20);

    const notes = computed(() => notesData.value || []);
    const commentary = computed(() => commentaryData.value);
    const familyPosts = computed(() => familyData.value || []);
    const comments = computed(() => commentsData.value?.pages.flatMap(p => p) || []);

    const hoveredNote = ref(null);
    const imageElement = ref(null);
    const imageContainer = ref(null);
    const notesEnabled = ref(true);

    // Fetch notes when post changes


    // Reactive dimensions to track container resize (e.g. when banner appears)
    const containerDimensions = ref({ width: 0, height: 0 });
    let resizeObserver = null;

    // Calculate displayed image dimensions (accounting for object-fit: contain)
    const getImageDisplayDimensions = () => {
      const img = imageElement.value;
      const container = imageContainer.value;
      
      // Use reactive dimensions to trigger re-calc
      const cWidth = containerDimensions.value.width;
      const cHeight = containerDimensions.value.height;

      if (!img || !container || !props.post.image_width || !props.post.image_height || cWidth === 0 || cHeight === 0) {
        return { displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0, containerWidth: 0, containerHeight: 0 };
      }

      // Use the actual container dimensions from observer, fallback to DOM if needed (e.g. initial)
      const containerWidth = cWidth;
      const containerHeight = cHeight;
      
      const imgRatio = props.post.image_width / props.post.image_height;
      const containerRatio = containerWidth / containerHeight;

      let displayWidth, displayHeight, offsetX = 0, offsetY = 0;

      if (imgRatio > containerRatio) {
        // Image is wider - limited by width
        displayWidth = containerWidth;
        displayHeight = displayWidth / imgRatio;
        offsetY = (containerHeight - displayHeight) / 2;
      } else {
        // Image is taller - limited by height
        displayHeight = containerHeight;
        displayWidth = displayHeight * imgRatio;
        offsetX = (containerWidth - displayWidth) / 2;
      }

      return { displayWidth, displayHeight, offsetX, offsetY, containerWidth, containerHeight };
    };

    // Scale notes to match displayed image
    const scaledNotes = computed(() => {
      if (!notes.value.length || !imageReady.value || !props.post.image_width) {
        return [];
      }

      const { displayWidth, displayHeight, offsetX, offsetY, containerWidth, containerHeight } = getImageDisplayDimensions();
      
      if (displayWidth === 0 || displayHeight === 0) return [];

      const scaleX = displayWidth / props.post.image_width;
      const scaleY = displayHeight / props.post.image_height;

      return notes.value.map(note => {
        const sX = note.x * scaleX + offsetX;
        const sY = note.y * scaleY + offsetY;
        const sW = note.width * scaleX;
        const sH = note.height * scaleY;
        
        // Detect Vertical Note (common in manga)
        const isVertical = sH > (sW * 2) && sH > 100;
        
        // Dynamic thresholds based on container width
        // On mobile (small width), be more aggressive with side alignment
        const isMobile = containerWidth < 768;
        const sideThreshold = isMobile ? 120 : 180; // Tooltip min-width is ~150px
        
        // For Vertical Notes: Prefer Left/Right if space permits
        let isLeft = sX < sideThreshold;
        let isRight = (containerWidth - (sX + sW)) < sideThreshold;
        
           if (isVertical) {
              // If vertical, force side unless completely blocked
              // Prefer the side with MORE space
              const spaceRight = containerWidth - (sX + sW);
              
              if (spaceRight > 160) {
                 isRight = false; 
              }
           }

        return {
          ...note,
          scaledX: sX,
          scaledY: sY,
          scaledWidth: sW,
          scaledHeight: sH,
          isVertical,
          isTopNote: sY < 150 && !isVertical, // Don't force bottom if it's a huge vertical strip
          isBottomNote: ((sY + sH) > (containerHeight - 100)), 
          isLeftNote: isLeft, 
          isRightNote: isRight
        };
      });
    });

    const getNoteStyle = (note) => ({
      left: `${note.scaledX}px`,
      top: `${note.scaledY}px`,
      width: `${note.scaledWidth}px`,
      height: `${note.scaledHeight}px`
    });

    const toggleNotes = () => {
      notesEnabled.value = !notesEnabled.value;
    };

    const toggleNote = (note) => {
      // Toggle note selection for mobile tap
      if (hoveredNote.value?.id === note.id) {
        hoveredNote.value = null; // Close if tapping same note
      } else {
        hoveredNote.value = note; // Open new note
      }
    };

    const loading = ref(true);
    
    // Safety timeout for loading
    let loadingTimeout = null;
    
    // Ruffle logic
    const ruffleContainer = ref(null);
    let rufflePlayer = null;

    // Scroll container ref
    const modalContent = ref(null);

    // Reset scroll position when post changes
    watch(() => props.post?.id, () => {
      if (modalContent.value) {
        modalContent.value.scrollTop = 0;
      }
    });

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

    // Reverse Image Search Dropdown
    const searchDropdownOpen = ref(false);
    
    const toggleSearchDropdown = () => {
      searchDropdownOpen.value = !searchDropdownOpen.value;
    };

    // Reverse Image Search Functions
    const searchSauceNAO = () => {
      const imageUrl = encodeURIComponent(mediaSource.value || props.post.preview_file_url);
      window.open(`https://saucenao.com/search.php?url=${imageUrl}`, '_blank', 'noopener,noreferrer');
      searchDropdownOpen.value = false;
    };

    const searchIQDB = () => {
      const imageUrl = encodeURIComponent(mediaSource.value || props.post.preview_file_url);
      window.open(`https://iqdb.org/?url=${imageUrl}`, '_blank', 'noopener,noreferrer');
      searchDropdownOpen.value = false;
    };

    const searchGoogle = () => {
      const imageUrl = encodeURIComponent(mediaSource.value || props.post.preview_file_url);
      window.open(`https://lens.google.com/uploadbyurl?url=${imageUrl}`, '_blank', 'noopener,noreferrer');
      searchDropdownOpen.value = false;
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
    
    // Check if both are ready
    const checkLoading = () => {
      // familyReady should now reflect the family query's success if post has family
      const hasFamily = !!props.post.parent_id || !!props.post.has_children;
      const isFamilyReady = hasFamily ? familyLoaded.value : true;

      if (imageReady.value && isFamilyReady) {
        loading.value = false;
      }
    };
    
    // Watch for familyLoaded to trigger checkLoading
    watch(familyLoaded, (isLoaded) => {
      if (isLoaded) checkLoading();
    });
    
    const onImageLoad = () => {
       imageReady.value = true;
       checkLoading();
    };

    // No manual fetchers needed anymore, hooks handle it



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

    // Smart media source selection
    const mediaSource = computed(() => {
      // For ZIP files (Ugoira animations), browsers can't play the ZIP directly
      // Use the converted video (large_file_url) instead
      if (props.post.file_ext === 'zip') {
        return props.post.large_file_url || props.post.file_url || '';
      }
      // For everything else, prioritize original quality
      return props.post.file_url || props.post.large_file_url || '';
    });

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
       // Reset UI State IMMEDIATELY
       showPendingOverlay.value = true;
       
       // Safety Timeout: Force stop loading after 5s if metadata hangs
       if (loadingTimeout) clearTimeout(loadingTimeout);
       loading.value = true; 
       loadingTimeout = setTimeout(() => {
          if (loading.value) {
             console.warn("Content loading timed out - forcing display");
             loading.value = false;
          }
       }, 5000);

       imageReady.value = false;
       // familyReady is now handled by the familyLoaded query status
       
       if (isFlash.value) {
          imageReady.value = true;
          loadRuffle();
       } else {
         if (ruffleContainer.value) ruffleContainer.value.innerHTML = '';
       }

       // No manual fetch calls here, queries react to newId
    }, { immediate: true });

    onMounted(() => {
       if (isFlash.value) {
          setTimeout(() => loadRuffle(), 100);
       }
       window.addEventListener('keydown', handleKeydown);
       
       // Observe container checks
       if (imageContainer.value) {
          resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
               containerDimensions.value = {
                 width: entry.contentRect.width,
                 height: entry.contentRect.height
               };
            }
          });
          resizeObserver.observe(imageContainer.value);
       }
       
       // Close dropdown when clicking outside
       document.addEventListener('click', (e) => {
         if (!e.target.closest('.reverse-search-dropdown')) {
           searchDropdownOpen.value = false;
         }
       });
       
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
            loading.value = true;
            imageReady.value = false;
            transitionName.value = 'fade';
            emit('next');
        }
    };

    const triggerPrev = () => {
        if (props.hasPrev) {
            loading.value = true;
            imageReady.value = false;
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
    
    // Swipe Logic for Mobile
    const touchStartX = ref(0);
    const touchEndX = ref(0);
    const SWIPE_THRESHOLD = 50;

    const onTouchStart = (e) => {
      touchStartX.value = e.changedTouches[0].screenX;
    };

    const onTouchEnd = (e) => {
      touchEndX.value = e.changedTouches[0].screenX;
      handleSwipe();
    };

    // Mobile Fullscreen & Zoom Logic
    const isMobileFullscreen = ref(false);
    const imageScale = ref(1);
    const lastTouchDistance = ref(0);
    const initialScale = ref(1);
    
    // Pan state
    const translateX = ref(0);
    const translateY = ref(0);
    const lastPanX = ref(0);
    const lastPanY = ref(0);

    const toggleMobileFullscreen = () => {
      if (isMobileFullscreen.value) {
        closeMobileFullscreen();
        return;
      }
      
      // Only allow fullscreen for images and GIFs on mobile, NOT videos
      // Videos should use their own fullscreen controls
      if (window.innerWidth <= 768 && !isFlash.value && !isVideo.value) {
        isMobileFullscreen.value = true;
        document.body.style.overflow = 'hidden'; 
        // Reset zoom state on open
        resetZoom();
      }
    };

    const closeMobileFullscreen = () => {
      isMobileFullscreen.value = false;
      resetZoom();
      // Restore previous overflow state (handled by onUnmounted or watcher typically)
    };

    const resetZoom = () => {
      imageScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    };

    const getDistance = (touches) => {
      return Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
    };

    const onZoomTouchStart = (e) => {
      if (e.touches.length === 2) {
        lastTouchDistance.value = getDistance(e.touches);
        initialScale.value = imageScale.value;
      } else if (e.touches.length === 1) {
        lastPanX.value = e.touches[0].pageX;
        lastPanY.value = e.touches[0].pageY;
        // Capture start for swipe detection
        touchStartX.value = e.touches[0].screenX;
      }
    };

    const onZoomTouchMove = (e) => {
      if (e.touches.length === 2) {
        // Pinch Zoom
        const dist = getDistance(e.touches);
        const delta = dist / lastTouchDistance.value;
        const newScale = initialScale.value * delta;
        // Limit zoom levels
        imageScale.value = Math.min(Math.max(1, newScale), 5); 
        e.preventDefault(); // Prevent page scroll
      } else if (e.touches.length === 1 && imageScale.value > 1) {
        // Pan (only when zoomed in)
        const deltaX = e.touches[0].pageX - lastPanX.value;
        const deltaY = e.touches[0].pageY - lastPanY.value;
        
        translateX.value += deltaX;
        translateY.value += deltaY;
        
        lastPanX.value = e.touches[0].pageX;
        lastPanY.value = e.touches[0].pageY;
        e.preventDefault();
      }
    };
    
    const onZoomTouchEnd = (e) => {
       if (imageScale.value < 1.1) {
         resetZoom(); 
       }
       // Capture end for swipe detection
       if (e.changedTouches.length > 0) {
         touchEndX.value = e.changedTouches[0].screenX;
         handleSwipe();
       }
    };
    
    // Update handleSwipe to work in fullscreen IF not zoomed
    const handleSwipe = () => {
      // Disable swipe completely for videos in fullscreen
      if (isMobileFullscreen.value && isVideo.value) return;
      
      // If fullscreen and zoomed in (> 1.1), don't swipe nav
      if (isMobileFullscreen.value && imageScale.value > 1.1) return;

      const diff = touchStartX.value - touchEndX.value;
      if (Math.abs(diff) > SWIPE_THRESHOLD) {
         if (diff > 0) triggerNext();
         else triggerPrev();
      }
    };

    const handleKeydown = (e) => {
      if (isMobileFullscreen.value && e.key === 'Escape') {
         closeMobileFullscreen();
         return;
      }
      if (e.key === 'Escape') emit('close');
      // ...
      if (!isMobileFullscreen.value) {
         if (e.key === 'ArrowRight') triggerNext();
         if (e.key === 'ArrowLeft') triggerPrev();
      }
    };

    onUnmounted(() => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
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
      mediaSource,
      isVideo,
      comments,
      commentsLoading,
      hasMoreComments,
      loadMoreComments,
      copyImageLink,
      linkCopied,
      downloadImage,
      downloading,
      searchDropdownOpen,
      toggleSearchDropdown,
      searchSauceNAO,
      searchIQDB,
      searchGoogle,
      getExtensionClass,
      isFlash,
      ruffleContainer,
      modalContent,
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
      parseDText,
      onTouchStart,
      onTouchEnd,
      toggleMobileFullscreen,
      isMobileFullscreen,
      imageScale,
      onZoomTouchStart,
      onZoomTouchMove,
      onZoomTouchEnd,
      resetZoom,
      translateX,
      translateY,
      // Notes
      notes,
      hoveredNote,
      scaledNotes,
      getNoteStyle,
      toggleNotes,
      toggleNote,
      notesEnabled,
      imageElement,
      imageContainer
    };
  }
}
</script>

<style scoped>
/* Fullscreen Zoom Overlay */
.fullscreen-zoom-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: black;
  z-index: 1002;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.fullscreen-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.1s ease-out; /* Smooth zoom */
  will-change: transform;
}

.fullscreen-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0,0,0,0.5);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 24px;
  z-index: 1003;
  cursor: pointer;
}
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
.commentary-section h3 {
  font-size: 11px;
  text-transform: uppercase;
  color: #a78bfa;
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.commentary-wrapper {
  display: grid;
  grid-template-columns: 1fr;
  margin-bottom: 25px; /* Moved from section to wrapper */
}

.commentary-wrapper > * {
  grid-area: 1 / 1;
}

.commentary-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: fit-content;
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

/* Skeleton Loading */
.skeleton {
  pointer-events: none;
}

.skeleton-line {
  height: 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  margin-bottom: 8px;
  position: relative;
  overflow: hidden;
}

.skeleton-line.short {
  width: 60%;
}

.skeleton-line::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Fade Slide Transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
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
  padding: 24px 20px 20px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px; /* Space between Title Row and Actions Row */
}

.header-top-row {
  display: flex;
  align-items: center;
  gap: 12px;
  /* Reserve space for close button which is top:20 right:20 */
  padding-right: 40px; 
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
    min-height: 30vh; /* Reduced min-height */
    height: auto;     /* Let it grow/shrink based on content */
    max-height: 55vh; /* Cap height to leave room for info */
    padding: 10px;
    background: #000;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
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
    bottom: 75px; /* Raised to avoid mobile toolbar coverage */
    transform: none;
    width: 44px;
    height: 44px;
    font-size: 24px;
    background: rgba(0, 0, 0, 0.6);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.15);
  }
  
  .nav-arrow.prev { left: 10px; margin: 0; }
  .nav-arrow.next { left: 64px; right: auto; margin: 0; }
  
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

/* Loading Page Overlay */
.loading-page-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1005;
  border-radius: inherit;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loader-spinner-large {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(167, 139, 250, 0.2);
  border-radius: 50%;
  border-top-color: #a78bfa;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  text-align: center;
}


@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.lni-is-spinning {
  animation: spin 1s infinite linear;
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  .modal-backdrop {
    padding: 0;
  }

  .modal-container {
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }

  .close-btn {
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
    font-size: 20px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
  }

  .nav-arrow {
    position: fixed;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    font-size: 28px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    margin: 0;
    transition: none;
  }

  .nav-arrow:hover {
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.7);
  }

  .nav-arrow:active {
    background: rgba(167, 139, 250, 0.5);
  }

  .nav-arrow.prev {
    left: 10px;
  }

  .nav-arrow.next {
    right: 10px;
  }

  .modal-content {
    flex-direction: column;
    height: 100%;
    overflow-y: auto; /* Allow scrolling of the whole modal content wrapper */
    -webkit-overflow-scrolling: touch;
  }

  .main-column {
    flex: 0 0 auto; /* Don't grow, size to content */
    width: 100%;
    display: flex;
    flex-direction: column;
    background: #000;
  }

  .info-sidebar {
    flex: none;
    height: auto;
    max-width: 100%;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    overflow: visible;
  }

  .image-section {
    padding: 10px;
    position: relative;
    z-index: 5;
  }
  
  /* Fix layout when relationship banner is present */
  .relationship-banner {
    position: relative;
    z-index: 1;
    margin-bottom: 10px;
  }
  
  .info-header {
    padding-top: 25px; /* Increase padding to prevent family banner overlap */
    position: relative;
    z-index: 10; /* Ensure header is above other elements */
  }
}

/* Reverse Image Search Dropdown */
.reverse-search-dropdown {
  position: relative;
  display: inline-block;
}

.search-trigger {
  position: relative;
}

.search-trigger i {
  font-size: 16px;
}

.search-trigger.active {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.5);
}

.search-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: rgba(30, 30, 40, 0.98);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 12px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1001;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(167, 139, 250, 0.1);
  transform-origin: top right;
}

.search-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  width: 100%;
}

.search-option:hover {
  background: rgba(167, 139, 250, 0.15);
  color: #fff;
  transform: translateX(2px);
}

.search-option:active {
  transform: translateX(0);
  background: rgba(167, 139, 250, 0.25);
}

.service-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 3px;
}

/* Dropdown fade transition */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.dropdown-fade-enter-to,
.dropdown-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@media (max-width: 768px) {
  .search-dropdown-menu {
    min-width: 160px;
    right: -10px; /* Adjust for mobile edge spacing */
  }
  
  .search-option {
    padding: 8px 10px;
    font-size: 13px;
  }
  
  .service-icon {
    width: 14px;
    height: 14px;
  }
}

/* Interactive Notes System */
.image-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* Vertical Note Logic: Center the tooltip vertically relative to the note */
.note-tooltip.vertical-left {
   top: 50%;
   bottom: auto;
   right: 100%; /* Place to the left of the note */
   left: auto;
   transform: translateY(-50%) translateX(-10px);
}

.note-tooltip.vertical-left::after {
   top: 50%;
   left: 100%; /* Arrow points right (to the note) */
   right: auto;
   bottom: auto;
   transform: translateY(-50%);
   border-color: transparent;
   border-left-color: rgba(0, 0, 0, 0.95);
}

.note-tooltip.vertical-right {
   top: 50%;
   bottom: auto;
   left: 100%; /* Place to the right of the note */
   right: auto;
   transform: translateY(-50%) translateX(10px);
}

.note-tooltip.vertical-right::after {
   top: 50%;
   right: 100%; /* Arrow points left (to the note) */
   left: auto;
   bottom: auto;
   transform: translateY(-50%);
   border-color: transparent;
   border-right-color: rgba(0, 0, 0, 0.95);
}

.notes-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.note-box {
  position: absolute;
  border: 2px solid rgba(255, 200, 0, 0.8);
  background: rgba(255, 200, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: all;
}

.note-box:hover {
  background: rgba(255, 200, 0, 0.3);
  border-color: rgba(255, 200, 0, 1);
  z-index: 10;
}

.note-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.95);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  max-width: 300px;
  min-width: 150px;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  white-space: pre-wrap;
  z-index: 100;
  pointer-events: none;
  word-wrap: break-word; /* Ensure long words break */
  overflow-wrap: break-word;
}

.note-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.95);
}


/* Handle HTML content in notes */
.note-tooltip :deep(*) {
  max-width: 100%;
  box-sizing: border-box;
  white-space: normal !important; /* Force wrap even if style says nowrap */
  font-size: 14px !important; /* Override inline font sizes (e.g. 55px) */
  line-height: 1.4 !important;
}

/* Fix properties */
.note-tooltip :deep([style*="background"]) {
  color: black;
  border-radius: 4px;
}

/* -------------------------------------------
   UNIFIED READER MODE (Mobile Sheet + Desktop Card)
   ------------------------------------------- */
.note-bottom-sheet {
  position: fixed;
  z-index: 2000;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.sheet-title {
  font-size: 13px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sheet-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0.7;
}

.sheet-close:hover { opacity: 1; }

.sheet-content {
  overflow-y: auto;
  font-size: 16px;
  line-height: 1.6;
  color: #eee;
  padding-right: 5px; 
}

/* Force content styling */
.sheet-content :deep(*) {
  font-size: 16px !important;
  line-height: 1.6 !important;
  color: #eee !important;
  background: transparent !important;
  white-space: normal !important;
  text-shadow: none !important; /* Remove legacy note outlines */
  font-family: inherit !important; /* Remove 'comic' fonts */
  font-weight: 400 !important; /* Reset bold if needed */
  transform: none !important; /* Remove scaling/rotation */
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  height: auto !important;
  width: auto !important;
}

/* Transitions */
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* --- MOBILE STYLES (Bottom Sheet) --- */
@media (max-width: 768px) {
  .note-bottom-sheet {
    bottom: 0;
    left: 0;
    width: 100%;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px 16px 0 0;
    padding: 20px;
    max-height: 40vh;
  }
  
  .slide-up-enter-from,
  .slide-up-leave-to {
    transform: translateY(100%);
  }
}

/* --- DESKTOP STYLES (Floating Card) --- */
@media (min-width: 769px) {
  .note-bottom-sheet {
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%); /* Center horizontally */
    width: 600px; /* Fixed comfortable reading width */
    max-width: 90%;
    border-radius: 12px;
    padding: 20px;
    max-height: 200px; /* Limit height so it doesn't cover too much */
  }
  
  /* Override slide transition for desktop fade/slide-up */
  .slide-up-enter-from,
  .slide-up-leave-to {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
  
  .slide-up-enter-to,
  .slide-up-leave-from {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* GLOBAL: Hide old tooltips everywhere */
.note-tooltip {
  display: none !important;
}




.note-tooltip.bottom {
  bottom: auto;
  top: calc(100% + 8px);
}

.note-tooltip.bottom::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: rgba(0, 0, 0, 0.95);
}

.note-tooltip.left {
  left: 0;
  transform: translateX(0);
}

.note-tooltip.left::after {
  left: 20px; /* Shift arrow to left side */
  transform: translateX(0);
}

.note-tooltip.right {
  left: auto;
  right: 0;
  transform: translateX(0);
}

.note-tooltip.right::after {
  left: auto;
  right: 20px; /* Shift arrow to right side */
  transform: translateX(0);
}

/* Ensure detail-image uses contain */
.detail-image {
  object-fit: contain !important;
  max-width: 100%;
  max-height: 100%;
}

</style>
