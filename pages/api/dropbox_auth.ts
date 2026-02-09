import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, code_verifier, redirect_uri, client_id } = req.body;

    if (!code || !code_verifier || !redirect_uri || !client_id) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('client_id', client_id);
        params.append('code_verifier', code_verifier);
        params.append('redirect_uri', redirect_uri);

        const response = await fetch('https://api.dropbox.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Dropbox API Error:', data);
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);
    } catch (error: any) {
        console.error('Dropbox auth proxy error:', error);
        res.status(500).json({ error: 'Internal server error during Dropbox authentication', details: error.message });
    }
}
