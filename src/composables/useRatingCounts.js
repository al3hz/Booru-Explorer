import { ref } from 'vue';

// Constants
const RATINGS = ['g', 's', 'q', 'e'];
const API_BASE = 'https://danbooru.donmai.us';
const ZERO_COUNT = { count: null, isApproximate: false };

// Global state (Singleton)
const ratingCounts = ref(Object.fromEntries(
  RATINGS.map(rating => [rating, { ...ZERO_COUNT }])
));
const loadingCounts = ref(false);
const isLimited = ref(false);
const tagCount = ref(null);
let currentRequestId = 0;

/**
 * Clean and normalize search tags
 */
function cleanAndNormalizeTags(tags = '') {
  // Remove existing rating and order filters
  let cleaned = tags
    .replace(/rating:[a-z]+/gi, '')
    .replace(/order:[a-z_]+/gi, '')
    .trim();
  
  // Ensure status filter is present
  if (!cleaned.includes('status:')) {
    cleaned = `${cleaned} -status:deleted`.trim();
  }
  
  // Normalize whitespace
  return cleaned.replace(/\s+/g, ' ');
}

/**
 * Extract individual words from tags (excluding modifiers)
 */
function extractTagWords(tags) {
  return tags
    .replace(/-status:deleted/g, '')
    .split(/\s+/)
    .filter(word => word && !word.includes(':'))
    .map(word => word.replace(/^-/, '')); // Remove negation prefix for counting
}

/**
 * Check if query is a simple single tag search
 */
function isSingleTagQuery(tags) {
  const words = extractTagWords(tags);
  return words.length === 1 && words[0];
}

/**
 * Fetch accurate total count from appropriate API
 */
async function fetchTotalCount(tags) {
  try {
    if (isSingleTagQuery(tags)) {
      const tagName = extractTagWords(tags)[0];
      const res = await fetch(`${API_BASE}/tags.json?search[name]=${encodeURIComponent(tagName)}`);
      
      if (!res.ok) throw new Error(`Tags API failed: ${res.status}`);
      
      const data = await res.json();
      return data?.[0]?.post_count || null;
    } else {
      const totalQuery = tags || '-status:deleted';
      const params = new URLSearchParams({ tags: totalQuery });
      const res = await fetch(`${API_BASE}/counts/posts.json?${params.toString()}`);
      
      if (!res.ok) throw new Error(`Counts API failed: ${res.status}`);
      
      const data = await res.json();
      return data?.counts?.posts ?? null;
    }
  } catch (error) {
    console.warn('Failed to fetch total count:', error.message);
    return null;
  }
}

/**
 * Fetch rating count with fallback strategies
 */
async function fetchRatingCount(query) {
  // Try precise query first
  try {
    const params = new URLSearchParams({ tags: query });
    const res = await fetch(`${API_BASE}/counts/posts.json?${params.toString()}`);
    
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    
    const data = await res.json();
    const count = data?.counts?.posts;
    
    if (typeof count === 'number') {
      return { count, isApproximate: false };
    }
  } catch {
    // Continue to fallback
  }
  
  return null;
}

export function useRatingCounts() {
  /**
   * Main function to fetch rating breakdown
   */
  const fetchRatingCounts = async (baseTags) => {
    const requestId = ++currentRequestId;
    
    // Reset state
    loadingCounts.value = true;
    isLimited.value = false;
    tagCount.value = null;
    ratingCounts.value = Object.fromEntries(
      RATINGS.map(r => [r, { ...ZERO_COUNT }])
    );

    // Process tags
    const tags = cleanAndNormalizeTags(baseTags);
    const cleanTags = tags.replace('-status:deleted', '').trim();
    
    // Fetch total count in parallel with rating counts
    const totalCountPromise = fetchTotalCount(tags);
    
    // Fetch all rating counts
    const ratingPromises = RATINGS.map(async (rating) => {
      // Attempt 1: Precise query (with -status:deleted)
      if (tags) {
        const result = await fetchRatingCount(`${tags} rating:${rating}`, rating);
        if (result) return result;
      }
      
      // Attempt 2: Fallback query (without -status:deleted for approximate)
      if (cleanTags) {
        const result = await fetchRatingCount(`${cleanTags} rating:${rating}`, rating);
        if (result) return { ...result, isApproximate: true };
      }
      
      // Attempt 3: Global rating count only
      const result = await fetchRatingCount(`rating:${rating}`, rating);
      return result ? { ...result, isApproximate: true } : null;
    });

    try {
      const [totalCount, ...ratingResults] = await Promise.all([
        totalCountPromise,
        ...ratingPromises
      ]);
      
      // Check if this request is still valid
      if (requestId !== currentRequestId) return;
      
      // Update total count
      tagCount.value = totalCount;
      
      // Process rating results
      const allFailed = ratingResults.every(r => r === null);
      const someFailed = ratingResults.some(r => r === null);
      
      if (allFailed) {
        isLimited.value = true;
      } else if (someFailed && totalCount && totalCount > 0) {
        // We have posts but couldn't get all ratings - likely API limit
        isLimited.value = true;
      }
      
      // Update rating counts with safe defaults
      ratingCounts.value = Object.fromEntries(
        RATINGS.map((rating, index) => [
          rating,
          ratingResults[index] || { ...ZERO_COUNT }
        ])
      );
      
    } catch (error) {
      if (requestId !== currentRequestId) return;
      
      console.error('Error fetching rating counts:', error);
      isLimited.value = true;
      ratingCounts.value = Object.fromEntries(
        RATINGS.map(r => [r, { ...ZERO_COUNT }])
      );
    } finally {
      if (requestId === currentRequestId) {
        loadingCounts.value = false;
      }
    }
  };

  return {
    ratingCounts,
    loadingCounts,
    isLimited,
    tagCount,
    fetchRatingCounts
  };
}