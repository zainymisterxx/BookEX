'use server';
/**
 * @fileOverview An AI flow to analyze a book's condition and suggest a price.
 *
 * - analyzeBookCondition - A function that handles the book analysis process.
 * - AnalyzeBookConditionInput - The input type for the analyzeBookCondition function.
 * - AnalyzeBookConditionOutput - The return type for the analyzeBookCondition function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { validateImageData, checkContentPolicy, ValidationError } from '@/lib/ai-validation';
import { withRateLimit } from '@/lib/rate-limiter';

const AnalyzeBookConditionInputSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('The title of the book.'),
  author: z
    .string()
    .min(1)
    .max(100)
    .describe('The author of the book.'),
  description: z
    .string()
    .min(1)
    .max(500)
    .describe('A description of the book, including its physical condition.'),
  photoDataUri: z
    .string()
    .min(50) // minimum for a valid data URI
    .describe(
      "A photo of the book's cover, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  userId: z
    .string()
    .min(1)
    .describe('The user ID for rate limiting.'),
});
export type AnalyzeBookConditionInput = z.infer<typeof AnalyzeBookConditionInputSchema>;

const AnalyzeBookConditionOutputSchema = z.object({
    suggestedCondition: z.enum(['new', 'like-new', 'used', 'worn']).describe('The suggested condition of the book.'),
    justification: z.string().describe('A brief justification for the suggested condition and price.'),
    suggestedPricePKR: z.number().describe('The suggested price for the book in Pakistani Rupees (PKR).'),
});
export type AnalyzeBookConditionOutput = z.infer<typeof AnalyzeBookConditionOutputSchema>;

export async function analyzeBookCondition(input: AnalyzeBookConditionInput): Promise<AnalyzeBookConditionOutput> {
  try {
    // Validate input schema
    const validatedInput = AnalyzeBookConditionInputSchema.parse(input);
    
    // Validate image data URI format
    const dataUriMatch = validatedInput.photoDataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataUriMatch) {
      throw new ValidationError('Invalid image data URI format. Expected: data:<mimetype>;base64,<encoded_data>');
    }

    const [, mimeType, base64Data] = dataUriMatch;
    
    // Validate image security
    const imageValidation = validateImageData(base64Data, mimeType);
    if (!imageValidation.isValid) {
      throw new ValidationError(`Image validation failed: ${imageValidation.error}`);
    }

    // Check content policy for text fields
    const titleCheck = checkContentPolicy(validatedInput.title);
    const authorCheck = checkContentPolicy(validatedInput.author);
    const descriptionCheck = checkContentPolicy(validatedInput.description);
    
    if (!titleCheck.isAcceptable) {
      throw new ValidationError(`Title contains inappropriate content: ${titleCheck.issues?.join(', ')}`);
    }
    
    if (!authorCheck.isAcceptable) {
      throw new ValidationError(`Author contains inappropriate content: ${authorCheck.issues?.join(', ')}`);
    }
    
    if (!descriptionCheck.isAcceptable) {
      throw new ValidationError(`Description contains inappropriate content: ${descriptionCheck.issues?.join(', ')}`);
    }

    // Apply rate limiting and analyze condition
    return await withRateLimit(validatedInput.userId, 'ai-condition', async () => {
      return analyzeBookConditionFlow(validatedInput);
    });

  } catch (error) {
    console.error('Book condition analysis error:', error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Validation failed: ${formattedErrors}`);
    }
    
    throw new Error('Failed to analyze book condition. Please try again.');
  }
}

const prompt = ai.definePrompt({
  name: 'analyzeBookConditionPrompt',
  input: {schema: AnalyzeBookConditionInputSchema},
  output: {schema: AnalyzeBookConditionOutputSchema},
  prompt: `You are an expert used book appraiser. Your task is to analyze the provided information about a book and suggest its condition and a fair market price in Pakistani Rupees (PKR).

Analyze the user's description and the provided photo to determine the book's condition. The possible conditions are: new, like-new, used, worn.

Based on the title, author, and condition, suggest a fair selling price in PKR.

Book Details:
Title: {{{title}}}
Author: {{{author}}}
Description: {{{description}}}
Photo: {{media url=photoDataUri}}

Provide your analysis in the required output format. The justification should be concise (1-2 sentences).`,
});

const analyzeBookConditionFlow = ai.defineFlow(
  {
    name: 'analyzeBookConditionFlow',
    inputSchema: AnalyzeBookConditionInputSchema,
    outputSchema: AnalyzeBookConditionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
