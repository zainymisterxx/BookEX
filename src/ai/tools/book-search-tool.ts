
'use server';
/**
 * @fileOverview Genkit tools for searching the MongoDB database.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import clientPromise from '@/lib/mongodb';
import type { Book } from '@/lib/types';

const SearchBooksInputSchema = z.object({
    title: z.string().optional().describe('The title of the book to search for (performs a broad, contains-style search).'),
    exactTitle: z.string().optional().describe('The exact title of the book to search for.'),
    author: z.string().optional().describe('The author of the book.'),
    genre: z.enum(["fantasy", "sci-fi", "mystery", "romance", "self-help", "historical-fiction"]).optional().describe('The genre of the book.'),
    condition: z.enum(['new', 'like-new', 'used', 'worn']).optional().describe('The condition of the book.'),
    city: z.string().optional().describe('The city to search for books in.'),
    type: z.enum(['sell', 'exchange']).optional().describe('The type of listing.'),
});

export const searchBooksTool = ai.defineTool(
    {
        name: 'searchBooksTool',
        description: 'Search for books in the marketplace database based on various criteria.',
        inputSchema: SearchBooksInputSchema,
        outputSchema: z.array(z.any()),
    },
    async (input) => {
        try {
            console.log("AI is searching for books with input:", input);
            const client = await clientPromise;
            const db = client.db("bookex");

            const query: any = {};

            if (input.exactTitle) {
                // Exact, case-insensitive match for a specific title
                query.title = { $regex: `^${input.exactTitle}$`, $options: 'i' };
            } else if (input.title) {
                // Broad, contains-style search
                query.title = { $regex: input.title, $options: 'i' };
            }
            
            if (input.author) {
                query.author = { $regex: input.author, $options: 'i' };
            }
            if (input.genre) {
                query.genre = input.genre;
            }
            if (input.condition) {
                query.condition = input.condition;
            }
            if (input.city) {
                const { findCanonicalCity, makeNormalizedKey } = await import('@/lib/location/location-utils');
                const m = await findCanonicalCity(input.city);
                query.cityNormalized = m?.normalized || makeNormalizedKey(input.city);
            }
            if (input.type) {
                query.type = input.type;
            }

            const books = await db.collection<Book>('books').find(query).limit(10).toArray();
            
            // Return only safe, public fields to prevent data exposure
            const safeBooks = books.map(book => ({
                _id: book._id.toString(),
                title: book.title,
                author: book.author,
                price: book.price,
                imageUrl: book.imageUrl,
                type: book.type,
                genre: book.genre,
                condition: book.condition,
                city: (book as any).cityName || (book as any).city || null,
                cityNormalized: (book as any).cityNormalized || null,
                // Explicitly exclude sensitive fields like sellerId, sellerContact, etc.
            }));
            
            console.log(`AI search returned ${safeBooks.length} books`);
            return safeBooks;

        } catch (error) {
            console.error("Error searching books tool:", error);
            return [];
        }
    }
);
