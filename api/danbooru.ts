// api/danbooru.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

// Tipos para la respuesta de Danbooru
interface DanbooruError {
  error: string;
  message?: string;
  success?: boolean;
  [key: string]: any;
}

interface DanbooruPost {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url?: string;
  rating: 's' | 'q' | 'e';
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

interface DanbooruTag {
  id: number;
  name: string;
  post_count: number;
  category: number;
  created_at: string;
  updated_at: string;
}

interface DanbooruPool {
  id: number;
  name: string;
  description: string;
  post_count: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_deleted: boolean;
}

interface DanbooruComment {
  id: number;
  post_id: number;
  creator_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_hidden: boolean;
}

type DanbooruResponse = 
  | DanbooruPost[]
  | DanbooruPost
  | DanbooruTag[]
  | DanbooruPool[]
  | DanbooruPool
  | DanbooruComment[]
  | DanbooruError
  | { posts: DanbooruPost[] }
  | { tags: DanbooruTag[] }
  | { pools: DanbooruPool[] }
  | { comments: DanbooruComment[] };

// Configuración de la API
interface ApiConfig {
  userAgent: string;
  baseUrl: string;
  defaultPath: string;
  cacheTime: number;
  staleWhileRevalidate: number;
}

const API_CONFIG: ApiConfig = {
  userAgent: 'Booru-Explorer/1.0 (Educational Project; al3hz)',
  baseUrl: 'https://danbooru.donmai.us',
  defaultPath: 'posts.json',
  cacheTime: 30, // seconds
  staleWhileRevalidate: 30, // seconds
};

// Helper para construir URL de Danbooru
function buildDanbooruUrl(requestUrl: string): string {
  try {
    const url = new URL(requestUrl, 'http://dummy'); // Base dummy para parsing
    const searchParams = url.searchParams;
    
    // Extraer el path objetivo
    const targetPath = searchParams.get('url') || API_CONFIG.defaultPath;
    searchParams.delete('url');
    
    // Limpiar parámetros que no deben ir a Danbooru
    const cleanParams = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (key && value) {
        cleanParams.append(key, value);
      }
    }
    
    // Construir URL final
    return `${API_CONFIG.baseUrl}/${targetPath}?${cleanParams.toString()}`;
  } catch (error) {
    throw new Error(`Invalid URL format: ${requestUrl}`);
  }
}

// Helper para manejar errores de fetch
async function handleFetchError(response: Response): Promise<DanbooruError> {
  const status = response.status;
  const errorText = await response.text();
  
  console.error(`Danbooru API Error ${status}:`, errorText.slice(0, 500));
  
  try {
    const errorJson = JSON.parse(errorText);
    return {
      error: `Danbooru API Error ${status}`,
      message: errorJson.message || errorJson.error || 'Unknown error',
      ...errorJson
    };
  } catch {
    return {
      error: `Danbooru API returned ${status}`,
      message: errorText.slice(0, 200) || 'No error details available'
    };
  }
}

// Helper para validar la respuesta
function validateResponse(data: unknown): DanbooruResponse {
  // Validación básica de tipos
  if (data === null || data === undefined) {
    throw new Error('Empty response from Danbooru API');
  }
  
  // Si es un array o objeto, asumimos que es válido
  // En producción podrías agregar validación más estricta aquí
  return data as DanbooruResponse;
}

// Helper para setear headers de cache
function setCacheHeaders(response: VercelResponse, config: ApiConfig): void {
  response.setHeader(
    'Cache-Control',
    `public, s-maxage=${config.cacheTime}, stale-while-revalidate=${config.staleWhileRevalidate}`
  );
  
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Powered-By', 'Booru-Explorer-API');
}

// Métodos HTTP permitidos
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

const ALLOWED_METHODS: HttpMethod[] = ['GET'];
const DEFAULT_METHOD: HttpMethod = 'GET';

// Handler principal
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  // Métricas de tiempo de respuesta
  const startTime = Date.now();
  
  try {
    // 1. Validar método HTTP
    const method = (request.method?.toUpperCase() || DEFAULT_METHOD) as HttpMethod;
    if (!ALLOWED_METHODS.includes(method)) {
      response.status(405).json({
        error: 'Method Not Allowed',
        message: `Only ${ALLOWED_METHODS.join(', ')} methods are allowed`,
        allowed_methods: ALLOWED_METHODS
      });
      return;
    }
    
    // 2. Validar que tenemos una URL
    const requestUrl = request.url || '';
    if (!requestUrl) {
      response.status(400).json({
        error: 'Bad Request',
        message: 'Missing URL parameter'
      });
      return;
    }
    
    // 3. Construir URL de Danbooru
    let danbooruUrl: string;
    try {
      danbooruUrl = buildDanbooruUrl(requestUrl);
    } catch (error) {
      response.status(400).json({
        error: 'Bad Request',
        message: error instanceof Error ? error.message : 'Invalid URL format'
      });
      return;
    }
    
    // Logging para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] Proxying to: ${danbooruUrl}`);
    }
    
    // 4. Hacer la request a Danbooru
    const fetchOptions: RequestInit = {
      method: method,
      headers: {
        'User-Agent': API_CONFIG.userAgent,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Timeout configurable
      signal: AbortSignal.timeout(10000) // 10 segundos timeout
    };
    
    // Si hay body en POST/PUT requests (para futura expansión)
    if (request.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(request.body);
    }
    
    let apiResponse: Response;
    try {
      apiResponse = await fetch(danbooruUrl, fetchOptions);
    } catch (fetchError) {
      console.error('Network error fetching from Danbooru:', fetchError);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        response.status(504).json({
          error: 'Gateway Timeout',
          message: 'Request to Danbooru API timed out'
        });
      } else {
        response.status(502).json({
          error: 'Bad Gateway',
          message: 'Failed to connect to Danbooru API',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown network error'
        });
      }
      return;
    }
    
    // 5. Manejar errores de la API de Danbooru
    if (!apiResponse.ok) {
      const errorData = await handleFetchError(apiResponse);
      response.status(apiResponse.status).json(errorData);
      return;
    }
    
    // 6. Parsear y validar la respuesta
    let responseData: DanbooruResponse;
    try {
      const rawData = await apiResponse.json();
      responseData = validateResponse(rawData);
    } catch (parseError) {
      console.error('Error parsing Danbooru response:', parseError);
      response.status(502).json({
        error: 'Bad Gateway',
        message: 'Invalid JSON response from Danbooru API',
        details: parseError instanceof Error ? parseError.message : 'Parse error'
      });
      return;
    }
    
    // 7. Setear headers de cache
    setCacheHeaders(response, API_CONFIG);
    
    // 8. Enviar respuesta exitosa
    response.status(200).json(responseData);
    
    // Logging de performance
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] Request completed in ${duration}ms`);
    }
    
  } catch (error) {
    // Error inesperado
    console.error('Unexpected error in API handler:', error);
    
    response.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      request_id: Math.random().toString(36).substring(2, 15)
    });
  }
}

// Export para Vercel
export const config = {
  runtime: 'nodejs'
};

// Tipos de export para uso externo
export type {
  DanbooruPost,
  DanbooruTag,
  DanbooruPool,
  DanbooruComment,
  DanbooruError,
  DanbooruResponse
};

// Helper functions exportadas para testing
export {
  buildDanbooruUrl,
  handleFetchError,
  validateResponse,
  setCacheHeaders
};