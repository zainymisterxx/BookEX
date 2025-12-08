/**
 * Environment Variable Validation
 * 
 * This module validates all required environment variables at application startup
 * to ensure the application has all necessary configuration before running.
 * Using Zod for type-safe validation with clear error messages.
 */

import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  
  // Authentication
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  
  // Google OAuth (optional in development, required in production)
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required').optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required').optional(),
  
  // Application URLs
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL').optional(),
  
  // Socket.IO
  SOCKET_PORT: z.string().regex(/^\d+$/, 'SOCKET_PORT must be a valid port number').optional().default('3001'),
  SOCKET_URL: z.string().url('SOCKET_URL must be a valid URL').optional(),
  
  // Redis (optional but validated if present)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().regex(/^\d+$/, 'REDIS_PORT must be a valid port number').optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),
  
  // Email (optional for now)
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email').optional(),
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.string().regex(/^\d+$/, 'EMAIL_SERVER_PORT must be a valid port number').optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  
  // Google AI (optional)
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed environment object
 * Throws an error with detailed information if validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    console.log('✓ Environment variables validated successfully');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      console.error('\nMissing or invalid environment variables:');
      
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.\n');
      
      throw new Error('Environment variable validation failed');
    }
    throw error;
  }
}

/**
 * Gets a validated environment variable
 * Use this helper to ensure type safety when accessing env vars
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const env = validateEnv();
  return env[key];
}
