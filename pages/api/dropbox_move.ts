import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { accessToken, fromPath, toPath } = req.body;

    if (!accessToken || !fromPath || !toPath) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        console.log(`[Dropbox Move] Attempting to move from ${fromPath} to ${toPath}`);

        const response = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from_path: fromPath,
                to_path: toPath,
                autorename: true, // Si hay conflicto en la papelera, renombra automáticamente (ej: archivo(1).m3u)
                allow_shared_folder: true,
                allow_ownership_transfer: true
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('[Dropbox Move] Error:', data);
            
            // Manejo específico para "no encontrado": Devolver 404 para que el frontend pueda reintentar con otra ruta
            if (JSON.stringify(data).includes('path_lookup/not_found')) {
                return res.status(404).json({ error: 'File not found at path', dropboxError: data });
            }

            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);

    } catch (error: any) {
        console.error('[Dropbox Move] Exception:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
