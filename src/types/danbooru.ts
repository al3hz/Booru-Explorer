// src/types/danbooru.ts

// ==========================================
// TIPOS BASE Y UTILITARIOS
// ==========================================

/**
 * Rating de contenido de Danbooru
 * - 'g': General (Safe)
 * - 's': Sensitive (Questionable)
 * - 'q': Questionable
 * - 'e': Explicit
 */
export type DanbooruRating = 'g' | 's' | 'q' | 'e';

/**
 * Categorías de tags en Danbooru
 * 0: General, 1: Artist, 2: Copyright, 3: Character, 4: Meta
 */
export type TagCategory = 0 | 1 | 2 | 3 | 4 | number;

/**
 * Estado de un post o pool
 */
export type ItemStatus = 'active' | 'deleted' | 'pending' | 'flagged';

// ==========================================
// ENTIDADES PRINCIPALES
// ==========================================

export interface DanbooruPost {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url?: string;
  /** Rating del contenido */
  rating: DanbooruRating;
  score: number;
  /** String con todos los tags separados por espacios */
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
  /** URL de la imagen en tamaño original (puede ser null si está borrado) */
  large_file_url?: string;
}

export interface DanbooruTag {
  id: number;
  name: string;
  post_count: number;
  category: TagCategory;
  created_at: string;
  updated_at: string;
  /** true si el tag está sugerido pero no aprobado */
  is_locked?: boolean;
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
  /** IDs de posts en orden */
  post_ids?: number[];
  /** Nombre del creador */
  creator_name?: string;
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
  /** Score de votos del comentario */
  score?: number;
  /** ID del comentario padre (para threads) */
  parent_id?: number;
}

export interface DanbooruArtist {
  id: number;
  name: string;
  group_name?: string;
  is_banned: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  other_names: string[];
  urls: ArtistUrl[];
}

export interface ArtistUrl {
  id: number;
  url: string;
  normalized_url: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}

export interface DanbooruWikiPage {
  id: number;
  title: string;
  body: string;
  other_names: string[];
  is_deleted: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  category_name: string;
  /** Usuario que creó la página */
  creator_id?: number;
  /** Versión actual */
  version?: number;
}

export interface DanbooruMediaAsset {
  id: number;
  md5: string;
  file_ext: string;
  file_size: number;
  image_width: number;
  image_height: number;
  duration?: number;
  status: 'processing' | 'active' | 'deleted' | string;
  created_at: string;
  updated_at: string;
  /** Variantes del asset (diferentes tamaños) */
  variants?: MediaAssetVariant[];
}

export interface MediaAssetVariant {
  type: 'original' | 'sample' | 'preview' | string;
  url: string;
  width: number;
  height: number;
  file_ext: string;
}

// ==========================================
// TIPOS DE RESPUESTA Y METADATOS
// ==========================================

export interface PostCounts {
  posts: number;
}

export interface AutocompleteResult {
  type: 'tag' | 'pool' | 'user' | string;
  label: string;
  value: string;
  category: TagCategory;
  post_count: number;
  /** Antiguo nombre del tag, si aplica */
  antecedent?: string;
}

export interface ArtistCommentary {
  id: number;
  post_id: number;
  original_title?: string;
  original_description?: string;
  translated_title?: string;
  translated_description?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// TIPOS DE RESPUESTA DE API (Nuevo formato)
// ==========================================

/**
 * Respuesta exitosa del proxy API
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    cached: boolean;
    responseTime: number;
  };
}

/**
 * Respuesta de error del proxy API
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

/** Unión de tipos de respuesta */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ==========================================
// TIPOS DE REQUEST Y CONFIGURACIÓN
// ==========================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface DanbooruRequestParams {
  tags?: string;
  limit?: number;
  page?: number;
  [key: string]: string | number | boolean | undefined;
}

/** Configuración para requests del servicio */
export interface ServiceRequestConfig {
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
}

// ==========================================
// TIPOS DE UI/ESTADO (Auxiliares)
// ==========================================

export type ActiveMode = 'deleted' | 'most-liked' | 'most-favorited' | 'hot' | null;

export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all';

/** Estado de carga con metadata */
export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
}