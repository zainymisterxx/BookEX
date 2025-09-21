'use server';
/**
 * @fileOverview An AI flow that can act as a general-purpose assistant for the BookEx platform.
 *
 * - aiAssistantFlow - A function that handles various user queries using available tools.
 * - AiAssistantInput - The input type for the aiAssistantFlow function.
 * - AiAssistantOutput - The return type for the aiAssistantFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { searchBooksTool } from '../tools/book-search-tool';
import { generateBookSummaryTool } from '../tools/book-summary-tool';
import { validateAIInput, checkContentPolicy, ValidationError } from '@/lib/ai-validation';
import { withRateLimit } from '@/lib/rate-limiter';
import type { Book } from '@/lib/types';

const AiAssistantInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(300)
    .describe('The user\'s natural language query for interacting with the assistant.'),
  userId: z
    .string()
    .min(1)
    .describe('The user ID for rate limiting.'),
});
export type AiAssistantInput = z.infer<typeof AiAssistantInputSchema>;

const AiAssistantOutputSchema = z.object({
    books: z.array(z.object({
        _id: z.string(),
        title: z.string(),
        author: z.string(),
        price: z.number().optional(),
        imageUrl: z.string(),
        type: z.enum(['sell', 'exchange']),
    })).optional().describe('A list of books found that match the user\'s query.'),
    response: z.string().describe('A friendly, conversational response summarizing the actions taken and results for the user.'),
});
export type AiAssistantOutput = z.infer<typeof AiAssistantOutputSchema>;


export async function aiAssistantFlow(input: AiAssistantInput): Promise<AiAssistantOutput> {
  try {
    // Validate input schema
    const validatedInput = AiAssistantInputSchema.parse(input);
    
    // Check content policy
    const contentCheck = checkContentPolicy(validatedInput.query);
    if (!contentCheck.isAcceptable) {
      throw new ValidationError(`Query contains inappropriate content: ${contentCheck.issues?.join(', ')}`);
    }

    // Apply rate limiting and execute flow
    return await withRateLimit(validatedInput.userId, 'ai-search', async () => {
      return intelligentBookSearchFlow(validatedInput);
    });

  } catch (error) {
    console.error('AI assistant flow error:', error);
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Validation failed: ${formattedErrors}`);
    }
    
    throw new Error('Failed to process your request. Please try again.');
  }
}

const prompt = ai.definePrompt({
  name: 'aiAssistantPrompt',
  input: {schema: AiAssistantInputSchema},
  output: {schema: AiAssistantOutputSchema},
  tools: [searchBooksTool, generateBookSummaryTool],
  prompt: `You are a helpful assistant for BookEx, an online book marketplace. Your goal is to help users with their requests.

You have access to a set of tools:
1. 'searchBooksTool': Searches the marketplace's live inventory based on criteria like title, author, genre, etc.
2. 'generateBookSummaryTool': Provides a concise summary for a given book title or ISBN.

Analyze the user's query below.
- If the user asks to find books, use the 'searchBooksTool'.
- If the user is asking for a specific, single book title, use the 'exactTitle' parameter in the 'searchBooksTool' to ensure an exact match.
- If the user asks for a book summary, use the 'generateBookSummaryTool'.
- If the user asks for a multi-step task, like finding books and then summarizing one, use the tools in the correct sequence.

If the user's query is a simple greeting or off-topic, provide a polite response without using any tools.

After using the tool(s), formulate a friendly, conversational response to the user summarizing what you found or what actions you took. Include any structured data, like a list of books, in your final output.

User Query: {{{query}}}`,
});

const intelligentBookSearchFlow = ai.defineFlow(
  {
    name: 'aiAssistantFlow',
    inputSchema: AiAssistantInputSchema,
    outputSchema: AiAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
