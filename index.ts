export interface Channel {
  id: string;
  order: number;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  groupTitle: string;
  name: string;
  url: string;
  status?: 'ok' | 'failed' | 'verifying' | 'pending';
}

export interface EpgChannel {
    id: string;
    name: string;
    logo: string;
}

export type Tab = 'editor' | 'reparacion' | 'asignar-epg' | 'youtube' | 'save' | 'settings' | 'ayuda';
export type AttributeKey = 'tvgId' | 'tvgName' | 'tvgLogo' | 'groupTitle' | 'name' | 'url';