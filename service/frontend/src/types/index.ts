// Video Model Types
export type VideoModelName = 'LTX-2' | 'Wan2.2-T2V' | 'Wan2.2-I2V';
export type TaskType = 'T2V' | 'I2V' | 'BOTH';
export type FileType = 'base' | 'single' | 'high_noise' | 'low_noise';

export interface ModelFile {
  type: FileType;
  path: string;
  size: number;
  exists: boolean;
}

export interface InstalledModel {
  id: number;
  name: VideoModelName;
  display_name: string;
  supports_t2v: boolean;
  supports_i2v: boolean;
  is_moe: boolean;
  requires_paired_files: boolean;
  t2v_categories: string[];
  i2v_categories: string[];
  is_complete: boolean;
  is_installed: boolean;
}

// LoRA Types
export interface LoraFile {
  type: FileType;
  filename: string;
  path: string | null;
  size: number;
  is_downloaded: boolean;
}

export interface LoraModel {
  id: number;
  name: string;
  description: string | null;
  base_model: VideoModelName;
  task_type: TaskType;
  category: string;

  // MoE
  is_moe: boolean;
  requires_paired_files: boolean;
  files: LoraFile[];
  total_size: number;

  // Metadata
  trigger_words: string[];
  recommended_strength: number;
  sample_video: string | null;
  thumbnail: string | null;

  // Stats
  downloads: number;
  rating: number;

  // Status
  all_files_downloaded: boolean;
  download_progress: number;
}

// API Response Types
export interface ModelsResponse {
  models: InstalledModel[];
}

export interface LorasResponse {
  loras: LoraModel[];
  total: number;
  page: number;
  total_pages: number;
}

export interface LoraStatsResponse {
  total: number;
  by_model: Record<string, number>;
  by_category: Record<string, number>;
  downloaded: number;
  moe_count: number;
}

// Filter Types
export interface LoraFilters {
  base_model: string | null;
  task_type: TaskType | null;
  category: string | null;
  search: string;
  downloaded: boolean | null;
}

// AI Search Types
export interface AISearchResult {
  name: string;
  repo_id: string;
  url: string;
  description_ko: string;
  effect_type: string;
  estimated_size_mb: number;
  compatibility_note: string;
  thumbnail: string | null;
  download_url?: string;
  // Source and Badge (Pin & Fill strategy)
  source?: 'Official' | 'Community';
  badge?: 'Official' | 'Trending';
  // Trending stats
  downloads?: number;
  likes?: number;
  last_modified?: string;
}

export interface AISearchResponse {
  success: boolean;
  results: AISearchResult[];
  error: string | null;
}
