export type QualityLevel = 'SD' | 'HD' | 'FHD' | '4K' | 'unknown';
export type ChannelStatus = 'ok' | 'failed' | 'verifying' | 'pending';

export interface Channel {
  id: string;
  order: number;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  rating?: string;
  groupTitle: string;
  name: string;
  url: string;
  status?: ChannelStatus;
  quality?: QualityLevel;
  resolution?: string; // e.g., "1920x1080"
  codec?: string; // e.g., "avc1.64001f,mp4a.40.2"
  bitrate?: number; // in bps
  director?: string;
  releaseDate?: string;
  genre?: string;
  streamingPlatform?: string;
  cast?: string;
  overview?: string;
  duration?: string;
  poster?: string;
  backdrop?: string;
}

export interface EpgChannel {
    id: string;
    name: string;
    logo: string;
}

export type Tab = 'inicio' | 'editor' | 'reparacion' | 'asignar-epg' | 'save' | 'settings' | 'ayuda';
export type AttributeKey = 'tvgId' | 'tvgName' | 'tvgLogo' | 'groupTitle' | 'name' | 'url';