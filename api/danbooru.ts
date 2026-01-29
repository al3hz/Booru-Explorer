// api/danbooru.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ==========================================
// TIPOS ESPECÍFICOS POR ENDPOINT
// ==========================================

export type DanbooruRating = 'g' | 's' | 'q' | 'e';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface DanbooruPost {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url?: string;
  rating: DanbooruRating;
  score: number;
  tag_string: string;
  tag_string_general: string;
  tag_string_artist: string;
  tag_string_copyright: string;
  tag_string_character: string;
  tag_string_meta: string;
  created_at: string;
  updated_at: string;
  image_width: number;
  image_height: number;
  file_size: number;
  file_ext: string;
  source?: string;
  md5: string;
  is_deleted: boolean;
  is_pending: boolean;
  is_flagged: boolean;
  has_children: boolean;
  parent_id?: number;
  fav_count: number;
  uploader_id: number;
  approver_id?: number;
}

export interface DanbooruTag {
  id: number;
  name: string;
  post_count: number;
  category: number;
  created_at: string;
  updated_at: string;
}

export interface DanbooruPool {
  id: number;
  name: string;
  description: string;
  post_count: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_deleted: boolean;
}

export interface DanbooruComment {
  id: number;
  post_id: number;
  creator_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_hidden: boolean;
}

// ==========================================
// CONFIGURACIÓN TIPADA Y VALIDACIÓN
// ==========================================

const CONFIG = {
  USER_AGENT: 'Booru-Explorer/2.0 (Educational Project; https://github.com/al3hz/Booru-Explorer)',
  BASE_URL: 'https://danbooru.donmai.us',
  DEFAULT_PATH: 'posts.json',
  TIMEOUT_MS: 10000,
  CACHE: {
    MAX_AGE: 30,
    STALE_WHILE_REVALIDATE: 30
  },
  ALLOWED_METHODS: ['GET'] as const,
  ALLOWED_PATHS: [
    'posts.json',
    'tags.json',
    'pools.json',
    'comments.json',
    'posts',
    'tags',
    'pools',
    'comments',
    'counts/posts.json',
    'counts/posts'
  ] as const
} as const;

type AllowedPath = typeof CONFIG.ALLOWED_PATHS[number];

// ==========================================
// CLASES DE ERROR ESPECÍFICAS
// ==========================================

class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    const result: Record<string, unknown> = {
      success: false,
      error: this.code,
      message: this.message,
      timestamp: new Date().toISOString()
    };

    if (this.details) {
      result.details = this.details;
    }

    return result;
  }
}

class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message, 'BAD_REQUEST');
    this.name = 'ValidationError';
  }
}

class DanbooruApiError extends ApiError {
  originalResponse?: string;

  constructor(status: number, message: string, originalResponse?: string) {
    super(status, message, 'DANBOORU_API_ERROR', { originalResponse });
    this.name = 'DanbooruApiError';
    this.originalResponse = originalResponse;
  }
}

// ==========================================
// UTILIDADES Y HELPERS
// ==========================================

const generateRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

const validateTargetPath = (path: string | null): AllowedPath => {
  if (!path) return CONFIG.DEFAULT_PATH;

  const dangerousPatterns = /^(https?:\/\/|\/\/|\.{2,})|[<>\"']/;
  if (dangerousPatterns.test(path)) {
    throw new ValidationError('Invalid path format: potential security risk');
  }

  const cleanPath = path.replace(/^\/+/, '');
  const isAllowed = CONFIG.ALLOWED_PATHS.some(allowed =>
    cleanPath === allowed || cleanPath.startsWith(`${allowed}/`)
  );

  if (!isAllowed) {
    throw new ValidationError(`Path not allowed: ${path}`);
  }

  return cleanPath as AllowedPath;
};

const buildDanbooruUrl = (requestUrl: string): string => {
  try {
    const url = new URL(requestUrl, 'http://localhost');
    const targetPath = validateTargetPath(url.searchParams.get('url'));

    url.searchParams.delete('url');

    const danbooruUrl = new URL(targetPath, CONFIG.BASE_URL);

    url.searchParams.forEach((value, key) => {
      if (key && value) {
        danbooruUrl.searchParams.append(key, value);
      }
    });

    return danbooruUrl.toString();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const parseDanbooruError = async (response: Response): Promise<DanbooruApiError> => {
  const errorText = await response.text();
  const truncated = errorText.slice(0, 500);

  try {
    const errorJson = JSON.parse(errorText);
    return new DanbooruApiError(
      response.status,
      errorJson.message || errorJson.error || 'Unknown Danbooru error',
      truncated
    );
  } catch {
    return new DanbooruApiError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
      truncated
    );
  }
};

const setSecurityHeaders = (res: VercelResponse): void => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control',
    `public, s-maxage=${CONFIG.CACHE.MAX_AGE}, stale-while-revalidate=${CONFIG.CACHE.STALE_WHILE_REVALIDATE}`
  );
};

// ==========================================
// MANEJADOR PRINCIPAL
// ==========================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startTime = performance.now();

  const log = (level: 'info' | 'error' | 'warn', message: string, meta?: Record<string, unknown>) => {
    const entry = {
      requestId,
      level,
      message,
      duration: Math.round(performance.now() - startTime),
      ...meta
    };

    if (process.env.NODE_ENV === 'development' || level === 'error') {
      console[level](`[API] ${message}`, JSON.stringify(entry));
    }
  };

  try {
    const method = (req.method?.toUpperCase() || 'GET') as HttpMethod;
    if (method !== 'GET') {
      throw new ApiError(405, `Method ${method} not allowed`, 'METHOD_NOT_ALLOWED', {
        allowed_methods: ['GET']
      });
    }

    if (!req.url) {
      throw new ValidationError('Missing request URL');
    }

    const targetUrl = buildDanbooruUrl(req.url);
    log('info', 'Proxying request', { target: targetUrl.replace(CONFIG.BASE_URL, '') });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);



    const fetchOptions: RequestInit = {
      method,
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'application/json',
        'X-Request-ID': requestId
      },
      signal: controller.signal
    };

    let response: Response;
    try {
      response = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new ApiError(504, 'Request timeout', 'GATEWAY_TIMEOUT');
      }

      throw new ApiError(502, 'Failed to reach Danbooru API', 'BAD_GATEWAY', {
        originalError: fetchError instanceof Error ? fetchError.message : 'Unknown'
      });
    }

    if (!response.ok) {
      const error = await parseDanbooruError(response);
      log('error', 'Danbooru API error', {
        status: error.statusCode,
        message: error.message
      });
      throw error;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new ApiError(502, 'Invalid JSON from upstream', 'INVALID_RESPONSE', {
        originalError: parseError instanceof Error ? parseError.message : 'Parse failed'
      });
    }

    setSecurityHeaders(res);
    res.setHeader('X-Request-ID', requestId);

    res.status(200).json({
      success: true,
      data,
      meta: {
        requestId,
        cached: false,
        responseTime: Math.round(performance.now() - startTime)
      }
    });

    log('info', 'Request completed successfully');

  } catch (error) {
    let apiError: ApiError;

    if (error instanceof ApiError) {
      apiError = error;
    } else {
      apiError = new ApiError(
        500,
        'Internal server error',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
      log('error', 'Unexpected error', { stack: error instanceof Error ? error.stack : undefined });
    }

    res.status(apiError.statusCode).json(apiError.toJSON());
  }
}

// ==========================================
// EXPORTS Y CONFIG
// ==========================================

export const config = {
  runtime: 'nodejs',
  regions: ['iad1'],
  maxDuration: 10
};