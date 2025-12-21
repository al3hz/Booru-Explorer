<template>
  <div class="wiki-view">
    <div class="wiki-container">
      <div class="wiki-layout">
        <!-- Sidebar -->
        <aside class="wiki-sidebar">
            <div class="sidebar-search">
                <h3>Wiki Search</h3>
                <div class="search-input-wrapper">
                    <input 
                        type="text" 
                        v-model="wikiSearchQuery"
                        @input="handleWikiSearchInput"
                        @keyup.enter="submitWikiSearch(null)"
                        placeholder="Search wiki..."
                    />
                    <button class="wiki-search-btn" @click="submitWikiSearch(null)" title="Search">
                        <i class="lni lni-search-alt"></i>
                    </button>
                    <ul v-if="showAutocomplete && autocompleteResults.length" class="wiki-autocomplete">
                        <li 
                            v-for="item in autocompleteResults" 
                            :key="item.label"
                            @click="submitWikiSearch(item.label)"
                        >
                            {{ item.label }}
                        </li>
                    </ul>
                </div>
            </div>

            <div class="sidebar-recent">
                <div class="wiki-accordion">
                    <input type="checkbox" id="recent-accordion">
                    <label for="recent-accordion" class="accordion-header">
                        Recent Changes
                    </label>
                    <div class="accordion-content">
                        <ul class="recent-list">
                            <li v-for="page in recentChanges.slice(0, 20)" :key="page.id">
                                <a @click.prevent="submitWikiSearch(page.title)" href="#" :title="page.title">
                                    {{ page.title.replace(/_/g, ' ') }}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="wiki-main-column">
        <transition name="fade" mode="out-in">
            <div v-if="loading" class="loading-state" key="loading">
                <div class="loader-ring"></div>
                <p>Fetching info...</p>
            </div>

            <div v-else-if="error" class="error-state" key="error">
                <span class="icon"><i class="lni lni-warning"></i></span>
                <p>{{ error }}</p>
                <button @click="$router.go(-1)" class="back-link">Go Back</button>
            </div>

            <div v-else-if="currentView" class="wiki-content" key="content">
            <!-- Header -->
            <header class="wiki-header">
            <button class="back-btn" @click="handleBack" title="Back">
                <i class="lni lni-arrow-left"></i> Back
            </button>
            
            <div class="title-section">
                <h2>
                    <i :class="getHeaderIcon(currentView.type)"></i> 
                    {{ currentView.title }}
                </h2>
                <span v-if="currentView.type === 'artist' && artist" class="status-badge" :class="{ 'active': !artist.is_deleted && !artist.is_banned, 'inactive': artist.is_deleted || artist.is_banned }">
                    {{ getStatusText(artist) }}
                </span>
            </div>
            
            <!-- Aliases / Other Names -->
            <div class="wiki-aliases" v-if="currentView.otherNames && currentView.otherNames.length">
                <span v-for="name in currentView.otherNames" :key="name" class="wiki-tag" @click="handleAliasClick(name)">
                    {{ name }}
                </span>
            </div>

            </header>

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
            </div>

            <!-- Wiki Body -->
            <div class="wiki-section" v-if="currentView.body">
                <h3 v-if="currentView.type === 'artist'">Biography / Description</h3>
                <h3 v-else>Description</h3>
                
                <div 
                ref="wikiTextContainer"
                class="wiki-text" 
                v-html="formatWiki(currentView.body)"
                @click="handleWikiTextClick"
                @change="handleWikiTextClick"
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
                    @click="openPost(post)"
                    :style="{ animationDelay: index * 0.1 + 's' }"
                    >
                        <video 
                        v-if="isVideo(post)"
                        :src="post.large_file_url || post.file_url"
                        autoplay 
                        loop 
                        muted 
                        playsinline
                        class="mini-preview"
                        ></video>
                        <img 
                        v-else
                        :src="post.large_file_url || post.file_url || getPostPreview(post)" 
                        loading="lazy" 
                        class="mini-preview"
                        @error="handleImageError"
                        />
                    </div>
                </div>
            </div>
            
            <div class="actions">
                <button v-if="currentView.hasPosts" @click="goToPostSearch" class="search-posts-btn">
                    Search Posts <i class="lni lni-search-alt" style="margin-left:5px"></i>
                </button>
                <a :href="currentView.danbooruUrl" target="_blank" class="danbooru-link">
                    View on Danbooru <i class="lni lni-link" style="margin-left:5px"></i>
                </a>
            </div>
        </div>
      </transition>
      </main> <!-- End Main Column -->
     </div> <!-- End Wiki Layout -->

    <!-- Post Detail Modal -->
    <Teleport to="body">
      <transition name="fade">
        <ImageDetailModal 
          v-if="selectedPost" 
          :post="selectedPost" 
          :has-next="canGoNext"
          :has-prev="canGoPrev"
          @close="selectedPost = null"
          @search-tag="handleSearchTag"
          @next="handleNext"
          @prev="handlePrev"
          @update-post="openPost"
        />
      </transition>
    </Teleport>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDText } from '../composables/useDText';
import ImageDetailModal from '../components/ImageDetailModal.vue';
import { useWikiSearch } from '../composables/useWikiSearch';

export default {
  name: 'WikiView',
  components: { ImageDetailModal },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { parseDText } = useDText();
    const { fetchRecentWikiPages, fetchWikiAutocomplete } = useWikiSearch();
    
    // Sidebar & Search State
    const recentChanges = ref([]);
    const wikiSearchQuery = ref('');
    const autocompleteResults = ref([]);
    const showAutocomplete = ref(false);

    const loading = ref(true);
    const error = ref('');
    const currentView = ref(null);
    const artist = ref(null);
    const artistUrls = ref([]);
    const posts = ref([]);
    const selectedPost = ref(null);
    
    // Store hydrated posts and assets
    const wikiTextContainer = ref(null);
    const wikiInlinePosts = ref({});
    const wikiInlineAssets = ref({});

    const handleWikiSearchInput = async () => {
        if (wikiSearchQuery.value.length >= 2) {
            autocompleteResults.value = await fetchWikiAutocomplete(wikiSearchQuery.value);
            showAutocomplete.value = true;
        } else {
            autocompleteResults.value = [];
            showAutocomplete.value = false;
        }
    };

    const submitWikiSearch = (tag) => {
        const query = tag || wikiSearchQuery.value;
        if (!query) return;
        
        showAutocomplete.value = false;
        // Don't clear query, keep it as requested by user
        router.push({ name: 'wiki', params: { query: query } });
    };

    const handleAliasClick = (name) => {
        if (!name) return;
        const url = `https://www.pixiv.net/en/tags/${encodeURIComponent(name.replace(/\s+/g, '_'))}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    onMounted(async () => {
        recentChanges.value = await fetchRecentWikiPages();
    });

    // Helpers
    const isVideo = (post) => {
      const ext = post.file_ext;
      if (['mp4', 'webm', 'gifv'].includes(ext)) return true;
      if (ext === 'zip' && post.large_file_url && post.large_file_url.endsWith('.webm')) return true;
      return false;
    };

    const getPostPreview = (post) => {
      if (!post) return '';
      if (post.preview_file_url) return post.preview_file_url;
      if (post.media_asset && post.media_asset.variants) {
         const preferred = post.media_asset.variants.find(v => 
             (v.type === '360x360' || v.type === '180x180' || v.type === '720x720') && 
             ['jpg', 'webp', 'png'].includes(v.file_ext)
         );
         if (preferred) return preferred.url;
      }
      return post.large_file_url || post.file_url || '';
    };

    const normalizeTag = (tag) => tag ? tag.trim().replace(/\s+/g, '_') : '';

    const fetchPreviewPosts = async (tag) => {
        try {
            const normalizedTag = normalizeTag(tag);
            const searchTags = normalizedTag ? `${normalizedTag} -status:deleted` : '-status:deleted';
            const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(searchTags)}&limit=20`);
            if (res.ok) {
                const postsArr = await res.json();
                const validPosts = postsArr.filter(p => {
                    const preview = getPostPreview(p);
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

    const hydrateWikiPosts = async () => {
        const container = wikiTextContainer.value || document.querySelector('.wiki-text') || document;
        const postStubs = container.querySelectorAll('.dtext-post-stub');
        const assetStubs = container.querySelectorAll('.dtext-asset-stub');
        
        
        if (postStubs.length === 0 && assetStubs.length === 0) return;
        
        // --- Hydrate Posts ---
        if (postStubs.length > 0) {
            const ids = Array.from(postStubs).map(el => el.dataset.postId);
            const uniqueIds = [...new Set(ids)];
            const chunkSize = 50;
            for (let i = 0; i < uniqueIds.length; i += chunkSize) {
                const chunk = uniqueIds.slice(i, i + chunkSize);
                const idQuery = 'id:' + chunk.join(',');
                try {
                    const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(idQuery)}&limit=100`);
                    if (res.ok) {
                        const postsData = await res.json();
                        postsData.forEach(p => { wikiInlinePosts.value[p.id] = p; });
                        postStubs.forEach(stub => {
                            const pid = stub.dataset.postId;
                            if (chunk.includes(pid)) {
                                const post = wikiInlinePosts.value[pid];
                                if (post) {
                                    const previewUrl = getPostPreview(post);
                                    if (previewUrl) {
                                        const img = document.createElement('img');
                                        img.src = previewUrl;
                                        img.className = 'dtext-post-preview';
                                        img.dataset.postId = pid;
                                        img.loading = 'lazy';
                                        img.title = `Post #${pid}`;
                                        img.onclick = () => openPost(post); 
                                        stub.replaceWith(img);
                                    } else {
                                        stub.textContent = `[Post #${pid} - No preview]`;
                                    }
                                } else {
                                    stub.textContent = `[Post #${pid} not found]`;
                                }
                            }
                        });
                    }
                } catch (e) { console.error('[WikiView] Post hydration failed', e); }
            }
        }

        // --- Hydrate Assets ---
        if (assetStubs.length > 0) {
            const ids = Array.from(assetStubs).map(el => el.dataset.assetId);
            const uniqueIds = [...new Set(ids)];
            const chunkSize = 50;
            for (let i = 0; i < uniqueIds.length; i += chunkSize) {
                const chunk = uniqueIds.slice(i, i + chunkSize);
                // Danbooru media_assets API supports search[id]=id1,id2
                try {
                    const res = await fetch(`https://danbooru.donmai.us/media_assets.json?search[id]=${chunk.join(',')}&limit=100`);
                    if (res.ok) {
                        const assetsData = await res.json();
                        assetsData.forEach(a => { wikiInlineAssets.value[a.id] = a; });
                        assetStubs.forEach(stub => {
                            const aid = stub.dataset.assetId;
                            if (chunk.includes(aid)) {
                                const asset = wikiInlineAssets.value[aid];
                                if (asset) {
                                    // Media assets have variants. Find a preview.
                                    let previewUrl = '';
                                    if (asset.variants) {
                                        const pref = asset.variants.find(v => (v.type === '360x360' || v.type === '180x180' || v.type === '720x720'));
                                        if (pref) previewUrl = pref.url;
                                    }
                                    
                                    if (previewUrl) {
                                        const img = document.createElement('img');
                                        img.src = previewUrl;
                                        img.className = 'dtext-post-preview dtext-asset-preview';
                                        img.dataset.assetId = aid;
                                        img.loading = 'lazy';
                                        img.title = `Asset #${aid}`;
                                        // If asset has a post_id, we can make it clickable to open the post
                                        if (asset.post_id) {
                                            img.onclick = async () => {
                                                // Fetch the post if not in cache
                                                if (!wikiInlinePosts.value[asset.post_id]) {
                                                    const pRes = await fetch(`https://danbooru.donmai.us/posts/${asset.post_id}.json`);
                                                    if (pRes.ok) wikiInlinePosts.value[asset.post_id] = await pRes.json();
                                                }
                                                const post = wikiInlinePosts.value[asset.post_id];
                                                if (post) openPost(post);
                                            };
                                        }
                                        stub.replaceWith(img);
                                    } else {
                                        stub.textContent = `[Asset #${aid} - No preview]`;
                                    }
                                } else {
                                    stub.textContent = `[Asset #${aid} not found]`;
                                }
                            }
                        });
                    }
                } catch (e) { console.error('[WikiView] Asset hydration failed', e); }
            }
        }
    };

    const loadData = async (query) => {
        if (!query) return;
        
        loading.value = true;
        error.value = '';
        artist.value = null;
        artistUrls.value = [];
        wikiInlinePosts.value = {}; // Reset inline posts cache
        
        try {
            let isArtist = false;
            const artistRes = await fetch(`https://danbooru.donmai.us/artists.json?search[name]=${encodeURIComponent(query)}`);
            if (artistRes.ok) {
                const data = await artistRes.json();
                if (data.length > 0) {
                    isArtist = true;
                    artist.value = data[0];
                    const urlsRes = await fetch(`https://danbooru.donmai.us/artist_urls.json?search[artist_id]=${artist.value.id}`);
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
                }
            }

            let wikiBody = '';
            let wikiId = null;
            let wikiTitle = query;
            let otherNames = [];
            
            const wikiRes = await fetch(`https://danbooru.donmai.us/wiki_pages.json?search[title]=${encodeURIComponent(query)}`);
            if (wikiRes.ok) {
                 const wikiData = await wikiRes.json();
                 if (wikiData.length > 0) {
                     wikiBody = wikiData[0].body;
                     wikiId = wikiData[0].id;
                     wikiTitle = wikiData[0].title;
                     otherNames = wikiData[0].other_names || [];
                 }
            }
            
            const previews = await fetchPreviewPosts(query);

            currentView.value = {
                type: isArtist ? 'artist' : 'wiki',
                title: isArtist ? artist.value.name : wikiTitle,
                body: wikiBody || (isArtist ? '' : 'No wiki description available.'),
                otherNames: otherNames,
                searchTag: normalizeTag(query),
                danbooruUrl: wikiId 
                    ? `https://danbooru.donmai.us/wiki_pages/${wikiId}`
                    : (isArtist ? `https://danbooru.donmai.us/artists/${artist.value.id}` : `https://danbooru.donmai.us/posts?tags=${query}`),
                previewPosts: previews,
                hasPosts: false // Default false, will check next
            };

            // Check if tag exists and has posts to show the button
            if (isArtist) {
                // Artists usually have posts if they exist in the DB
                 currentView.value.hasPosts = true; 
            } else {
                 try {
                    // Use normalized tag (underscores) for the exact tag check
                    const normalizedQuery = normalizeTag(query);
                    const tagRes = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(normalizedQuery)}`);
                    if (tagRes.ok) {
                        const tags = await tagRes.json();
                        // If tag exists and has posts > 0
                        if (tags.length > 0 && tags[0].post_count > 0) {
                             currentView.value.hasPosts = true;
                        } else {
                            // Fallback: Try searching for the exact parameter as passed, just in case
                            if (query !== normalizedQuery) {
                                const backupRes = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(query)}`);
                                if (backupRes.ok) {
                                    const backupTags = await backupRes.json();
                                    if (backupTags.length > 0 && backupTags[0].post_count > 0) {
                                        currentView.value.hasPosts = true;
                                    }
                                }
                            }
                        }
                    }
                 } catch (e) { console.warn('Tag check failed', e); }
            }
            
            // Trigger hydration via watcher or immediate if needed
            // The watch will handle most cases beautifully.
            
        } catch (e) {
            error.value = 'Failed to load information: ' + e.message;
        } finally {
            loading.value = false;
        }
    };

    const handleBack = () => {
        router.go(-1);
    };

    const openPost = (post) => {
        selectedPost.value = post;
    };

    const currentIndex = computed(() => {
        if (!selectedPost.value || posts.value.length === 0) return -1;
        return posts.value.findIndex(p => p.id === selectedPost.value.id);
    });

    const canGoNext = computed(() => currentIndex.value >= 0 && currentIndex.value < posts.value.length - 1);
    const canGoPrev = computed(() => currentIndex.value > 0);

    const handleNext = () => { if (canGoNext.value) selectedPost.value = posts.value[currentIndex.value + 1]; };
    const handlePrev = () => { if (canGoPrev.value) selectedPost.value = posts.value[currentIndex.value - 1]; };
    
    const handleSearchTag = (tag) => {
        selectedPost.value = null;
        router.push({ name: 'wiki', params: { query: tag } });
    };

    const formatWiki = (text) => parseDText(text);
    
    const handleWikiTextClick = (e) => {
        if(e.target.classList.contains('wiki-link')) {
            const link = e.target.dataset.link;
            if(link) router.push({ name: 'wiki', params: { query: link } });
        }

        if(e.target.classList.contains('status-link')) {
            const tag = e.target.dataset.tag;
            if(tag) router.push({ name: 'home', query: { tags: tag } });
        }
        
        if(e.target.classList.contains('dtext-anchor')) {
            e.preventDefault();
            const anchorId = e.target.dataset.anchor;
            if (!anchorId) return;
            const target = document.getElementById(anchorId) || document.getElementById('dtext-' + anchorId);
            if (target) {
                const parentAccordion = target.closest('.dtext-accordion');
                if (parentAccordion) {
                    const checkbox = parentAccordion.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.checked = true;
                }
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        if (e.target.classList.contains('accordion-checkbox') && e.type === 'change') {
            if (e.target.checked) {
                const container = e.target.closest('.wiki-text');
                if (container) {
                    const allCheckboxes = container.querySelectorAll('.accordion-checkbox');
                    allCheckboxes.forEach(cb => { if (cb !== e.target && cb.checked) cb.checked = false; });
                }
            }
        }
        
        const postElement = e.target.closest('.dtext-post-preview');
        if (postElement) {
             const postId = postElement.dataset.postId;
             const post = wikiInlinePosts.value[postId];
             if (post) openPost(post);
        }
    };

    const getStatusText = (a) => {
        if (a.is_banned) return 'Banned';
        if (a.is_deleted) return 'Deleted';
        return 'Active';
    };

    const getLinkDomain = (url) => {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
    };

    const getLinkIconClass = (url) => {
        if (url.includes('twitter') || url.includes('x.com')) return 'lni lni-twitter-original';
        if (url.includes('pixiv')) return 'lni lni-brush';
        if (url.includes('instagram')) return 'lni lni-instagram-original';
        if (url.includes('patreon') || url.includes('fanbox')) return 'lni lni-coin';
        if (url.includes('twitch.tv')) return 'lni lni-twitch';
        if (url.includes('youtube')) return 'lni lni-youtube';
        return 'lni lni-link';
    };
    
    const getHeaderIcon = (type) => type === 'artist' ? 'lni lni-brush-alt' : 'lni lni-files';
    const handleImageError = (e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4/PC90ZXh0Pjwvc3ZnPg=='; };

    watch(() => route.params.query, (newQuery) => {
        if (route.name === 'wiki') {
            loadData(newQuery);
            // Also update the sidebar input to reflect the current page
            if (newQuery) wikiSearchQuery.value = newQuery;
            // Scroll to top on navigation
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, { immediate: true });

    // Watch for currentView changes to trigger hydration
    watch(currentView, (newVal) => {
        if (newVal) {
            nextTick(() => {
                // We use a small delay to allow v-html and transitions to settle
                setTimeout(hydrateWikiPosts, 800);
            });
        }
    });

    return {
      wikiTextContainer,
      loading, error, currentView, artist, artistUrls,
      handleBack, openPost, formatWiki, handleWikiTextClick,
      selectedPost, handleSearchTag,
      handleNext, handlePrev, canGoNext, canGoPrev,
      getStatusText, getLinkDomain, getLinkIconClass, getHeaderIcon, handleImageError, getPostPreview, isVideo,
      recentChanges, wikiSearchQuery, autocompleteResults, showAutocomplete, handleWikiSearchInput, submitWikiSearch, handleAliasClick,
      goToPostSearch: () => {
          if (currentView.value && currentView.value.searchTag) {
              router.push({ name: 'home', query: { tags: currentView.value.searchTag } });
          }
      }
    };
  }
}
</script>

<style scoped>
.wiki-view {
  min-height: calc(100vh - 60px);
  color: #fff;
  padding: 20px;
  padding-top: 10px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.wiki-container {
  width: 100%;
  max-width: 1600px;
  background: rgba(20, 20, 28, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 30px 40px;
  backdrop-filter: blur(10px);
}

.wiki-header {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 30px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 20px;
}

.title-section {
    display: flex;
    align-items: center;
    gap: 15px;
}

.title-section h2 {
    margin: 0;
    font-size: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.back-btn {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    padding: 5px 0;
    transition: color 0.2s;
}

.back-btn:hover {
    color: #fff;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
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

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 20px;
  color: #94a3b8;
  width: 100%;
  min-height: 400px;
  gap: 20px;
  margin: 0 auto; /* Extra safety */
}

.loader-ring {
  width: 45px;
  height: 45px;
  border: 3px solid rgba(167, 139, 250, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.link-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  color: #e2e8f0;
  text-decoration: none;
  transition: all 0.2s;
  opacity: 0;
  animation: fadeInUp 0.4s ease forwards;
  overflow: hidden;
}

.link-card:hover {
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.3);
  transform: translateY(-2px);
}

.link-icon { font-size: 18px; width: 24px; display: flex; justify-content: center; flex-shrink: 0; }
.link-text { 
    flex: 1; 
    font-weight: 500; 
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.external-arrow { flex-shrink: 0; }

.wiki-section {
    margin-bottom: 30px;
    line-height: 1.6;
}

.wiki-section h3, .previews-section h3 {
    font-size: 16px;
    text-transform: uppercase;
    color: #a78bfa;
    margin-top: 30px;
    margin-bottom: 20px;
    border-left: 3px solid #a78bfa;
    padding-left: 12px;
}

.wiki-text {
    font-size: 15px;
    color: #cbd5e1;
    overflow-wrap: anywhere;
    word-break: normal;
    text-align: left;
}

.wiki-text h4 {
    font-size: 20px;
    margin: 35px 0 20px 0;
    color: #fff;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 8px;
}

.wiki-text h5 {
    font-size: 17px;
    margin: 25px 0 15px 0;
    color: #e2e8f0;
    font-weight: 600;
}

.wiki-text :deep(.wiki-link) {
    color: #a78bfa;
    text-decoration: none;
    border-bottom: 1px dotted #a78bfa;
    transition: all 0.2s;
}

.wiki-text :deep(.wiki-link):hover {
    color: #fff;
    border-bottom-style: solid;
}

.wiki-text :deep(.dtext-quote), .wiki-text :deep(.dtext-tn) {
    border-left: 3px solid #a78bfa;
    padding: 12px 16px;
    margin: 15px 0;
    color: #94ab38;
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
    font-size: 0.95em;
}

.wiki-text :deep(.dtext-tn) {
    border-left-color: #6366f1;
    color: #cbd5e1;
    font-style: italic;
}

.wiki-text :deep(.dtext-code) {
    background: #000;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
}

.wiki-text :deep(.dtext-link) {
    color: #38bdf8;
    text-decoration: none;
}
.wiki-text :deep(.dtext-link):hover {
    text-decoration: underline;
}

.wiki-text :deep(.dtext-accordion) {
    margin: 0.5em 0;
    background: transparent;
    border: none;
}

.wiki-text :deep(.dtext-accordion input) {
    display: none;
}

.wiki-text :deep(.accordion-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95em;
    background: rgba(255,255,255,0.05); 
    border-radius: 6px;
    color: #cbd5e1;
    transition: all 0.2s;
    user-select: none;
}

.wiki-text :deep(.accordion-header):hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
}

.wiki-text :deep(.accordion-header)::after {
    content: '❯';
    font-size: 0.8em;
    transform: rotate(90deg);
    transition: transform 0.3s ease;
    opacity: 0.7;
}

.wiki-text :deep(.dtext-accordion input:checked + .accordion-header) {
    background: rgba(167, 139, 250, 0.15);
    color: #a78bfa;
}

.wiki-text :deep(.dtext-accordion input:checked + .accordion-header)::after {
    transform: rotate(-90deg);
    color: #a78bfa;
}

.wiki-text :deep(.dtext-list-item) {
    margin: 12px 0;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    width: 100%;
}

/* Previews should flow horizontally */
.wiki-text :deep(.dtext-list-item.dtext-preview-item) {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    width: auto;
    margin: 15px 15px 15px 0;
    text-align: center;
    vertical-align: top;
    gap: 8px;
}

.wiki-text :deep(.dtext-post-preview) {
    max-width: 180px;
    max-height: 250px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.wiki-text :deep(.dtext-post-preview):hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(167, 139, 250, 0.3);
}

.wiki-text :deep(.preview-label) {
    font-size: 0.85em;
    color: #a78bfa;
    font-weight: 500;
}

.wiki-text :deep(.dtext-list-item:not(.dtext-preview-item))::before {
    content: "•";
    color: #a78bfa;
    flex-shrink: 0;
    font-weight: bold;
    margin-right: 12px;
}

.wiki-text :deep(.dtext-list-item.nested) {
    margin-left: 30px;
    font-size: 0.95em;
    opacity: 0.9;
}

.wiki-text :deep(.dtext-accordion input:checked ~ .accordion-content) {
    grid-template-rows: 1fr;
}

.wiki-text :deep(.accordion-content > div) {
    overflow: hidden;
    padding: 16px;
}

.wiki-text :deep(.dtext-accordion input:not(:checked) ~ .accordion-content > div) {
    visibility: hidden;
    transition: visibility 0.3s;
}

.wiki-text :deep(.dtext-accordion input:checked ~ .accordion-content > div) {
    visibility: visible;
}

.wiki-text :deep(.dtext-list-item) {
    margin: 2px 0;
    line-height: 1.4;
    padding-left: 5px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.wiki-text :deep(.dtext-preview-item) {
    display: inline-flex !important;
    flex-direction: column;
    align-items: center;
    padding-left: 0;
    margin: 5px 15px;
    vertical-align: top;
}

/* Hide bullet for post/asset-only list items */
.wiki-text :deep(.dtext-preview-item)::before {
    display: none;
}

.wiki-text :deep(.preview-label) {
    display: block;
    margin-top: 8px;
    font-size: 0.9em;
    color: #38bdf8; /* Match wiki-tag color for consistency */
    text-align: center;
    max-width: 180px;
    word-break: break-word;
    font-weight: 500;
}

.wiki-text :deep(.preview-label a) {
    color: inherit;
    text-decoration: none;
}

.wiki-text :deep(.preview-label a:hover) {
    text-decoration: underline;
}

.wiki-text :deep(.dtext-post-stub) {
    display: inline-block;
    color: #94a3b8;
    font-size: 0.9em;
    font-style: italic;
    background: rgba(255,255,255,0.05);
    padding: 2px 8px;
    border-radius: 4px;
}

.wiki-text :deep(.dtext-post-preview) {
    display: inline-block; 
    vertical-align: top;
    max-width: 180px;
    height: auto;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    border: 2px solid rgba(255,255,255,0.1);
    margin: 5px;
}

.wiki-text :deep(.dtext-post-preview):hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-color: #a78bfa;
}

.wiki-aliases {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    margin-bottom: 10px;
}

.wiki-tag {
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.85em;
    cursor: pointer;
    transition: all 0.2s;
}

.wiki-tag:hover {
    background: rgba(56, 189, 248, 0.2);
    border-color: #38bdf8;
    transform: translateY(-1px);
}

.wiki-text :deep(h1), 
.wiki-text :deep(h2), 
.wiki-text :deep(h3), 
.wiki-text :deep(h4), 
.wiki-text :deep(h5), 
.wiki-text :deep(h6) {
    color: #fff;
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.2;
}

.wiki-text :deep(h1) { font-size: 1.5em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
.wiki-text :deep(h2) { font-size: 1.3em; }
.wiki-text :deep(h3) { font-size: 1.2em; }
.wiki-text :deep(h4) { font-size: 1.1em; color: #a78bfa; }
.wiki-text :deep(h5) { font-size: 1em; }
.wiki-text :deep(h6) { font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.05em; }

.wiki-layout {
    display: flex;
    gap: 30px;
    align-items: flex-start;
}

.wiki-sidebar {
    width: 250px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 30px;
    border-right: 1px solid rgba(255,255,255,0.05);
    padding-right: 20px;
}

.wiki-main-column {
    flex-grow: 1;
    min-width: 0;
}

.sidebar-search h3 {
    font-size: 0.9em;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 15px;
    letter-spacing: 0.05em;
    padding-left: 5px;
}

.search-input-wrapper {
    position: relative;
}

.search-input-wrapper input {
    width: 100%;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    padding: 8px 35px 8px 12px;
    border-radius: 6px;
    outline: none;
    transition: all 0.2s;
    font-size: 0.9em;
}

.search-input-wrapper input:focus {
    border-color: #a78bfa;
    box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2);
    background: rgba(0,0,0,0.4);
}

.wiki-search-btn {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(167, 139, 250, 0.1);
    border: none;
    color: #a78bfa;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.wiki-search-btn:hover {
    background: #a78bfa;
    color: #fff;
}

.wiki-autocomplete {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: #1e1e24;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    margin-top: 5px;
    list-style: none;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
}

.wiki-autocomplete li {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background 0.2s;
}

.wiki-autocomplete li:hover {
    background: rgba(167, 139, 250, 0.1);
    color: #a78bfa;
}

.recent-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 450px;
    overflow-y: auto;
    padding-right: 8px;
    margin: 0;
}

/* Custom Scrollbar for Sidebar */
.recent-list::-webkit-scrollbar {
    width: 3px;
}

.recent-list::-webkit-scrollbar-track {
    background: transparent;
}

.recent-list::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.2);
    border-radius: 10px;
}

.wiki-accordion {
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
}

.wiki-accordion input {
    display: none;
}

.wiki-accordion .accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.75em;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    transition: all 0.2s;
    user-select: none;
}

.wiki-accordion .accordion-header:hover {
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.03);
}

.wiki-accordion .accordion-header::after {
    content: '❯';
    font-size: 0.7em;
    transform: rotate(0deg);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.4;
}

.wiki-accordion input:checked + .accordion-header {
    color: #a78bfa;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.wiki-accordion input:checked + .accordion-header::after {
    transform: rotate(90deg);
    opacity: 1;
}

.wiki-accordion .accordion-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.wiki-accordion input:checked ~ .accordion-content {
    grid-template-rows: 1fr;
}

.wiki-accordion .accordion-content > div {
    overflow: hidden;
    line-height: 1.6;
}

.recent-list li {
    padding: 1px 0;
}

.recent-list a {
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.82em;
    transition: all 0.15s ease;
    line-height: 1.5;
    display: block;
    word-break: break-all;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 6px;
}

.recent-list a:hover {
    color: #fff;
    background: rgba(167, 139, 250, 0.1);
    transform: translateX(3px);
}

@media (max-width: 1024px) {
    .wiki-container {
        padding: 20px;
    }
    .wiki-layout {
        gap: 20px;
    }
}

@media (max-width: 768px) {
    .wiki-view {
        padding: 10px;
    }
    .wiki-container {
        padding: 15px;
        border-radius: 0;
    }
    .wiki-layout {
        flex-direction: column;
    }
    .wiki-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        padding-right: 0;
        padding-bottom: 20px;
    }
    .wiki-main-column {
        width: 100%;
        display: flex;
        flex-direction: column;
    }
    .links-grid {
        grid-template-columns: 1fr;
    }
    .preview-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    .wiki-header h2 {
        font-size: 20px;
    }
}

.previews-section {
    margin-bottom: 30px;
}

.preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
}

.preview-item {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.1);
    opacity: 0;
    animation: fadeInUp 0.4s ease forwards;
    background: #000;
}

.mini-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
}

.preview-item:hover .mini-preview {
    transform: scale(1.1);
}

.actions {
    display: flex;
    gap: 15px;
    margin-top: 30px;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding-top: 20px;
}

.search-posts-btn {
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: #a78bfa;
    color: #fff;
    border: none;
    justify-content: center;
    width: 100%;
    font-family: inherit;
    box-shadow: 0 4px 12px rgba(167, 139, 250, 0.2);
}

.search-posts-btn:hover {
    background: #c084fc;
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(167, 139, 250, 0.4);
}

.danbooru-link {
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    background: rgba(255,255,255,0.05);
    color: #94a3b8;
    border: 1px solid rgba(255,255,255,0.1);
    text-decoration: none;
    justify-content: center;
    width: 100%;
}

.danbooru-link:hover {
    border-color: #64748b;
    color: #fff;
    background: rgba(255,255,255,0.1);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
