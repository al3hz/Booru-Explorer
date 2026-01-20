
/**
 * Danbooru API Service
 * Centralizes all interactions with the backend proxy /api/danbooru
 */

const API_BASE = '/api/danbooru';

class DanbooruService {
    /**
     * Helper to build the proxy URL
     * @param {string} danbooruPath - The path on the Danbooru API (e.g. 'posts.json')
     * @param {object} params - Query parameters to append
     */
    _buildUrl(danbooruPath, params = {}) {
        // Ensure path doesn't start with / to avoid double slashes if needed, 
        // though the proxy handles it.
        const cleanPath = danbooruPath.startsWith('/') ? danbooruPath.slice(1) : danbooruPath;

        // Move 'url' parameter to the main query string for the proxy
        const proxySearchParams = new URLSearchParams();
        proxySearchParams.set('url', cleanPath);

        // Append all other params to the proxy URL. 
        // The backend logic is: /api/danbooru?url=path&param1=val1...
        // So we just add them normally.
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                proxySearchParams.append(key, value);
            }
        });

        return `${API_BASE}?${proxySearchParams.toString()}`;
    }

    async _fetch(danbooruPath, params = {}) {
        const url = this._buildUrl(danbooruPath, params);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Danbooru API Error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }

    // --- Posts ---

    async getPosts(tags = '', limit = 20, page = 1) {
        // Normalize tags: Add status:active by default if no status: is specified
        let normalizedTags = tags.trim();
        if (!normalizedTags.includes('status:')) {
            normalizedTags = normalizedTags ? `${normalizedTags} status:active` : 'status:active';
        }

        // Check for "Smart Search" condition (more than 2 tags total)
        const tagList = normalizedTags.split(' ').filter(t => t.trim() !== '');
        const metaPrefixes = ['rating:', 'order:', 'status:', 'date:', 'user:', 'fav:', 'score:', 'id:', 'width:', 'height:', 'mpixels:', 'ratio:', 'source:', 'parent:'];

        // Separate real content tags from meta-tags
        const contentTags = tagList.filter(t => !metaPrefixes.some(p => t.startsWith(p)) && !t.startsWith('-'));
        const metaTags = tagList.filter(t => metaPrefixes.some(p => t.startsWith(p)) || t.startsWith('-'));

        // If the TOTAL number of tags is <= 2, use standard fetch.
        if (tagList.length <= 2) {
            return this._fetchPostsStandard(normalizedTags, limit, page);
        }


        // SMART SEARCH: > 2 total tags
        // Prioritize which tags to send to the API (limit to 2 total)
        const priorityTags = [];
        const orderTag = metaTags.find(t => t.startsWith('order:'));
        if (orderTag) priorityTags.push(orderTag);

        // Fill with content tags first, then other meta tags
        for (const t of contentTags) if (priorityTags.length < 2) priorityTags.push(t);
        for (const t of metaTags) if (t !== orderTag && priorityTags.length < 2) priorityTags.push(t);

        const apiTags = priorityTags.join(' ');
        const filterTags = tagList.filter(t => !priorityTags.includes(t));

        console.log(`[Smart Search] API: "${apiTags}" | Client Filter: [${filterTags.join(', ')}]`);

        try {
            // STATEFUL PAGINATION LOGIC
            // We need to keep fetching API pages until we fill 'limit'

            // Generate a unique key for this search query to track cursors
            const queryKey = `smart_${apiTags}_${filterTags.join('_')}`;
            if (!this._smartCursors) this._smartCursors = {};

            // Determine start API page
            // If page 1, start at 1.
            // If page > 1, try to look up where previous page ended.
            // fallback: assume 1-to-1 mapping if no cursor (heuristic)
            let currentApiPage;
            if (page === 1) {
                currentApiPage = 1;
            } else {
                currentApiPage = this._smartCursors[`${queryKey}_${page - 1}`]
                    ? this._smartCursors[`${queryKey}_${page - 1}`] + 1
                    : page;
            }

            const accumulated = [];
            let safetyCounter = 0;
            const MAX_API_PAGES_TO_SCAN = 10; // Prevent infinite loops (max 1000 posts scanned)

            while (accumulated.length < limit && safetyCounter < MAX_API_PAGES_TO_SCAN) {
                // Determine batch size (fetch up to 5 pages in parallel to speed up scanning)
                // If we need fewer results, we can be less aggressive, but for safety let's do 3-5
                const BATCH_SIZE = 5;
                const promises = [];

                for (let i = 0; i < BATCH_SIZE; i++) {
                    // Check if we exceed safety limit before scheduling
                    if (safetyCounter + i >= MAX_API_PAGES_TO_SCAN) break;

                    const p = currentApiPage + i;
                    promises.push(this._fetchPostsStandard(apiTags, 100, p).then(posts => ({ page: p, posts })));
                }

                if (promises.length === 0) break;

                // Wait for all in batch
                const batchResults = await Promise.all(promises);

                // Process results IN ORDER of page number
                batchResults.sort((a, b) => a.page - b.page);

                // Iterate through batch results
                for (const result of batchResults) {
                    currentApiPage = result.page; // Update "last touched" page
                    safetyCounter++;

                    if (!result.posts || result.posts.length === 0) {
                        // If an empty page is found, stop processing further (end of results)
                        // But wait, subsequent parallel fetches might return empty too.
                        // We should break the outer loop if we hit true end.
                        // For safety, let's continue processing the batch but mark us as possibly done?
                        // Actually if page X is empty, X+1 will likely be empty too. 
                        // So we can stop accumulation effectively.
                        // We'll let the loop checking empty posts handle break.
                    }

                    // Filter in memory with a robust matcher
                    const filtered = (result.posts || []).filter(post => {
                        const postTags = post.tag_string.split(' ');

                        return filterTags.every(ftag => {
                            // Negative tag
                            if (ftag.startsWith('-')) {
                                return !postTags.includes(ftag.slice(1));
                            }

                            // Rating filter
                            if (ftag.startsWith('rating:')) {
                                const val = ftag.slice(7);
                                return post.rating === val;
                            }

                            // Status filter
                            if (ftag.startsWith('status:')) {
                                const val = ftag.slice(7);
                                if (val === 'active') return !post.is_deleted && !post.is_pending;
                                if (val === 'deleted') return post.is_deleted;
                                if (val === 'pending') return post.is_pending;
                                return true;
                            }

                            // Standard content tag
                            return postTags.includes(ftag);
                        });
                    });

                    accumulated.push(...filtered);

                    // If we have filled the limit, store the cursor for the NEXT page and BREAK
                    if (accumulated.length >= limit) {
                        this._smartCursors[`${queryKey}_${page}`] = currentApiPage;
                        // We must break out of both loops
                        break;
                    }
                }

                // Check if we need to break outer loop (filled limit)
                if (accumulated.length >= limit) {
                    break;
                }

                // Check for end of results in the last processed batch item
                // If the last page of the batch was empty, we are likely done.
                const lastBatchResult = batchResults[batchResults.length - 1];
                if (!lastBatchResult.posts || lastBatchResult.posts.length === 0) {
                    break;
                }

                // If we are here, we processed the whole batch and still need more.
                // Increment currentApiPage to the start of next batch
                currentApiPage++;
            }

            // Note: We might update the cursor multiple times or skip pages. 
            // If we broke early, currentApiPage is the last one touched.
            // If we ran out of API results, we just return what we have.
            // If we hit safety limit, we return what we have.

            // Store cursor in case we didn't fill limit but did work
            this._smartCursors[`${queryKey}_${page}`] = currentApiPage;

            // Return exactly limit (or fewer if end of results)
            return accumulated.slice(0, limit);

        } catch (e) {
            console.error("Smart search failed, falling back to standard", e);
            return this._fetchPostsStandard(tags, limit, page);
        }
    }

    async _fetchPostsStandard(tags, limit, page) {
        // SUPER PAGINATION: Handle limits > 100
        // Danbooru max is 100, so if user wants 150, we fetch pages 1 and 2 and combine
        if (limit > 100) {
            const maxPerPage = 100;
            const numPages = Math.ceil(limit / maxPerPage);
            const startPage = ((page - 1) * Math.ceil(limit / maxPerPage)) + 1;

            console.log(`[Super Pagination] Fetching ${numPages} API pages (${limit} posts total)`);

            const promises = [];
            for (let i = 0; i < numPages; i++) {
                promises.push(
                    this._fetch('posts.json', {
                        tags: tags,
                        limit: maxPerPage,
                        page: startPage + i
                    })
                );
            }

            const results = await Promise.all(promises);
            const combined = results.flatMap(r => r);

            // Return exactly 'limit' posts
            return combined.slice(0, limit);
        }

        // Standard fetch for limits <= 100
        return this._fetch('posts.json', {
            tags: tags,
            limit: limit,
            page: page
        });
    }

    async getPost(id) {
        return this._fetch(`posts/${id}.json`);
    }

    async getRandomPost() {
        return this._fetch('posts/random.json');
    }

    // --- Counts ---

    async getPostCount(tags) {
        // If it's a simple single tag, we can use tags.json for faster lookup
        const isSingleTag = /^[a-zA-Z0-9_().]+$/.test(tags.trim());

        if (isSingleTag) {
            const data = await this._fetch('tags.json', { 'search[name]': tags.trim() });
            return data?.[0]?.post_count || 0;
        } else {
            // Complex query
            const data = await this._fetch('counts/posts.json', { tags });
            return data?.counts?.posts || 0;
        }
    }

    // --- Pools ---

    async getPools(query = '', page = 1, limit = 42) {
        const params = {
            page,
            limit,
            'search[is_active]': true,
            'search[order]': 'updated_at'
        };

        if (query) {
            params['search[name_matches]'] = query;
        }

        return this._fetch('pools.json', params);
    }

    async getPool(id) {
        return this._fetch(`pools/${id}.json`);
    }

    // --- Comments ---

    async getComments(postId, page = 1, limit = 10) {
        return this._fetch('comments.json', {
            group_by: 'comment',
            'search[post_id]': postId,
            limit,
            page
        });
    }

    async getArtistCommentary(postId) {
        return this._fetch('artist_commentaries.json', {
            'search[post_id]': postId
        });
    }

    // --- Artists ---

    async getArtistByName(name) {
        const data = await this._fetch('artists.json', { 'search[name]': name });
        return data?.[0] || null;
    }

    async getArtistUrls(artistId) {
        return this._fetch('artist_urls.json', { 'search[artist_id]': artistId });
    }

    // --- Wiki ---

    async getWikiPage(title) {
        const data = await this._fetch('wiki_pages.json', { 'search[title]': title });
        return data?.[0] || null;
    }

    async getWikiPages(query = '', limit = 20, page = 1, order = 'updated_at') {
        const params = {
            limit,
            page,
            'search[order]': order,
            'search[is_deleted]': false
        };

        if (query) {
            params['search[title_matches]'] = `*${query}*`;
        }

        return this._fetch('wiki_pages.json', params);
    }

    async getRecentWikiPages() {
        return this._fetch('wiki_pages.json', {
            limit: 10,
            'search[is_deleted]': false,
            'order': 'updated_at'
        });
    }

    // --- Autocomplete ---

    async getAutocomplete(query, type = 'tag') {
        if (type === 'tag') {
            const data = await this._fetch('autocomplete.json', {
                'search[query]': query,
                'search[type]': 'tag_query',
                limit: 10
            });
            return data || [];
        }
        // TODO: Add wiki/artist autocomplete if needed
        return [];
    }

    // --- Media Assets ---

    async getMediaAssets(ids) {
        if (!ids || ids.length === 0) return [];
        return this._fetch('media_assets.json', {
            'search[id]': ids.join(','),
            limit: 100
        });
    }
}

export default new DanbooruService();
