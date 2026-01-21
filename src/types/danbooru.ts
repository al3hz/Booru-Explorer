// Interfaces básicas
export interface DanbooruPost {
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

export interface DanbooruArtist {
    id: number;
    name: string;
    group_name?: string;
    is_banned: boolean;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    other_names: string[];
    urls: Array<{
        id: number;
        url: string;
        normalized_url: string;
        created_at: string;
        updated_at: string;
    }>;
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
}

export interface DanbooruMediaAsset {
    id: number;
    md5: string;
    file_ext: string;
    file_size: number;
    image_width: number;
    image_height: number;
    duration?: number;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface PostCounts {
    posts: number;
}

export interface AutocompleteResult {
    type: string;
    label: string;
    value: string;
    category: number;
    post_count: number;
}
