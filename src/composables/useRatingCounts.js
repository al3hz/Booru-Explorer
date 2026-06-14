import { ref, watch, onUnmounted } from "vue";
import DanbooruService from "@/services/danbooru";

export function useRatingCountsQuery(currentTags) {
  const ratingCounts = ref({ all: 0, g: 0, s: 0, q: 0, e: 0 });
  const isLoading = ref(false);
  const isLimited = ref(false);
  let controller = null;
  let fetchId = 0;

  const fetchCounts = async (tags) => {
    const id = ++fetchId;
    if (controller) controller.abort();
    controller = new AbortController();
    isLoading.value = true;

    const baseTags = (tags || "").trim();
    isLimited.value = baseTags.split(/\s+/).filter(Boolean).length > 2;

    const getCount = async (t) => {
      try {
        return await DanbooruService.getPostCount(t, controller.signal);
      } catch (err) {
        if (err.name === "AbortError") throw err;
        console.warn("[RatingCounts] Error:", t, err.message);
        return 0;
      }
    };

    try {
      const ratings = ["g", "s", "q", "e"];
      const [all, ...rated] = await Promise.all([
        getCount(baseTags),
        ...ratings.map((r) => getCount(`${baseTags} rating:${r}`.trim())),
      ]);
      if (id === fetchId) {
        ratingCounts.value = { all, g: rated[0], s: rated[1], q: rated[2], e: rated[3] };
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("[RatingCounts] Error:", err);
      }
    } finally {
      if (id === fetchId) {
        isLoading.value = false;
        controller = null;
      }
    }
  };

  watch(currentTags, (val) => {
    fetchCounts(val);
  }, { immediate: true });

  onUnmounted(() => {
    if (controller) controller.abort();
  });

  return { ratingCounts, isLoading, isLimited };
}