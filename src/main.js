import { createApp } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

import "./styles/global.css";
import App from "./App.vue";
import router from "./router";

// ==========================================
// CONFIGURACIÓN QUERY CLIENT
// ==========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tiempo que los datos se consideran "frescos" (5 min)
      staleTime: 5 * 60 * 1000,

      // Tiempo que permanecen en caché tras dejar de usar (10 min)
      gcTime: 10 * 60 * 1000,

      // Comportamiento de refetch
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,

      // Mantener datos anteriores mientras cargan nuevos (UX fluida)
      placeholderData: (previousData) => previousData,

      // Retry configurado
      retry: (failureCount, error) => {
        // No reintentamos errores 4xx (cliente)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 2; // Máximo 2 reintentos
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Cancelar queries cuando no hay conexión
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 0,
    },
  },
});

// ==========================================
// PERSISTENCIA DE CACHÉ (Browser only)
// ==========================================
if (typeof window !== "undefined") {
  const CACHE_KEY = "booru_query_cache";
  const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 horas

  const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: CACHE_KEY,

    // Serialización con manejo de errores
    serialize: (data) => {
      try {
        return JSON.stringify(data);
      } catch {
        return "";
      }
    },

    // Deserialización con validación
    deserialize: (data) => {
      if (!data) return undefined;
      try {
        const parsed = JSON.parse(data);
        // Validar estructura mínima
        if (!parsed || typeof parsed !== "object") {
          return undefined;
        }
        return parsed;
      } catch {
        console.warn("[Cache] Cache corrupto, limpiando...");
        localStorage.removeItem(CACHE_KEY);
        return undefined;
      }
    },
  });

  // Configurar persistencia
  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    maxAge: MAX_CACHE_AGE,

    // Dehydrate options: qué queries persistir
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Solo persistir queries exitosas
        if (query.state.status !== "success") return false;

        // No persistir queries efímeras o de sesión
        const queryKey = query.queryKey;
        if (
          Array.isArray(queryKey) &&
          (queryKey.includes("temp") || queryKey.includes("session"))
        ) {
          return false;
        }

        return true;
      },
    },

    // Manejo de caché lleno
    buster: "v2", // Versión del caché (cambiar para invalidar todo)
  });

  // Limpieza proactiva de queries antiguas (cada 5 min)
  setInterval(
    () => {
      const cache = queryClient.getQueryCache();
      const now = Date.now();
      const queries = cache.getAll();

      queries.forEach((query) => {
        const lastUpdated = query.state.dataUpdatedAt;
        // Limpiar queries no usadas en 24h
        if (now - lastUpdated > MAX_CACHE_AGE) {
          cache.remove(query);
        }
      });
    },
    5 * 60 * 1000,
  );
}

// ==========================================
// UTILIDADES (Reemplazo de $filters)
// ==========================================
// Estas funciones se importarán donde se necesiten en lugar de globalProperties
export const utils = {
  formatCount(count) {
    if (!count && count !== 0) return "0";
    const num = Number(count);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
    return num.toString();
  },

  formatDate(dateString) {
    if (!dateString) return "Unknown";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  truncate(text, length = 50) {
    if (!text || typeof text !== "string") return "";
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + "...";
  },

  // Nueva utilidad útil para el proyecto
  sanitizeTag(tag) {
    return tag
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_{2,}/g, "_");
  },
};

// ==========================================
// CREACIÓN DE LA APP
// ==========================================
const app = createApp(App);

// Plugins
app.use(router);
app.use(VueQueryPlugin, {
  queryClient,
  // Opcional: habilitar devtools en producción si es necesario
  enableDevtoolsV6Plugin: import.meta.env.DEV,
});

// ==========================================
// MANEJO GLOBAL DE ERRORES
// ==========================================
app.config.errorHandler = (err, instance, info) => {
  // Log estructurado para debugging
  console.error("[Vue Error]", {
    error: err,
    component: instance?.$options?.name || "Anonymous",
    info: info,
    timestamp: new Date().toISOString(),
  });

  // En desarrollo: más detalles
  if (import.meta.env.DEV) {
    console.group("Stack trace");
    console.error(err.stack);
    console.groupEnd();
  }
};

app.config.warnHandler = (msg, instance, trace) => {
  // Silenciar warnings específicos en producción
  if (import.meta.env.PROD && msg.includes("feature")) return;

  console.warn("[Vue Warning]", msg);
  if (import.meta.env.DEV) {
    console.log("Trace:", trace);
  }
};

// ==========================================
// SERVICE WORKER (PWA)
// ==========================================
// ==========================================
// SERVICE WORKER (Desactivado/Limpieza)
// ==========================================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log("[SW] Desregistrando Service Worker:", registration);
      registration.unregister();
    }
  });
}

// Montar app
app.mount("#app");

// Exportar queryClient para uso en composables fuera de componentes
export { queryClient };
