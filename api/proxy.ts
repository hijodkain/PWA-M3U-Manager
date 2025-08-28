import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;
    console.log(`Proxying URL: ${url}`);

    if (!url || typeof url !== 'string') {
        console.error('Missing URL parameter');
        return res.status(400).send('Missing URL parameter');
    }

    try {
        const response = await fetch(url);
        console.log(`Fetched URL: ${url}, Status: ${response.status}`);
        if (!response.ok) {
            console.error(`Failed to fetch: ${response.statusText}`);
            // Forward the status code from the external server
            return res.status(response.status).send(response.statusText);
        }
        const data = await response.text();
        res.status(200).send(data);
    } catch (error) {
        console.error(`Error fetching URL: ${error.message}`);
        res.status(500).send(`Error fetching URL: ${error.message}`);
    }
}