import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bookex.vercel.app';
    return [
        { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: `${base}/books`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
        { url: `${base}/exchange`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
        { url: `${base}/community`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${base}/donate`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ];
}
