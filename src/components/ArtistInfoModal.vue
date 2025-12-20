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

      <div v-else-if="artist" class="artist-content">
        <div class="artist-header">
          <h2><i class="lni lni-brush-alt"></i> {{ artist.name }}</h2>
          <span class="status-badge" :class="{ 'active': !artist.is_deleted && !artist.is_banned, 'inactive': artist.is_deleted || artist.is_banned }">
            {{ getStatusText(artist) }}
          </span>
        </div>

        <div class="info-section">
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

        <!-- Wiki / Commentary if available -->
        <div class="wiki-section" v-if="wikiBody">
            <h3>Wiki Excerpt</h3>
            <div class="wiki-text" v-html="formatWiki(wikiBody)"></div>
        </div>
        
        <div class="actions">
            <button class="search-btn" @click="$emit('search', artist.name)">
                <i class="lni lni-grid-alt"></i> Browse Artworks
            </button>
             <a :href="`https://danbooru.donmai.us/artists/${artist.id}`" target="_blank" class="danbooru-link">
                View on Danbooru <i class="lni lni-link" style="margin-left:5px"></i>
            </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'ArtistInfoModal',
  props: {
    artistName: {
      type: String,
      required: true
    }
  },
  emits: ['close', 'search'],
  setup(props) {
    const artist = ref(null);
    const artistUrls = ref([]);
    const wikiBody = ref('');
    const loading = ref(true);
    const error = ref('');

    const fetchArtistInfo = async () => {
      loading.value = true;
      error.value = '';
      
      try {
        // Fetch Artist Data
        const res = await fetch(`https://danbooru.donmai.us/artists.json?search[name]=${encodeURIComponent(props.artistName)}`);
        if (!res.ok) throw new Error('Failed to fetch artist');
        
        const data = await res.json();
        
        if (data.length === 0) {
            throw new Error('Artist not found in database');
        }
        
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

        const wikiRes = await fetch(`https://danbooru.donmai.us/wiki_pages.json?search[title]=${encodeURIComponent(props.artistName)}`);
        if (wikiRes.ok) {
             const wikiData = await wikiRes.json();
             if (wikiData.length > 0) {
                 wikiBody.value = wikiData[0].body;
             }
        }

      } catch (e) {
        error.value = e.message;
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
        fetchArtistInfo();
    });

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
        if (url.includes('twitter.com') || url.includes('x.com')) return 'lni lni-twitter-original'; // or lni-twitter
        if (url.includes('pixiv.net')) return 'lni lni-brush';
        if (url.includes('instagram.com')) return 'lni lni-instagram-original'; // or lni-instagram
        if (url.includes('patreon.com') || url.includes('fanbox')) return 'lni lni-coin';
        if (url.includes('twitch.tv')) return 'lni lni-twitch';
        if (url.includes('youtube.com')) return 'lni lni-youtube';
        return 'lni lni-link';
    };
    
    const formatWiki = (text) => {
        if (!text) return '';
        let clean = text.replace(/\[\[.*?\|(.*?)\]\]/g, '$1')
                       .replace(/\[\[(.*?)\]\]/g, '$1')
                       .replace(/h\d\.(.*)/g, '<b>$1</b>')
                       .replace(/\[.*?\]/g, ''); 
        
        return clean.length > 300 ? clean.substring(0, 300) + '...' : clean;
    };

    return {
      artist,
      artistUrls,
      wikiBody,
      loading,
      error,
      getStatusText,
      getLinkDomain,
      getLinkIconClass,
      formatWiki
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
