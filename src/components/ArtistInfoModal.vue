<template>
  <div class="artist-modal-backdrop" @click="$emit('close')">
    <div class="artist-modal" @click.stop>
      <button class="close-btn" @click="$emit('close')"><i class="lni lni-close"></i></button>
      
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Fetching artist info...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <span class="icon"><i class="lni lni-warning"></i></span>
        <p>{{ error }}</p>
      </div>

      <div v-else-if="currentView" class="artist-content">
        <div class="artist-header">
           <button v-if="navigationStack.length > 1" class="back-btn" @click="goBack" title="Back">
             <i class="lni lni-arrow-left"></i>
           </button>
          <h2>
            <i :class="getHeaderIcon(currentView.type)"></i> 
            {{ currentView.title }}
          </h2>
          <span v-if="currentView.type === 'artist'" class="status-badge" :class="{ 'active': !artist.is_deleted && !artist.is_banned, 'inactive': artist.is_deleted || artist.is_banned }">
            {{ getStatusText(artist) }}
          </span>
        </div>

        <!-- Artist Specific Links -->
        <div class="info-section" v-if="currentView.type === 'artist'">
            <div class="links-grid" v-if="artistUrls.length > 0">
                <a 
                  v-for="(url, index) in artistUrls" 
                  :key="url.url" 
                  :href="url.url" 
                  target="_blank"
                  class="link-card"
                  :style="{ animationDelay: index * 0.05 + 's' }"
                >
                  <span class="link-icon"><i :class="getLinkIconClass(url.url)"></i></span>
                  <span class="link-text">{{ getLinkDomain(url.url) }}</span>
                  <span class="external-arrow"><i class="lni lni-arrow-right"></i></span>
                </a>
            </div>
            <div v-else class="no-links">
                No social links found.
            </div>
        </div>

        <!-- Wiki Body (Common) -->
        <div class="wiki-section" v-if="currentView.body">
            <h3 v-if="currentView.type === 'artist'">Wiki Excerpt</h3>
            <h3 v-else>Description</h3>
            
            <div 
              class="wiki-text" 
              v-html="formatWiki(currentView.body)"
              @click="handleWikiTextClick"
            ></div>
        </div>
        
        <!-- Post Previews -->
        <div class="previews-section" v-if="currentView.previewPosts && currentView.previewPosts.length > 0">
            <h3>Recent Uploads</h3>
            <div class="preview-grid">
                <div 
                  v-for="(post, index) in currentView.previewPosts" 
                  :key="post.id" 
                  class="preview-item"
                  :title="'Rating: ' + post.rating"
                  @click.stop="$emit('view-post', { post, context: currentView.previewPosts })"
                  :style="{ animationDelay: index * 0.1 + 's' }"
                >
                    <img 
                      :src="getPostPreview(post)" 
                      loading="lazy" 
                      class="mini-preview"
                      @error="handleImageError"
                    />
                </div>
            </div>
        </div>
        
        <div class="actions">
            <button class="search-btn" @click="$emit('search', currentView.searchTag)">
                <i class="lni lni-grid-alt"></i> Browse All Artworks
            </button>
             <a :href="currentView.danbooruUrl" target="_blank" class="danbooru-link">
                View on Danbooru <i class="lni lni-link" style="margin-left:5px"></i>
            </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';

export default {
  name: 'ArtistInfoModal',
  props: {
    artistName: {
      type: String,
      required: true
    }
  },
  emits: ['close', 'search', 'view-post'],
  setup(props) {
    const loading = ref(true);
    const error = ref('');
    
    // Data Storage
    const artist = ref(null);
    const artistUrls = ref([]);
    
    // Navigation Stack
    const navigationStack = ref([]);
    const currentView = computed(() => navigationStack.value[navigationStack.value.length - 1]);

    // Helper to resolve preview URL
    const getPostPreview = (post) => {
      if (!post) return '';
      // 1. Try standard preview URL
      if (post.preview_file_url) return post.preview_file_url;
      // 2. Try media asset variants (often for videos/animated content)
      if (post.media_asset && post.media_asset.variants) {
         const preferred = post.media_asset.variants.find(v => 
             (v.type === '360x360' || v.type === '180x180' || v.type === '720x720') && 
             ['jpg', 'webp', 'png'].includes(v.file_ext)
         );
         if (preferred) return preferred.url;
      }
      // 3. Fallback to other URLs if available
      return post.large_file_url || post.file_url || '';
    };

    // Helper to normalize tags (spaces -> underscores)
    const normalizeTag = (tag) => {
        return tag ? tag.trim().replace(/\s+/g, '_') : '';
    };

    // Helper to fetch posts with filtering
    const fetchPreviewPosts = async (tag) => {
        try {
            const normalizedTag = normalizeTag(tag);
            // Fetch more posts (20) to filter out banned/broken ones
            const res = await fetch(`/api/danbooru?url=posts.json&tags=${encodeURIComponent(normalizedTag)}&limit=20`);
            if (res.ok) {
                const posts = await res.json();
                
                // Filter posts that have a valid preview
                const validPosts = posts.filter(p => {
                    const preview = getPostPreview(p);
                    // Filter out banned/deleted if they have no displayable image
                    if ((p.is_banned || p.is_deleted) && !preview) return false;
                    return preview !== '';
                });

                return validPosts.slice(0, 4);
            }
        } catch (e) {
            console.error('Failed to fetch previews', e);
        }
        return [];
    };

    const fetchArtistInfo = async () => {
      loading.value = true;
      error.value = '';
      
      try {
        // Fetch Artist Data
        const res = await fetch(`/api/danbooru?url=artists.json&search[name]=${encodeURIComponent(props.artistName)}`);
        if (!res.ok) throw new Error('Failed to fetch artist');
        
        const data = await res.json();
        if (data.length === 0) throw new Error('Artist not found');
        
        artist.value = data[0];
        
        // Fetch URLs
        const urlsRes = await fetch(`/api/danbooru?url=artist_urls.json&search[artist_id]=${artist.value.id}`);
        if (urlsRes.ok) {
            const urlsData = await urlsRes.json();
            artistUrls.value = urlsData.sort((a, b) => {
                const score = (url) => {
                    if (url.includes('twitter') || url.includes('x.com')) return 3;
                    if (url.includes('pixiv')) return 2;
                    return 1;
                };
                return score(b.url) - score(a.url);
            });
        }

        // Fetch Wiki
        let wikiBody = '';
        const wikiRes = await fetch(`/api/danbooru?url=wiki_pages.json&search[title]=${encodeURIComponent(props.artistName)}`);
        if (wikiRes.ok) {
             const wikiData = await wikiRes.json();
             if (wikiData.length > 0) wikiBody = wikiData[0].body;
        }

        // Fetch Previews
        const previews = await fetchPreviewPosts(artist.value.name);
        
        // Push Initial View
        navigationStack.value.push({
            type: 'artist',
            title: artist.value.name,
            body: wikiBody,
            searchTag: artist.value.name,
            danbooruUrl: `https://danbooru.donmai.us/artists/${artist.value.id}`,
            previewPosts: previews
        });

      } catch (e) {
        error.value = e.message;
      } finally {
        loading.value = false;
      }
    };
    
    const fetchWikiPage = async (title) => {
        loading.value = true;
        try {
            const res = await fetch(`/api/danbooru?url=wiki_pages.json&search[title]=${encodeURIComponent(title)}`);
            if(!res.ok) throw new Error('Failed to load wiki');
            const data = await res.json();
            
            // Fetch Previews for this tag/wiki
            // For wiki pages, the title is usually the tag
            const previews = await fetchPreviewPosts(title);

            if(data.length > 0) {
                const page = data[0];
                navigationStack.value.push({
                    type: 'wiki',
                    title: page.title,
                    body: page.body,
                    searchTag: normalizeTag(page.title), 
                    danbooruUrl: `https://danbooru.donmai.us/wiki_pages/${page.id}`,
                    previewPosts: previews
                });
            } else {
                navigationStack.value.push({
                    type: 'wiki',
                    title: title,
                    body: 'No wiki page found for this tag.',
                    searchTag: normalizeTag(title),
                    danbooruUrl: `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(normalizeTag(title))}`,
                    previewPosts: previews
                });
            }
        } catch(e) {
            console.error(e);
        } finally {
            loading.value = false;
        }
    };

    const handleImageError = (e) => {
      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4/PC90ZXh0Pjwvc3ZnPg==';
    };

    onMounted(() => {
        fetchArtistInfo();
    });
    
    const goBack = () => {
        if(navigationStack.value.length > 1) {
            navigationStack.value.pop();
        }
    };

    const getStatusText = (a) => {
        if (a.is_banned) return 'Banned';
        if (a.is_deleted) return 'Deleted';
        return 'Active';
    };

    const getLinkDomain = (url) => {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    const getLinkIconClass = (url) => {
        if (url.includes('twitter.com') || url.includes('x.com')) return 'lni lni-twitter-original';
        if (url.includes('pixiv.net')) return 'lni lni-brush';
        if (url.includes('instagram.com')) return 'lni lni-instagram-original';
        if (url.includes('patreon.com') || url.includes('fanbox')) return 'lni lni-coin';
        if (url.includes('twitch.tv')) return 'lni lni-twitch';
        if (url.includes('youtube.com')) return 'lni lni-youtube';
        return 'lni lni-link';
    };
    
    const getHeaderIcon = (type) => {
        return type === 'artist' ? 'lni lni-brush-alt' : 'lni lni-files';
    };
    
    const formatWiki = (text) => {
        if (!text) return '';
        
        return text.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (match, link, label) => {
            const displayText = label || link;
            return `<span class="wiki-link" data-link="${link}" style="color: #a78bfa; cursor: pointer; text-decoration: underline;">${displayText}</span>`;
        })
        .replace(/h\d\.(.*)/g, '<b>$1</b>')
        .replace(/\r\n/g, '<br>')
        .replace(/\n/g, '<br>')
        .replace(/\*/g, '•'); 
    };
    
    const handleWikiTextClick = (e) => {
        if(e.target.classList.contains('wiki-link')) {
            const link = e.target.dataset.link;
            if(link) {
                fetchWikiPage(link);
            }
        }
    };

    return {
      artist,
      artistUrls,
      loading,
      error,
      getStatusText,
      getLinkDomain,
      getLinkIconClass,
      formatWiki,
      
      // Navigation
      currentView,
      navigationStack,
      goBack,
      getHeaderIcon,
      handleWikiTextClick,
      handleImageError,
      getPostPreview
    };
  }
}
</script>

<style scoped>
.artist-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000; /* Above ImageDetailModal */
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.artist-modal {
  background: #1e1e24;
  width: 90%;
  max-width: 500px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  padding: 25px;
  position: relative;
  animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: transparent;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px 0;
  color: #94a3b8;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Back Button */
.back-btn {
  background: transparent;
  border: none;
  color: #a78bfa;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  margin-right: -5px; /* Adjust alignment */
  transition: transform 0.2s;
  display: flex;
  align-items: center;
}

.back-btn:hover {
  transform: translateX(-3px);
  color: #fff;
}

.artist-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 15px;
}

.artist-header h2 {
  margin: 0;
  color: #fff;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge.active {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.status-badge.inactive {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.2);
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.link-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  color: #e2e8f0;
  text-decoration: none;
  transition: all 0.2s;
  
  /* Animation */
  opacity: 0; /* Star hidden */
  animation: fadeInUp 0.4s ease forwards;
}

.link-card:hover {
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.3);
  transform: translateY(-2px);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.link-icon { 
    font-size: 16px; 
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px; /* Fixed width for alignment */
}
.link-text { 
    font-size: 12px; 
    overflow: hidden; 
    text-overflow: ellipsis; 
    white-space: nowrap; 
    flex: 1;
}
.external-arrow { 
    font-size: 10px; 
    color: #64748b; 
    display: flex;
    align-items: center;
}

.wiki-section {
    margin-bottom: 20px;
    background: rgba(0,0,0,0.2);
    padding: 15px;
    border-radius: 8px;
}

.wiki-section h3 {
    margin: 0 0 10px 0;
    font-size: 12px;
    text-transform: uppercase;
    color: #94a3b8;
}

.wiki-text {
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.5;
}

/* Deep selector because html is v-html */
.wiki-text :deep(.wiki-link) {
    transition: color 0.2s;
}

.wiki-text :deep(.wiki-link):hover {
    color: #fff !important;
}

.wiki-text :deep(.wiki-link):hover {
    color: #fff !important;
}

/* Previews */
.previews-section {
    margin-bottom: 20px;
    background: rgba(0,0,0,0.2);
    padding: 15px;
    border-radius: 8px;
}

.previews-section h3 {
    margin: 0 0 10px 0;
    font-size: 12px;
    text-transform: uppercase;
    color: #94a3b8;
}

.preview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.preview-item {
    aspect-ratio: 1; /* Square */
    border-radius: 6px;
    overflow: hidden;
    background: #1e1e24;
    border: 1px solid rgba(255,255,255,0.05);
    cursor: pointer;
    
    /* Animation */
    opacity: 0;
    animation: fadeInUp 0.4s ease forwards;
}

.mini-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s;
}

.mini-preview:hover {
    transform: scale(1.1);
}

.actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.search-btn {
    flex: 1;
    padding: 10px;
    background: #a78bfa;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.search-btn:hover {
    background: #8b5cf6;
}

.danbooru-link {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 15px;
    color: #94a3b8;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    transition: all 0.2s;
}

.danbooru-link:hover {
    color: #e2e8f0;
    border-color: #64748b;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
