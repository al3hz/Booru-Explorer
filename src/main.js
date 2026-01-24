import { createApp } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";

import "./styles/global.css";
import App from "./App.vue";
import router from "./router";

// Optimized Vue Query configuration for Danbooru
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,

      refetchOnWindowFocus: false,
      refetchOnMount: "always",
      refetchOnReconnect: true,

      keepPreviousData: true,

      retry: (failureCount, error) => {
        if (
          error?.status >= 400 &&
          error?.status < 500 &&
          error?.status !== 429
        ) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      networkMode: "online",
      maxConcurrentQueries: 3,
      networkTimeout: 30000,
    },
    mutations: {
      retry: 0,
      networkMode: "online",
    },
  },
});

// Optimized cache persistence
if (typeof window !== "undefined") {
  const VUE_QUERY_CACHE_KEY = "danbooru_query_cache_v1";
  const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;
  const MAX_CACHE_SIZE = 500000;

  // Restore cache from localStorage
  try {
    const cache = localStorage.getItem(VUE_QUERY_CACHE_KEY);
    if (cache) {
      const parsedCache = JSON.parse(cache);

      const recentCache = parsedCache.filter((item) => {
        const isRecent = Date.now() - item.timestamp < MAX_CACHE_AGE;
        const size = JSON.stringify(item.data).length;
        return isRecent && size < MAX_CACHE_SIZE;
      });

      recentCache.forEach(({ queryKey, data }) => {
        try {
          if (queryKey && data) {
            queryClient.setQueryData(queryKey, data);
          }
        } catch (err) {
          console.warn(
            `Error restoring query ${JSON.stringify(queryKey)}:`,
            err,
          );
        }
      });
    }
  } catch (err) {
    console.warn("Failed to restore Vue Query cache:", err);
    try {
      localStorage.removeItem(VUE_QUERY_CACHE_KEY);
    } catch {
      // Ignore cleanup error
    }
  }

  // Optimized save system
  let saveTimeout = null;
  let isSaving = false;

  const saveCacheToStorage = () => {
    if (isSaving) return;

    isSaving = true;
    try {
      const allQueries = queryClient.getQueryCache().getAll();
      const cacheData = allQueries
        .filter((query) => query.state.status === "success")
        .map((query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
          timestamp: Date.now(),
        }))
        .slice(0, 50);

      localStorage.setItem(VUE_QUERY_CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.warn("Error saving cache:", err);

      if (err?.name === "QuotaExceededError") {
        try {
          localStorage.removeItem(VUE_QUERY_CACHE_KEY);
        } catch {
          // Ignore cleanup error
        }
      }
    } finally {
      isSaving = false;
    }
  };

  const scheduleCacheSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveCacheToStorage();
      saveTimeout = null;
    }, 10000);
  };

  const queryCache = queryClient.getQueryCache();
  queryCache.subscribe((event) => {
    if (event.type === "updated" && event.query.state.status === "success") {
      scheduleCacheSave();
    }
  });

  window.addEventListener("beforeunload", () => {
    saveCacheToStorage();
  });

  setTimeout(() => {
    try {
      const cache = localStorage.getItem(VUE_QUERY_CACHE_KEY);
      if (cache) {
        const parsedCache = JSON.parse(cache);
        const freshCache = parsedCache.filter(
          (item) => Date.now() - item.timestamp < MAX_CACHE_AGE,
        );

        if (freshCache.length < parsedCache.length) {
          localStorage.setItem(VUE_QUERY_CACHE_KEY, JSON.stringify(freshCache));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }, 5000);
}

// Create Vue app
const app = createApp(App);

// Use plugins
app.use(router);
app.use(VueQueryPlugin, { queryClient });

// Global error handler
app.config.errorHandler = (error, vm, info) => {
  console.error("[Vue Error Handler]", error, info);

  if (
    error?.message?.includes("Network Error") ||
    error?.message?.includes("Failed to fetch")
  ) {
    if (vm && vm.$emit) {
      vm.$emit("network-error", { error, timestamp: new Date() });
    }
  } else if (error?.response?.status === 429) {
    if (vm && vm.$emit) {
      vm.$emit("rate-limit-exceeded", {
        error,
        retryAfter: error.response.headers?.["retry-after"] || 60,
      });
    }
  }

  if (import.meta.env.DEV) {
    console.groupCollapsed("Error Details");
    console.error("Error:", error);
    console.info("Type:", info);
    console.log("Component:", vm?.$options?.name || "Anonymous component");
    console.groupEnd();
  }

  if (window.gtag && import.meta.env.PROD) {
    window.gtag("event", "exception", {
      description: error.message,
      fatal: false,
    });
  }
};

// Global filters
app.config.globalProperties.$filters = {
  formatCount(count) {
    if (typeof count !== "number") return "0";

    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  },

  formatDate(dateString) {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return "Invalid date";

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60)
        return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
      if (diffHours < 24)
        return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      if (diffDays < 7)
        return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      if (diffDays < 30)
        return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? "s" : ""} ago`;

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  },

  truncate(text, length = 50) {
    if (!text || typeof text !== "string") return "";
    if (text.length <= length) return text;
    return `${text.substring(0, length).trim()}…`;
  },

  formatFileSize(bytes) {
    if (typeof bytes !== "number" || bytes < 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  },

  sanitizeTag(tag) {
    if (!tag || typeof tag !== "string") return "";
    return tag
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w:-]/g, "");
  },
};

// Click-outside directive
app.directive("click-outside", {
  beforeMount(el, binding) {
    el.clickOutsideEvent = function (event) {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener("click", el.clickOutsideEvent);
  },
});

// Mount application
app.mount("#app");

// Register Service Worker
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "CACHE_UPDATED") {
      // Handle cache update if needed
    }
  });
}

// Connection handling
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    queryClient.refetchQueries({ type: "active" });
    app.config.globalProperties.$emit?.("connection-changed", { online: true });
  });

  window.addEventListener("offline", () => {
    app.config.globalProperties.$emit?.("connection-changed", {
      online: false,
    });
  });
}

// Debug in development
if (import.meta.env.DEV) {
  window.__VUE_APP__ = app;
  window.__VUE_QUERY_CLIENT__ = queryClient;
}
