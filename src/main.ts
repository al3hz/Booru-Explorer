import { createApp, type App } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import type { Query, QueryCacheNotifyEvent } from "@tanstack/vue-query";

import "./styles/global.css";
import AppComponent from "./App.vue";
import router from "./router";

// Types for cache persistence
interface CacheItem {
  queryKey: unknown[];
  data: unknown;
  timestamp: number;
}

// Types for filters
interface Filters {
  formatCount: (count: number) => string;
  formatDate: (dateString: string) => string;
  truncate: (text: string, length?: number) => string;
  formatFileSize: (bytes: number) => string;
  sanitizeTag: (tag: string) => string;
}

// Type for error handler
type ErrorHandler = (err: unknown, vm: any, info: string) => void;

// Type for click-outside directive
interface ClickOutsideBinding {
  value: (event: Event) => void;
}

// Type for click-outside element
interface ClickOutsideElement extends HTMLElement {
  clickOutsideEvent?: (event: Event) => void;
}

// Optimized Vue Query configuration for Danbooru
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes

      refetchOnWindowFocus: false,
      refetchOnMount: "always",
      refetchOnReconnect: true,

      // Use placeholderData instead of keepPreviousData if needed
      placeholderData: (previousData: unknown) => previousData,

      retry: (failureCount: number, error: any) => {
        if (
          error?.status >= 400 &&
          error?.status < 500 &&
          error?.status !== 429
        ) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),

      // Remove maxConcurrentQueries and networkTimeout if they don't exist
      // maxConcurrentQueries: 3,
      // networkTimeout: 30000,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Optimized cache persistence
if (typeof window !== "undefined") {
  const VUE_QUERY_CACHE_KEY = "danbooru_query_cache_v1";
  const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  const MAX_CACHE_SIZE = 500000; // 500KB

  // Restore cache from localStorage
  try {
    const cache = localStorage.getItem(VUE_QUERY_CACHE_KEY);
    if (cache) {
      const parsedCache: CacheItem[] = JSON.parse(cache);

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
        } catch (err: unknown) {
          console.warn(
            `Error restoring query ${JSON.stringify(queryKey)}:`,
            err,
          );
        }
      });
    }
  } catch (err: unknown) {
    console.warn("Failed to restore Vue Query cache:", err);
    try {
      localStorage.removeItem(VUE_QUERY_CACHE_KEY);
    } catch {
      // Ignore cleanup error
    }
  }

  // Optimized save system
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isSaving = false;

  const saveCacheToStorage = (): void => {
    if (isSaving) return;

    isSaving = true;
    try {
      const allQueries = queryClient.getQueryCache().getAll();
      const cacheData = allQueries
        .filter((query: Query) => query.state.status === "success")
        .map((query: Query) => ({
          queryKey: query.queryKey,
          data: query.state.data,
          timestamp: Date.now(),
        }))
        .slice(0, 50);

      localStorage.setItem(VUE_QUERY_CACHE_KEY, JSON.stringify(cacheData));
    } catch (err: unknown) {
      console.warn("Error saving cache:", err);

      if (err instanceof Error && err.name === "QuotaExceededError") {
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

  const scheduleCacheSave = (): void => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveCacheToStorage();
      saveTimeout = null;
    }, 10000);
  };

  const queryCache = queryClient.getQueryCache();
  queryCache.subscribe((event: QueryCacheNotifyEvent) => {
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
        const parsedCache: CacheItem[] = JSON.parse(cache);
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
const app: App = createApp(AppComponent);

// Use plugins
app.use(router);
app.use(VueQueryPlugin, { queryClient });

// Global error handler
const errorHandler: ErrorHandler = (error: unknown, vm: any, info: string) => {
  console.error("[Vue Error Handler]", error, info);

  if (
    error instanceof Error &&
    (error.message.includes("Network Error") ||
      error.message.includes("Failed to fetch"))
  ) {
    if (vm && vm.$emit) {
      vm.$emit("network-error", { error, timestamp: new Date() });
    }
  } else if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response &&
    error.response.status === 429
  ) {
    if (vm && vm.$emit) {
      vm.$emit("rate-limit-exceeded", {
        error,
        retryAfter: (error.response as any).headers?.["retry-after"] || 60,
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

  const gtag = (window as any).gtag;
  if (gtag && import.meta.env.PROD) {
    gtag("event", "exception", {
      description: error instanceof Error ? error.message : "Unknown error",
      fatal: false,
    });
  }
};

app.config.errorHandler = errorHandler;

// Global filters
const filters: Filters = {
  formatCount(count: number): string {
    if (typeof count !== "number") return "0";

    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  },

  formatDate(dateString: string): string {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return "Invalid date";

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) {
        return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
      }
      if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      }
      if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      }
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  },

  truncate(text: string, length: number = 50): string {
    if (!text || typeof text !== "string") return "";
    if (text.length <= length) return text;
    return `${text.substring(0, length).trim()}…`;
  },

  formatFileSize(bytes: number): string {
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

  sanitizeTag(tag: string): string {
    if (!tag || typeof tag !== "string") return "";
    return tag
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w:-]/g, "");
  },
};

app.config.globalProperties.$filters = filters;

// Click-outside directive
app.directive("click-outside", {
  beforeMount(el: ClickOutsideElement, binding: ClickOutsideBinding) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value(event);
      }
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el: ClickOutsideElement) {
    if (el.clickOutsideEvent) {
      document.removeEventListener("click", el.clickOutsideEvent);
    }
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
      .catch((error: Error) => {
        console.error("Service Worker registration failed:", error);
      });
  });

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
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
  (window as any).__VUE_APP__ = app;
  (window as any).__VUE_QUERY_CLIENT__ = queryClient;
}

// Export for potential testing
export { app, queryClient };