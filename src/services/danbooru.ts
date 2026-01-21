// services/danbooruService.ts
import type {
    DanbooruPost,
    DanbooruTag,
    DanbooruPool,
    DanbooruComment,
    DanbooruArtist,
    DanbooruWikiPage,
    DanbooruMediaAsset,
    PostCounts,
    AutocompleteResult
} from '../types/danbooru';

const API_BASE = '/api/danbooru';

class DanbooruService {
    private _smartCursors: Record<string, number> = {};

    /**
     * Helper to build the proxy URL
     * @param danbooruPath - The path on the Danbooru API (e.g. 'posts.json')
     * @param params - Query parameters to append
     */
    private _buildUrl(danbooruPath: string, params: Record<string, string | number | boolean> = {}): string {
        const cleanPath = danbooruPath.startsWith('/') ? danbooruPath.slice(1) : danbooruPath;
        const proxySearchParams = new URLSearchParams();
        proxySearchParams.set('url', cleanPath);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                proxySearchParams.append(key, String(value));
            }
        });

        return `${API_BASE}?${proxySearchParams.toString()}`;
    }

    private async _fetch<T>(danbooruPath: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
        const url = this._buildUrl(danbooruPath, params);
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`Danbooru API Error: ${res.status} ${res.statusText}`);
        }
        
        return res.json();
    }

    // --- Posts ---

    async getPosts(tags: string = '', limit: number = 20, page: number = 1): Promise<DanbooruPost[]> {
        let normalizedTags = tags.trim();
        if (!normalizedTags.includes('status:')) {
            normalizedTags = normalizedTags ? `${normalizedTags} status:active` : 'status:active';
        }

        const tagList = normalizedTags.split(' ').filter(t => t.trim() !== '');
        const metaPrefixes = [
            'rating:', 'order:', 'status:', 'date:', 'user:', 'fav:', 
            'score:', 'id:', 'width:', 'height:', 'mpixels:', 'ratio:', 
            'source:', 'parent:'
        ];

        const contentTags = tagList.filter(t => !metaPrefixes.some(p => t.startsWith(p)) && !t.startsWith('-'));
        const metaTags = tagList.filter(t => metaPrefixes.some(p => t.startsWith(p)) || t.startsWith('-'));

        if (tagList.length <= 2) {
            return this._fetchPostsStandard(normalizedTags, limit, page);
        }

        // SMART SEARCH: > 2 total tags
        const priorityTags: string[] = [];
        const orderTag = metaTags.find(t => t.startsWith('order:'));
        if (orderTag) priorityTags.push(orderTag);

        for (const t of contentTags) {
            if (priorityTags.length < 2) priorityTags.push(t);
        }
        
        for (const t of metaTags) {
            if (t !== orderTag && priorityTags.length < 2) priorityTags.push(t);
        }

        const apiTags = priorityTags.join(' ');
        const filterTags = tagList.filter(t => !priorityTags.includes(t));

        console.log(`[Smart Search] API: "${apiTags}" | Client Filter: [${filterTags.join(', ')}]`);

        try {
            const queryKey = `smart_${apiTags}_${filterTags.join('_')}`;
            
            let currentApiPage: number;
            if (page === 1) {
                currentApiPage = 1;
            } else {
                const previousCursorKey = `${queryKey}_${page - 1}`;
                currentApiPage = this._smartCursors[previousCursorKey] 
                    ? this._smartCursors[previousCursorKey] + 1 
                    : page;
            }

            const accumulated: DanbooruPost[] = [];
            let safetyCounter = 0;
            const MAX_API_PAGES_TO_SCAN = 10;

            while (accumulated.length < limit && safetyCounter < MAX_API_PAGES_TO_SCAN) {
                const BATCH_SIZE = 5;
                const promises: Array<Promise<{ page: number; posts: DanbooruPost[] }>> = [];

                for (let i = 0; i < BATCH_SIZE; i++) {
                    if (safetyCounter + i >= MAX_API_PAGES_TO_SCAN) break;
                    
                    const p = currentApiPage + i;
                    promises.push(
                        this._fetchPostsStandard(apiTags, 100, p)
                            .then(posts => ({ page: p, posts }))
                    );
                }

                if (promises.length === 0) break;

                const batchResults = await Promise.all(promises);
                batchResults.sort((a, b) => a.page - b.page);

                for (const result of batchResults) {
                    currentApiPage = result.page;
                    safetyCounter++;

                    if (!result.posts || result.posts.length === 0) {
                        continue;
                    }

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

                    if (accumulated.length >= limit) {
                        this._smartCursors[`${queryKey}_${page}`] = currentApiPage;
                        break;
                    }
                }

                if (accumulated.length >= limit) {
                    break;
                }

                const lastBatchResult = batchResults[batchResults.length - 1];
                if (!lastBatchResult.posts || lastBatchResult.posts.length === 0) {
                    break;
                }

                currentApiPage++;
            }

            this._smartCursors[`${queryKey}_${page}`] = currentApiPage;
            return accumulated.slice(0, limit);

        } catch (e) {
            console.error("Smart search failed, falling back to standard", e);
            return this._fetchPostsStandard(tags, limit, page);
        }
    }

    private async _fetchPostsStandard(tags: string, limit: number, page: number): Promise<DanbooruPost[]> {
        if (limit > 100) {
            const maxPerPage = 100;
            const numPages = Math.ceil(limit / maxPerPage);
            const startPage = ((page - 1) * Math.ceil(limit / maxPerPage)) + 1;

            console.log(`[Super Pagination] Fetching ${numPages} API pages (${limit} posts total)`);

            const promises: Array<Promise<DanbooruPost[]>> = [];
            for (let i = 0; i < numPages; i++) {
                promises.push(
                    this._fetch<DanbooruPost[]>('posts.json', {
                        tags: tags,
                        limit: maxPerPage,
                        page: startPage + i
                    })
                );
            }

            const results = await Promise.all(promises);
            const combined = results.flat();
            return combined.slice(0, limit);
        }

        return this._fetch<DanbooruPost[]>('posts.json', {
            tags: tags,
            limit: limit,
            page: page
        });
    }

    async getPost(id: number): Promise<DanbooruPost> {
        return this._fetch<DanbooruPost>(`posts/${id}.json`);
    }

    async getRandomPost(): Promise<DanbooruPost> {
        return this._fetch<DanbooruPost>('posts/random.json');
    }

    // --- Counts ---

    async getPostCount(tags: string): Promise<number> {
        const isSingleTag = /^[a-zA-Z0-9_().]+$/.test(tags.trim());

        if (isSingleTag) {
            const data = await this._fetch<DanbooruTag[]>('tags.json', { 
                'search[name]': tags.trim() 
            });
            return data?.[0]?.post_count || 0;
        } else {
            const data = await this._fetch<{ counts: PostCounts }>('counts/posts.json', { tags });
            return data?.counts?.posts || 0;
        }
    }

    // --- Pools ---

    async getPools(query: string = '', page: number = 1, limit: number = 42): Promise<DanbooruPool[]> {
        const params: Record<string, string | number | boolean> = {
            page,
            limit,
            'search[is_active]': true,
            'search[order]': 'updated_at'
        };

        if (query) {
            params['search[name_matches]'] = query;
        }

        return this._fetch<DanbooruPool[]>('pools.json', params);
    }

    async getPool(id: number): Promise<DanbooruPool> {
        return this._fetch<DanbooruPool>(`pools/${id}.json`);
    }

    // --- Comments ---

    async getComments(postId: number, page: number = 1, limit: number = 10): Promise<DanbooruComment[]> {
        return this._fetch<DanbooruComment[]>('comments.json', {
            group_by: 'comment',
            'search[post_id]': postId,
            limit,
            page
        });
    }

    async getArtistCommentary(postId: number): Promise<any> {
        return this._fetch('artist_commentaries.json', {
            'search[post_id]': postId
        });
    }

    // --- Artists ---

    async getArtistByName(name: string): Promise<DanbooruArtist | null> {
        const data = await this._fetch<DanbooruArtist[]>('artists.json', { 
            'search[name]': name 
        });
        return data?.[0] || null;
    }

    async getArtistUrls(artistId: number): Promise<any[]> {
        return this._fetch('artist_urls.json', { 
            'search[artist_id]': artistId 
        });
    }

    // --- Wiki ---

    async getWikiPage(title: string): Promise<DanbooruWikiPage | null> {
        const data = await this._fetch<DanbooruWikiPage[]>('wiki_pages.json', { 
            'search[title]': title 
        });
        return data?.[0] || null;
    }

    async getWikiPages(
        query: string = '', 
        limit: number = 20, 
        page: number = 1, 
        order: string = 'updated_at'
    ): Promise<DanbooruWikiPage[]> {
        const params: Record<string, string | number | boolean> = {
            limit,
            page,
            'search[order]': order,
            'search[is_deleted]': false
        };

        if (query) {
            params['search[title_matches]'] = `*${query}*`;
        }

        return this._fetch<DanbooruWikiPage[]>('wiki_pages.json', params);
    }

    async getRecentWikiPages(): Promise<DanbooruWikiPage[]> {
        return this._fetch<DanbooruWikiPage[]>('wiki_pages.json', {
            limit: 10,
            'search[is_deleted]': false,
            'order': 'updated_at'
        });
    }

    // --- Autocomplete ---

    async getAutocomplete(query: string, type: string = 'tag'): Promise<AutocompleteResult[]> {
        if (type === 'tag') {
            const data = await this._fetch<AutocompleteResult[]>('autocomplete.json', {
                'search[query]': query,
                'search[type]': 'tag_query',
                limit: 10
            });
            return data || [];
        }
        return [];
    }

    // --- Media Assets ---

    async getMediaAssets(ids: number[]): Promise<DanbooruMediaAsset[]> {
        if (!ids || ids.length === 0) return [];
        return this._fetch<DanbooruMediaAsset[]>('media_assets.json', {
            'search[id]': ids.join(','),
            limit: 100
        });
    }
}

export default new DanbooruService();