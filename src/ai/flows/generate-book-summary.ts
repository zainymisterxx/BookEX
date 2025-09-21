'use server';

/**
 * @fileOverview Generates a short summary of a book given its title or ISBN.
 *
 * - generateBookSummary - A function that generates the book summary.
 * - GenerateBookSummaryInput - The input type for the generateBookSummary function.
 * - GenerateBookSummaryOutput - The return type for the generateBookSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { validateAIInput, checkContentPolicy, ValidationError } from '@/lib/ai-validation';
import { withRateLimit } from '@/lib/rate-limiter';

const GenerateBookSummaryInputSchema = z.object({
  bookIdentifier: z
    .string()
    .min(1)
    .max(300)
    .describe('The title or ISBN of the book to summarize.'),
  userId: z
    .string()
    .min(1)
    .describe('The user ID for rate limiting.'),
});

export type GenerateBookSummaryInput = z.infer<typeof GenerateBookSummaryInputSchema>;

const GenerateBookSummaryOutputSchema = z.object({
  summary: z.string().describe('A short summary of the book.'),
});

export type GenerateBookSummaryOutput = z.infer<typeof GenerateBookSummaryOutputSchema>;

export async function generateBookSummary(input: GenerateBookSummaryInput): Promise<GenerateBookSummaryOutput> {
  try {
    // Validate input schema
    const validatedInput = GenerateBookSummaryInputSchema.parse(input);
    
    // Check content policy
    const contentCheck = checkContentPolicy(validatedInput.bookIdentifier);
    if (!contentCheck.isAcceptable) {
      throw new ValidationError(`Book identifier contains inappropriate content: ${contentCheck.issues?.join(', ')}`);
    }

    // Apply rate limiting and generate summary
    return await withRateLimit(validatedInput.userId, 'ai-summary', async () => {
      return generateBookSummaryFlow(validatedInput);
    });

  } catch (error) {
    console.error('Book summary generation error:', error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Validation failed: ${formattedErrors}`);
    }
    
    throw new Error('Failed to generate book summary. Please try again.');
  }
}

const prompt = ai.definePrompt({
  name: 'generateBookSummaryPrompt',
  input: {schema: GenerateBookSummaryInputSchema},
  output: {schema: GenerateBookSummaryOutputSchema},
  prompt: `You are an expert literary analyst. Please provide a concise summary of the book identified by the following information: {{{bookIdentifier}}}. The summary should capture the main plot points and themes of the book. Keep the summary between 150-300 words and make it engaging for potential readers.`,
});

const generateBookSummaryFlow = ai.defineFlow(
  {
    name: 'generateBookSummaryFlow',
    inputSchema: GenerateBookSummaryInputSchema,
    outputSchema: GenerateBookSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
