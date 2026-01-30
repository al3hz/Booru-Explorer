// src/services/danbooru.ts
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
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface RequestConfig {
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
}

class DanbooruService {
  private _smartCursors: Map<string, number> = new Map();
  private _pendingRequests: Map<string, AbortController> = new Map();

  /**
   * Construye URL del proxy interno
   */
  private _buildUrl(
    danbooruPath: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): string {
    const cleanPath = danbooruPath.replace(/^\/+/, '');
    const url = new URL(API_BASE, window.location.origin);

    url.searchParams.set('url', cleanPath);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Fetch con retry, timeout y cancelación
   */
  private async _fetch<T>(
    danbooruPath: string,
    params: Record<string, string | number | boolean | undefined> = {},
    config: RequestConfig = {}
  ): Promise<T> {
    const { retries = MAX_RETRIES, timeout = 30000, signal } = config;
    const url = this._buildUrl(danbooruPath, params);

    // Cancelar request anterior si existe (para evitar race conditions)
    const requestKey = `${danbooruPath}_${JSON.stringify(params)}`;
    if (this._pendingRequests.has(requestKey)) {
      this._pendingRequests.get(requestKey)?.abort();
    }

    const controller = new AbortController();
    this._pendingRequests.set(requestKey, controller);

    // Combinar señales si se pasó una externa
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[API] ${danbooruPath} (attempt ${attempt}/${retries})`);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'X-Client-Version': '2.0'
          }
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Si el proxy envuelve en { success, data, meta }, extraer data
        if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
          return data.data as T;
        }

        return data as T;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // No reintentar si fue cancelado por el usuario (AbortError)
        if (lastError.name === 'AbortError') {
          this._pendingRequests.delete(requestKey);
          throw lastError;
        }

        // No reintentar errores 4xx (cliente)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          break;
        }

        if (attempt < retries) {
          await new Promise(r => setTimeout(r, RETRY_DELAY * attempt)); // Backoff exponencial
        }
      }
    }

    this._pendingRequests.delete(requestKey);
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Cancelar todas las requests pendientes (útil al cambiar de página rápido)
   */
  cancelAllRequests(): void {
    this._pendingRequests.forEach((controller) => {
      try {
        controller.abort();
      } catch {
        // Ignorar errores de cancelación
      }
    });
    this._pendingRequests.clear();
  }

  // ==========================================
  // POSTS - Con Smart Search optimizado
  // ==========================================

  async getPosts(
    tags: string = '',
    limit: number = 20,
    page: number = 1,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruPost[]> {
    const normalizedTags = this._normalizeTags(tags);
    const tagList = normalizedTags.split(' ').filter(Boolean);

    // Si hay pocos tags, búsqueda estándar directa
    if (tagList.length <= 2) {
      return this._fetchStandard(normalizedTags, limit, page, options);
    }

    // Smart Search: > 2 tags
    return this._smartSearch(normalizedTags, tagList, limit, page, options);
  }

  private _normalizeTags(tags: string): string {
    const trimmed = tags.trim();
    if (!trimmed.includes('status:')) {
      return trimmed ? `${trimmed} status:active` : 'status:active';
    }
    return trimmed;
  }

  private async _smartSearch(
    fullTags: string,
    tagList: string[],
    limit: number,
    page: number,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruPost[]> {
    const META_PREFIXES = [
      'rating:', 'order:', 'status:', 'date:', 'user:', 'fav:',
      'score:', 'id:', 'width:', 'height:', 'mpixels:', 'ratio:',
      'source:', 'parent:'
    ];

    const contentTags = tagList.filter(t =>
      !META_PREFIXES.some(p => t.startsWith(p)) && !t.startsWith('-')
    );
    const metaTags = tagList.filter(t =>
      META_PREFIXES.some(p => t.startsWith(p)) || t.startsWith('-')
    );

    // Seleccionar máximo 2 tags prioritarios para la API
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
    const queryKey = `smart_${apiTags}_${filterTags.join('_')}`;

    console.log(`[SmartSearch] API:"${apiTags}" | Filter:[${filterTags.join(',')}]`);

    try {
      return await this._executeSmartSearch(
        queryKey, apiTags, filterTags, limit, page, options
      );
    } catch (error) {
      console.error('[SmartSearch] Failed, falling back to standard:', error);
      return this._fetchStandard(fullTags, limit, page, options);
    }
  }

  private async _executeSmartSearch(
    queryKey: string,
    apiTags: string,
    filterTags: string[],
    limit: number,
    page: number,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruPost[]> {
    const cursorKey = `${queryKey}_${page - 1}`;
    let currentApiPage = page === 1 ? 1 : (this._smartCursors.get(cursorKey) || page - 1) + 1;

    const accumulated: DanbooruPost[] = [];
    const MAX_API_PAGES = 10;
    let scannedPages = 0;

    while (accumulated.length < limit && scannedPages < MAX_API_PAGES) {
      // Fetch en paralelo (batch de 5 páginas)
      const batchSize = Math.min(5, MAX_API_PAGES - scannedPages);
      const promises = Array.from({ length: batchSize }, (_, i) =>
        this._fetchStandard(apiTags, 100, currentApiPage + i, options)
          .then(posts => ({ page: currentApiPage + i, posts }))
          .catch(() => ({ page: currentApiPage + i, posts: [] as DanbooruPost[] }))
      );

      const results = await Promise.all(promises);
      results.sort((a, b) => a.page - b.page);

      for (const result of results) {
        currentApiPage = result.page;
        scannedPages++;

        if (!result.posts?.length) continue;

        const filtered = this._filterPosts(result.posts, filterTags);
        accumulated.push(...filtered);

        if (accumulated.length >= limit) {
          this._smartCursors.set(`${queryKey}_${page}`, currentApiPage);
          return accumulated.slice(0, limit);
        }
      }

      currentApiPage++;
    }

    this._smartCursors.set(`${queryKey}_${page}`, currentApiPage);
    return accumulated.slice(0, limit);
  }

  private _filterPosts(posts: DanbooruPost[], filterTags: string[]): DanbooruPost[] {
    return posts.filter(post => {
      const postTags = post.tag_string.split(' ');

      return filterTags.every(ftag => {
        // Tag negativo
        if (ftag.startsWith('-')) {
          return !postTags.includes(ftag.slice(1));
        }

        // Rating
        if (ftag.startsWith('rating:')) {
          return post.rating === ftag.slice(7);
        }

        // Status
        if (ftag.startsWith('status:')) {
          const val = ftag.slice(7);
          if (val === 'active') return !post.is_deleted && !post.is_pending;
          if (val === 'deleted') return post.is_deleted;
          if (val === 'pending') return post.is_pending;
          return true;
        }

        // Tag normal
        return postTags.includes(ftag);
      });
    });
  }

  private async _fetchStandard(
    tags: string,
    limit: number,
    page: number,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruPost[]> {
    // Si limit > 100, usar super-pagination (múltiples requests paralelos)
    if (limit > 100) {
      return this._superPagination(tags, limit, page, options);
    }

    return this._fetch<DanbooruPost[]>('posts.json', {
      tags,
      limit,
      page
    }, options);
  }

  private async _superPagination(
    tags: string,
    limit: number,
    page: number,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruPost[]> {
    const perPage = 100;
    const pagesNeeded = Math.ceil(limit / perPage);
    const startPage = ((page - 1) * Math.ceil(limit / perPage)) + 1;

    console.log(`[SuperPagination] Fetching ${pagesNeeded} pages (${limit} posts)`);

    const promises = Array.from({ length: pagesNeeded }, (_, i) =>
      this._fetch<DanbooruPost[]>('posts.json', {
        tags,
        limit: perPage,
        page: startPage + i
      }, options).catch(() => [] as DanbooruPost[])
    );

    const results = await Promise.all(promises);
    return results.flat().slice(0, limit);
  }

  // ==========================================
  // ENDPOINTS ESPECÍFICOS
  // ==========================================

  async getPost(id: number, options?: { signal?: AbortSignal }): Promise<DanbooruPost> {
    return this._fetch<DanbooruPost>(`posts/${id}.json`, {}, options);
  }

  async getRandomPost(options?: { signal?: AbortSignal }): Promise<DanbooruPost> {
    return this._fetch<DanbooruPost>('posts/random.json', {}, options);
  }

  async getPostCount(tags: string): Promise<number> {
    const cleanTags = tags.trim();
    const isSingleTag = /^[a-zA-Z0-9_().]+$/.test(cleanTags);

    try {
      if (isSingleTag) {
        const data = await this._fetch<DanbooruTag[]>('tags.json', {
          'search[name]': cleanTags
        });
        return data?.[0]?.post_count || 0;
      } else {
        const data = await this._fetch<{ counts: PostCounts }>('counts/posts.json', { tags });
        return data?.counts?.posts || 0;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      console.error('[Count] Error fetching count:', error);
      return 0;
    }
  }

  // --- Pools ---

  async getPools(
    query: string = '',
    page: number = 1,
    limit: number = 42,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruPool[]> {
    return this._fetch<DanbooruPool[]>('pools.json', {
      page,
      limit,
      'search[is_active]': true,
      'search[order]': 'updated_at',
      ...(query && { 'search[name_matches]': query })
    }, options);
  }

  async getPool(id: number, options?: { signal?: AbortSignal }): Promise<DanbooruPool> {
    return this._fetch<DanbooruPool>(`pools/${id}.json`, {}, options);
  }

  // --- Comments ---

  async getComments(
    postId: number,
    page: number = 1,
    limit: number = 10,
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruComment[]> {
    return this._fetch<DanbooruComment[]>('comments.json', {
      group_by: 'comment',
      'search[post_id]': postId,
      limit,
      page
    }, options);
  }

  async getArtistCommentary(postId: number, options?: { signal?: AbortSignal }): Promise<any> {
    return this._fetch('artist_commentaries.json', {
      'search[post_id]': postId
    }, options);
  }

  // --- Artists ---

  async getArtistByName(name: string, options?: { signal?: AbortSignal }): Promise<DanbooruArtist | null> {
    const data = await this._fetch<DanbooruArtist[]>('artists.json', {
      'search[name]': name
    }, options);
    return data?.[0] || null;
  }

  async getArtistUrls(artistId: number, options?: { signal?: AbortSignal }): Promise<any[]> {
    return this._fetch('artist_urls.json', {
      'search[artist_id]': artistId
    }, options);
  }

  // --- Wiki ---

  async getWikiPage(title: string, options?: { signal?: AbortSignal }): Promise<DanbooruWikiPage | null> {
    const data = await this._fetch<DanbooruWikiPage[]>('wiki_pages.json', {
      'search[title]': title
    }, options);
    return data?.[0] || null;
  }

  async getWikiPages(
    query: string = '',
    limit: number = 20,
    page: number = 1,
    order: string = 'updated_at',
    options?: { signal?: AbortSignal }
  ): Promise<DanbooruWikiPage[]> {
    return this._fetch<DanbooruWikiPage[]>('wiki_pages.json', {
      limit,
      page,
      'search[order]': order,
      'search[is_deleted]': false,
      ...(query && { 'search[title_matches]': `*${query}*` })
    }, options);
  }

  async getRecentWikiPages(options?: { signal?: AbortSignal }): Promise<DanbooruWikiPage[]> {
    return this._fetch<DanbooruWikiPage[]>('wiki_pages.json', {
      limit: 10,
      'search[is_deleted]': false,
      'order': 'updated_at'
    }, options);
  }

  // --- Autocomplete ---

  async getAutocomplete(
    query: string,
    type: string = 'tag',
    options?: { signal?: AbortSignal }
  ): Promise<AutocompleteResult[]> {
    if (type !== 'tag') return [];

    return this._fetch<AutocompleteResult[]>('autocomplete.json', {
      'search[query]': query,
      'search[type]': 'tag_query',
      limit: 10
    }, options).catch(() => []);
  }

  // --- Media Assets ---

  async getMediaAssets(ids: number[], options?: { signal?: AbortSignal }): Promise<DanbooruMediaAsset[]> {
    if (!ids?.length) return [];
    return this._fetch<DanbooruMediaAsset[]>('media_assets.json', {
      'search[id]': ids.join(','),
      limit: 100
    }, options);
  }
}

export default new DanbooruService();