<template>
  <div class="home-view">
    <div class="app-layout">
      <!-- Mobile Toggle Button -->
      <button 
        class="mobile-menu-trigger" 
        @click="sidebarVisible = !sidebarVisible"
        v-if="!sidebarVisible"
        title="Abrir menú"
      >
        ☰
      </button>

      <!-- Mobile Sidebar Backdrop -->
      <div 
        class="sidebar-backdrop" 
        v-if="sidebarVisible"
        @click="sidebarVisible = false"
      ></div>

      <SearchForm
        :search-query="searchQuery"
        :loading="loading"
        :limit="limit"
        :rating-filter="ratingFilter"
        :posts="posts"
        :sidebar-visible="sidebarVisible"
        :infinite-scroll="infiniteScroll"
        @update:search-query="searchQuery = $event"
        @update:limit="limit = $event"
        @update:rating-filter="ratingFilter = $event"
        @update:infinite-scroll="infiniteScroll = $event"
        @search="handleSearch"
        @example-clicked="setExample"
        @toggle-sidebar="sidebarVisible = !sidebarVisible"
        @trigger-action="handleAction"
      />

      <main class="main-content" :class="{ 'sidebar-open': sidebarVisible }">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <div v-if="searchQuery === 'status:deleted'" class="info-banner deleted-mode">
          <span class="icon">🗑️</span>
          <span>Showing deleted posts</span>
          <button class="clear-mode-btn" @click="handleSearch('')" title="Volver a inicio">✕</button>
        </div>

        <div v-if="searchQuery === 'order:score'" class="info-banner likes-mode">
          <span class="icon">❤️</span>
          <span>Showing most liked posts</span>
          <button class="clear-mode-btn" @click="handleSearch('')" title="Volver a inicio">✕</button>
        </div>

        <div v-if="searchQuery === 'order:favcount'" class="info-banner favs-mode">
          <span class="icon">⭐</span>
          <span>Showing most favorited posts</span>
          <button class="clear-mode-btn" @click="handleSearch('')" title="Volver a inicio">✕</button>
        </div>

        <PostGallery
          :posts="posts"
          :loading="loading"
          :current-page="currentPage"
          :has-next-page="hasNextPage"
          :infinite-scroll="infiniteScroll"
          @change-page="handlePageChange"
          @post-clicked="openModal"
        />
      </main>
    </div>

    <Transition name="modal">
      <ImageDetailModal 
        v-if="selectedPost" 
        :post="selectedPost" 
        @close="selectedPost = null"
        @next="navigatePost(1)"
        @prev="navigatePost(-1)"
        @search-tag="handleTagSearch"
        :has-next="canNext"
        :has-prev="canPrev"
      />
    </Transition>
  </div>
</template>

<script>
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import SearchForm from "../components/SearchForm.vue";
import PostGallery from "../components/PostGallery.vue";
import ImageDetailModal from "../components/ImageDetailModal.vue";
import { useDanbooruApi } from "../composables/useDanbooruApi";

export default {
  name: "HomeView",
  components: {
    SearchForm,
    PostGallery,
    ImageDetailModal,
  },
  setup() {
    const route = useRoute();
    const inputQuery = ref(""); // Lo que escribe el usuario
    const searchQuery = ref(""); // Lo que realmente se está buscando (applied)
    const limit = ref(10);
    const ratingFilter = ref("general");
    const sidebarVisible = ref(window.innerWidth > 768);
    const infiniteScroll = ref(false);
    const selectedPost = ref(null);
    const isRandomMode = ref(false);
    
    // useDanbooruApi usa searchQuery (el valor confirmado)
    const { posts, loading, error, currentPage, hasNextPage, searchPosts } =
      useDanbooruApi(searchQuery, limit, ratingFilter);

    const parsedTags = computed(() => {
      // Usamos inputQuery o searchQuery? Para visualizar lo que se busca: searchQuery
      return searchQuery.value
        .trim()
        .split(/[,，\s]+/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    });

    const currentPostIndex = computed(() => {
      if (!selectedPost.value) return -1;
      return posts.value.findIndex(p => p.id === selectedPost.value.id);
    });

    const canPrev = computed(() => {
        if (!selectedPost.value || isRandomMode.value) return false;
        // Puede ir atras si:
        // 1. Hay un post anterior en la lista actual (index > 0)
        // 2. O estamos en una pagina > 1 (puede cargar anterior pagina)
        return currentPostIndex.value > 0 || currentPage.value > 1;
    });

    const canNext = computed(() => {
         if (!selectedPost.value || isRandomMode.value) return false;
         // Puede ir adelante si:
         // 1. Hay un post siguiente en la lista actual
         // 2. O hay mas paginas disponibles
         return currentPostIndex.value < posts.value.length - 1 || hasNextPage.value;
    });

    const openModal = (post) => {
      isRandomMode.value = false;
      selectedPost.value = post;
    };

    const navigatePost = async (direction) => {
      if (!selectedPost.value || isRandomMode.value) return;
      
      const index = posts.value.findIndex(p => p.id === selectedPost.value.id);
      
      // Si por alguna razón el post no está en la lista actual (edge case), no hacemos nada
      if (index === -1) return;
      
      const newIndex = index + direction;
      
      // Caso 1: Navegación dentro de la página actual
      if (newIndex >= 0 && newIndex < posts.value.length) {
        selectedPost.value = posts.value[newIndex];
        return;
      }

      // Caso 2: Siguiente página (Infinite Next)
      if (newIndex >= posts.value.length) {
        if (hasNextPage.value && !loading.value) {
          const nextPage = currentPage.value + 1;
          await handlePageChange(nextPage);
          if (posts.value.length > 0) {
            selectedPost.value = posts.value[0];
          }
        }
        return;
      }

      // Caso 3: Página anterior (Infinite Prev)
      if (newIndex < 0) {
        if (currentPage.value > 1 && !loading.value) {
          const prevPage = currentPage.value - 1;
          await handlePageChange(prevPage);
          if (posts.value.length > 0) {
            selectedPost.value = posts.value[posts.value.length - 1];
          }
        }
        return;
      }
    };

    // Acción explicita de buscar (Enter o Botón)
    const handleSearch = async (overrideQuery) => {
      // Si overrideQuery es string (viene de click en tag), úsalo. Si es evento o nulo, usa inputQuery.
      const finalQuery = (typeof overrideQuery === 'string') ? overrideQuery : inputQuery.value;

      // Sincronizar inputQuery si vino por override para que el input se actualice visualmente (aunque ya el v-model debería haberlo hecho, esto asegura)
      if (typeof overrideQuery === 'string') {
         inputQuery.value = overrideQuery;
      }

      // Auto-close sidebar on mobile
      if (window.innerWidth <= 768) {
        sidebarVisible.value = false;
      }

      isRandomMode.value = false;
      searchQuery.value = finalQuery; // CONFIRMAMOS el texto
      currentPage.value = 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
      await searchPosts(1, true);

      // Si no hay resultados, verificamos si hay tags inválidos
      if (posts.value.length === 0) {
        
        const currentTags = searchQuery.value
          .trim()
          .split(/[,，\s]+/)
          .filter(t => t.length > 0);

        if (currentTags.length > 0) {
          try {
            // Validamos cada tag individualmente para mayor seguridad
            // Limitamos a 5 tags para no saturar el rate limit (10 req/s)
            const tagsToValidate = currentTags.slice(0, 5);
            
            const validationPromises = tagsToValidate.map(async (tag) => {
              // search[name] busca coincidencia exacta
              const res = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${tag}`);
              if (res.ok) {
                const data = await res.json();
                return data.length > 0 ? tag : null;
              }
              return null;
            });

            const validatedResults = await Promise.all(validationPromises);
            const validTags = validatedResults.filter(t => t !== null);

            // Si se encontraron tags válidos (o si al menos uno era inválido y se borró)
            // Solo actualizamos si la cantidad de tags validos es menor a la original
            // (lo que implica que alguno era malo)
            // Ojo: Si validTags es 0 y currentTags > 0, borra todo (lo cual es correcto si todo es invalido)
            // Pero si el usuario dice "me borra todo", es porque quizas 1 era valido.
            
            if (validTags.length < tagsToValidate.length) {
              const cleanedQuery = validTags.join(' ');
              // inputQuery.value = cleanedQuery; // DESACTIVADO: No borrar input del usuario
              // searchQuery.value = cleanedQuery;
              
              if (cleanedQuery === '') {
                 // Si realmente todo estaba mal
                 error.value = 'Ningún tag válido encontrado.';
              } else {
                 error.value = 'Algunos tags no existen.';
              }
              
              // Opcional: Re-buscar si quedó algo válido
              if (cleanedQuery !== '') {
                 // searchPosts(1, true); // Descomentar si queremos auto-buscar
              }
            } else if (currentTags.length > 5) {
               // Si había mas de 5, no borramos nada por precaución
               error.value = 'Demasiados tags para validar automáticamente.';
            }

          } catch (e) {
            console.error("Error validando tags", e);
          }
        }
      }
    };

    const loadPage = async (page) => {
      // searchPosts usa internamente searchQuery, que no ha cambiado si solo escribimos en el input
      await searchPosts(page, true);
    };

    const handlePageChange = async (page) => {
      await loadPage(page);
      if (!selectedPost.value) {
         window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    const setExample = (example) => {
      inputQuery.value = example;
      handleSearch(); // Esto hará commit del example a searchQuery
    };

    // Watch para cambios en ratingFilter o limit
    // Estos refrescan la búsqueda ACTUAL (searchQuery), no lo que se esté escribiendo pendiente
    watch([ratingFilter, limit], () => {
      currentPage.value = 1;
      searchPosts(1, true);
    });

    // Keyboard navigation
    const handleKeydown = (e) => {
      // Ignore if typing in an input or textarea
      const target = e.target;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      // Si el modal está abierto, usamos A/D para navegar imágenes
      if (selectedPost.value) {
        if (key === 'a' || key === 'arrowleft') {
          navigatePost(-1);
        } else if (key === 'd' || key === 'arrowright') {
          navigatePost(1);
        }
        return;
      }

      // Si el modal está cerrado, paginación normal
      if (key === 'a') {
        if (currentPage.value > 1) {
          handlePageChange(currentPage.value - 1);
        }
      } else if (key === 'd') {
        if (hasNextPage.value) {
          handlePageChange(currentPage.value + 1);
        }
      }
    };

    // Cargar datos al montar el componente
    onMounted(() => {
      // Check for query params
      if (route.query.tags) {
        inputQuery.value = route.query.tags;
        searchQuery.value = route.query.tags;
      }
      
      searchPosts(1, true);
      window.addEventListener('keydown', handleKeydown);
    });

    // Watch for route query changes (navigation from other views or same view)
    watch(() => route.query.tags, (newTags) => {
      if (newTags) {
        inputQuery.value = newTags;
        searchQuery.value = newTags;
        isRandomMode.value = false;
        searchPosts(1, true);
      } else if (route.query.tags === undefined && searchQuery.value !== '') {
          // If tags param removed, maybe clear search? Or do nothing. 
          // user might have manually cleared url.
      }
    });

    // Dynamic Title Logic
    watch(searchQuery, (newVal) => {
      if (newVal) {
        // Format: "tag1 AND tag2 | Booru Explorer"
        const formattedTags = newVal.split(/[,，\s]+/).filter(t => t).join(' AND ');
        document.title = `${formattedTags} | Booru Explorer`;
      } else {
        document.title = 'Booru Explorer | Anime Image Board';
      }
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
    });

    // Optimize background videos when modal is open
    watch(selectedPost, (newPost) => {
      // PostGallery uses .art-card video
      const videos = document.querySelectorAll('.post-gallery video');
      videos.forEach(video => {
        if (newPost) {
          video.pause();
        } else {
          try {
            video.play();
          } catch (e) {
            // Ignore auto-play errors
          }
        }
      });
    });

    const handleTagSearch = async (tag) => {
       isRandomMode.value = false;
       inputQuery.value = tag;
       searchQuery.value = tag;
       selectedPost.value = null; // Cerrar modal
       await searchPosts(1, true);
    };

    const handleAction = async (action) => {
      if (action === 'deleted') {
        isRandomMode.value = false;
        inputQuery.value = 'status:deleted';
        handleSearch();
      } else if (action === 'most-liked') {
        isRandomMode.value = false;
        inputQuery.value = 'order:score';
        handleSearch();
      } else if (action === 'most-favorited') {
        isRandomMode.value = false;
        inputQuery.value = 'order:favcount';
        handleSearch();
      } else if (action === 'random') {
        isRandomMode.value = true;
        try {
          // Usamos el endpoint dedicado /posts/random.json que es más rápido y no failea por timeout
          const res = await fetch(`https://danbooru.donmai.us/posts/random.json`);
          if (res.ok) {
            const data = await res.json();
            // Este endpoint devuelve un solo objeto, no un array
            if (data && data.id) {
              selectedPost.value = data;
            }
          }
        } catch (e) {
          console.error("Error fetching random post", e);
        }
      } else if (action === 'related') {
        console.log("Related action clicked - Placeholder");
      }
    };

    return {
      searchQuery: inputQuery, // Pasamos inputQuery al form para que escriba ahí
      posts,
      loading,
      error,
      limit,
      ratingFilter,
      currentPage,
      hasNextPage,
      parsedTags,
      sidebarVisible,
      infiniteScroll,
      handleSearch,
      handleTagSearch,
      handlePageChange,
      loadPage,
      setExample,
      selectedPost,
      openModal,
      navigatePost,
      canNext,
      canPrev,
      handleAction
    };
  },
};
</script>

<style scoped>


/* Image Slide Transition */
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

.info-banner {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
}

.info-banner.deleted-mode {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.info-banner.likes-mode {
  background: rgba(236, 72, 153, 0.15); /* Pinkish */
  border-color: rgba(236, 72, 153, 0.3);
  color: #fbcfe8;
}

.info-banner.favs-mode {
  background: rgba(251, 191, 36, 0.15); /* Amber/Gold */
  border-color: rgba(251, 191, 36, 0.3);
  color: #fde68a;
}

.clear-mode-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  padding: 4px;
}

.clear-mode-btn:hover {
  opacity: 1;
}

/* Mobile Responsiveness Styles */
.mobile-menu-trigger {
  display: none; /* Hidden on desktop */
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .mobile-menu-trigger {
    display: flex;
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #a78bfa;
    color: white;
    border: none;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 4px 15px rgba(167, 139, 250, 0.4);
    z-index: 900;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .mobile-menu-trigger:active {
    transform: scale(0.9);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 998; /* Below sidebar (1000), above content */
  }
}
</style>
