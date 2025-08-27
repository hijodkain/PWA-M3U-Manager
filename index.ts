export interface Channel {
  id: string;
  order: number;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  groupTitle: string;
  name: string;
  url: string;
}

export interface EpgChannel {
    id: string;
    name: string;
    logo: string;
}

export type Tab = 'editor' | 'curation' | 'epg' | 'save' | 'settings';
export type AttributeKey = 'tvgId' | 'tvgName' | 'tvgLogo' | 'groupTitle' | 'name' | 'url';
