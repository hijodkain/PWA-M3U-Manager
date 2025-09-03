import type { VercelRequest, VercelResponse } from '@vercel/node';

const handler = async (req: VercelRequest, res: VercelResponse) => {
    const { url } = req.query;
    console.log(`Proxying URL: ${url}`);

    if (!url || typeof url !== 'string') {
        console.error('Missing URL parameter');
        return res.status(400).send('Missing URL parameter');
    }

    try {
        let fetchUrl = url;
        if (url.includes('dropbox.com')) {
            // Consistently transform to a direct download link
            const urlObject = new URL(url.replace('www.dropbox.com', 'dl.dropboxusercontent.com'));
            urlObject.searchParams.set('dl', '1');
            fetchUrl = urlObject.toString();
            console.log(`Transformed Dropbox URL to: ${fetchUrl}`);
        }

        const response = await fetch(fetchUrl);
        console.log(`Fetched URL: ${fetchUrl}, Status: ${response.status}`);
        if (!response.ok) {
            console.error(`Failed to fetch: ${response.statusText}`);
            // Forward the status code from the external server
            return res.status(response.status).send(response.statusText);
        }
        const data = await response.text();
        res.status(200).send(data);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching URL: ${errorMessage}`);
        res.status(500).send(`Error fetching URL: ${errorMessage}`);
    }
};

module.exports = handler;
