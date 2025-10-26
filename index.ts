export type QualityLevel = 'SD' | 'HD' | 'FHD' | '4K' | 'unknown';
export type ChannelStatus = 'ok' | 'failed' | 'verifying' | 'pending';

export interface Channel {
  id: string;
  order: number;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  groupTitle: string;
  name: string;
  url: string;
  status?: ChannelStatus;
  quality?: QualityLevel;
  resolution?: string; // e.g., "1920x1080"
  codec?: string; // e.g., "avc1.64001f,mp4a.40.2"
  bitrate?: number; // in bps
}

export interface EpgChannel {
    id: string;
    name: string;
    logo: string;
}

export type Tab = 'editor' | 'reparacion' | 'asignar-epg' | 'save' | 'settings' | 'ayuda';
export type AttributeKey = 'tvgId' | 'tvgName' | 'tvgLogo' | 'groupTitle' | 'name' | 'url';