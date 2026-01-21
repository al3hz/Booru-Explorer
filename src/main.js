import { createApp } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";

import "./styles/global.css";
import App from "./App.vue";
import router from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,

      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,

      keepPreviousData: true,

      retry: 1,
      retryDelay: 1000,

      networkMode: "online",
    },
    mutations: {
      retry: 0,
    },
  },
});

if (typeof window !== "undefined") {
  const VUE_QUERY_CACHE_KEY = "danbooru_query_cache_v1";

  try {
    const cache = localStorage.getItem(VUE_QUERY_CACHE_KEY);
    if (cache) {
      const parsedCache = JSON.parse(cache);

      const recentCache = parsedCache.filter(
        (item) => Date.now() - item.timestamp < 24 * 60 * 60 * 1000,
      );
      queryClient.setQueryData(recentCache);
    }
  } catch (e) {
    console.warn("No se pudo restaurar cache de Vue Query:", e);
  }

  setInterval(() => {
    try {
      const allQueries = queryClient.getQueryCache().getAll();
      const cacheData = allQueries
        .filter((query) => query.state.status === "success")
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
          timestamp: Date.now(),
        }));

      localStorage.setItem(VUE_QUERY_CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("Error guardando cache:", e);
    }
  }, 30000);
}

const app = createApp(App);

app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.config.errorHandler = (err, vm, info) => {
  console.error("[Vue Error Handler]", err, info);

  if (import.meta.env.DEV) {
    console.warn("Component donde ocurrió:", vm);
  }
};

app.config.globalProperties.$filters = {
  formatCount(count) {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
    if (count >= 1000) return (count / 1000).toFixed(1) + "k";
    return count.toString();
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  },

  truncate(text, length = 50) {
    if (text.length <= length) return text;
    return text.substring(0, length) + "...";
  },
};

app.mount("#app");

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.log("Service Worker registration failed:", error);
    });
  });
}
