import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Validate API key on startup
function validateApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing required environment variable: GEMINI_API_KEY');
  }
  
  if (apiKey.length < 32) {
    throw new Error('Invalid API key format: API key appears to be too short');
  }
  
  if (!apiKey.startsWith('AI') && !apiKey.startsWith('ya29')) {
    console.warn('Warning: API key format may be invalid');
  }
  
  return apiKey;
}

// Secure configuration with validated API key
const apiKey = validateApiKey();

export const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-2.5-flash',
});
