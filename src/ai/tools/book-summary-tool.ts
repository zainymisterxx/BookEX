'use server';
/**
 * @fileOverview Genkit tool for generating book summaries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const BookSummaryInputSchema = z.object({
    bookIdentifier: z.string().describe('The title or ISBN of the book to summarize.'),
});

// Internal prompt for generating book summaries (used by tools)
const bookSummaryPrompt = ai.definePrompt({
  name: 'bookSummaryToolPrompt',
  input: {schema: BookSummaryInputSchema},
  output: {schema: z.object({ summary: z.string() })},
  prompt: `You are an expert literary analyst. Please provide a concise summary of the book identified by the following information: {{{bookIdentifier}}}. The summary should capture the main plot points and themes of the book. Keep the summary between 150-300 words and make it engaging for potential readers.`,
});

export const generateBookSummaryTool = ai.defineTool(
    {
        name: 'generateBookSummaryTool',
        description: 'Generates a concise summary of a book given its title or ISBN.',
        inputSchema: BookSummaryInputSchema,
        outputSchema: z.object({ summary: z.string() }),
    },
    async (input) => {
        try {
            // Generate summary directly using the prompt
            // Rate limiting is handled by the calling flow (intelligent-book-search)
            const { output } = await bookSummaryPrompt(input);
            return output!;
        } catch (error) {
            console.error('Book summary tool error:', error);
            // Return a fallback response instead of throwing
            return { 
                summary: `I apologize, but I'm unable to generate a detailed summary for "${input.bookIdentifier}" at this time. This could be because the book is not widely known or there was a temporary issue with the summary service. You might want to try searching for this book in our marketplace to see if it's available.` 
            };
        }
    }
);
