import { config } from 'dotenv';
config();

import '@/ai/flows/generate-book-summary.ts';
import '@/ai/flows/get-book-recommendations.ts';
import '@/ai/flows/analyze-book-condition.ts';
import '@/ai/flows/intelligent-book-search.ts';
import '@/ai/tools/book-search-tool.ts';
import '@/ai/tools/book-summary-tool.ts';
