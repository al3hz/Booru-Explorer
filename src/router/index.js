import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

// Configuración centralizada
const APP_TITLE = "Booru Explorer";
const DEFAULT_TITLE = `${APP_TITLE} | Anime Image Board`;

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  // Scroll behavior mejorado
  scrollBehavior(to, from, savedPosition) {
    // 1. Posición guardada (navegador back/forward)
    if (savedPosition) {
      return savedPosition;
    }

    // 2. Hash anchor con validación
    if (to.hash) {
      return {
        el: to.hash,
        behavior: "smooth",
        // Asegurar que el elemento exista
        top: 80, // Offset para header fijo
      };
    }

    // 3. Diferenciar entre navegaciones
    if (from.path === to.path) {
      // Misma ruta, diferente query (búsquedas)
      return { top: 0, behavior: "smooth" };
    }

    // 4. Nueva ruta - scroll al top
    return { top: 0, behavior: "smooth" };
  },

  // Rutas con lazy loading optimizado
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: {
        title: DEFAULT_TITLE,
        transition: "fade",
        requiresAuth: false,
        keepAlive: true, // Cache para home
        scrollToTop: true,
      },
    },
    {
      path: "/comments",
      name: "comments",
      component: () => import("../views/CommentsView.vue"),
      meta: {
        title: `Comments | ${APP_TITLE}`,
        transition: "slide",
        requiresAuth: false,
        scrollToTop: true,
      },
    },
    {
      path: "/wiki/:query",
      name: "wiki",
      component: () => import("../views/WikiView.vue"),
      props: true, // Pasar params como props
      meta: {
        title: `Wiki | ${APP_TITLE}`,
        transition: "slide",
        requiresAuth: false,
        scrollToTop: true,
      },
    },
    {
      path: "/pools",
      name: "pools",
      component: () => import("../views/PoolsView.vue"),
      meta: {
        title: `Pools | ${APP_TITLE}`,
        transition: "slide",
        requiresAuth: false,
        scrollToTop: true,
      },
    },
    {
      path: "/pools/:id",
      name: "pool-detail",
      component: () => import("../views/PoolDetailView.vue"),
      props: true, // Pasar params como props
      meta: {
        title: `Pool | ${APP_TITLE}`,
        transition: "slide",
        requiresAuth: false,
        scrollToTop: true,
      },
    },
    // 404 catch-all route (opcional pero recomendado)
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("../views/NotFoundView.vue"),
      meta: {
        title: `Page Not Found | ${APP_TITLE}`,
        transition: "fade",
        scrollToTop: true,
      },
    },
  ],
});

// Global navigation guards
router.beforeEach((to, from, next) => {
  // Aquí puedes agregar lógica de autenticación si es necesario
  // Ejemplo: if (to.meta.requiresAuth && !isAuthenticated) next('/login')

  // Scroll to top basado en meta
  if (to.meta.scrollToTop) {
    window.scrollTo(0, 0);
  }

  next();
});

// After each navigation hook
router.afterEach((to, from) => {
  // Update document title
  const title = to.meta.title || DEFAULT_TITLE;
  document.title = title;

  // Optional: Analytics tracking
  if (import.meta.env.PROD) {
    console.log(`Route change: ${from.path} -> ${to.path}`);
    // Aquí podrías integrar Google Analytics, etc.
  }

  // Optional: Update meta tags dinámicamente
  updateMetaTags(to);
});

// Helper para meta tags dinámicos
function updateMetaTags(route) {
  // Meta tags básicos para SEO
  const metaTags = {
    description:
      "Explore anime images from Danbooru with advanced search and filtering.",
    ogTitle: route.meta.title || DEFAULT_TITLE,
    ogDescription:
      "Advanced Danbooru image browser with smart search and filtering.",
    ogImage: "/og-image.png", // Ruta a imagen OG
    ogUrl: window.location.origin + route.path,
  };

  // Actualizar meta tags existentes o crearlos
  updateMetaTag("description", metaTags.description);
  updateMetaTag("og:title", metaTags.ogTitle);
  updateMetaTag("og:description", metaTags.ogDescription);
  updateMetaTag("og:image", metaTags.ogImage);
  updateMetaTag("og:url", metaTags.ogUrl);
}

function updateMetaTag(name, content) {
  let tag =
    document.querySelector(`meta[name="${name}"]`) ||
    document.querySelector(`meta[property="${name}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    if (name.startsWith("og:")) {
      tag.setAttribute("property", name);
    } else {
      tag.setAttribute("name", name);
    }
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

// Error handling
router.onError((error) => {
  console.error("Router error:", error);

  // Optional: redirigir a página de error
  if (error.message.includes("Failed to fetch dynamically imported module")) {
    // Chunk loading failed, podría ser conexión lenta
    console.warn("Chunk loading failed, retrying or showing error state");
  }
});

export default router;
