import type { NextApiRequest, NextApiResponse } from 'next';

type Status = 'ok' | 'failed';

interface VerificationResult {
    [url: string]: Status;
}

async function checkChannel(url: string): Promise<Status> {
    let retries = 3;
    while (retries > 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
                signal: controller.signal,
                redirect: 'follow',
            });

            clearTimeout(timeoutId);

            if (response.status >= 200 && response.status < 400) {
                const contentType = response.headers.get('content-type')?.toLowerCase() || '';
                if (!['text/html', 'text/plain', 'application/json'].some(ct => contentType.includes(ct))) {
                    return 'ok';
                }
            }
        } catch (error) {
            // ignore error and retry
        } finally {
            clearTimeout(timeoutId);
        }
        retries--;
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
    }
    return 'failed';
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<VerificationResult | { error: string }>
) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Request body must be an array of URLs.' });
    }

    const results: VerificationResult = {};
    const promises = urls.map(async (url: string) => {
        const status = await checkChannel(url);
        results[url] = status;
    });

    await Promise.all(promises);

    res.status(200).json(results);
}