// Define the Channel type within the worker's scope
export interface Channel {
    id: string;
    order: number;
    tvgId: string;
    tvgName: string;
    tvgLogo: string;
    groupTitle: string;
    name: string;
    url: string;
    status?: 'pending' | 'ok' | 'failed' | 'verifying';
}

const parseM3U = (content: string): Channel[] => {
    const lines = content.split('\n');
    if (lines[0].trim() !== '#EXTM3U') {
        throw new Error('Archivo no válido. Debe empezar con #EXTM3U.');
    }
    const parsedChannels: Channel[] = [];
    let order = 1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('#EXTINF:')) {
            const info = lines[i].trim().substring(8);
            const url = lines[++i]?.trim() || '';
            const tvgId = info.match(/tvg-id="([^"]*)"/)?.["1"] || '';
            const tvgName = info.match(/tvg-name="([^"]*)"/)?.["1"] || '';
            const tvgLogo = info.match(/tvg-logo="([^"]*)"/)?.["1"] || '';
            const groupTitle = info.match(/group-title="([^"]*)"/)?.["1"] || '';
            const name = info.split(',').pop()?.trim() || '';
            if (name && url) {
                parsedChannels.push({
                    id: `channel-${Date.now()}-${Math.random()}`,
                    order: order++,
                    tvgId,
                    tvgName,
                    tvgLogo,
                    groupTitle,
                    name,
                    url,
                    status: 'pending',
                });
            }
        }
    }
    return parsedChannels;
};

self.onmessage = (event: MessageEvent<string>) => {
    try {
        const channels = parseM3U(event.data);
        self.postMessage({ type: 'success', channels });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown worker error';
        self.postMessage({ type: 'error', message });
    }
};

export {};