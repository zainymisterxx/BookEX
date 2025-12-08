# Technology Stack and Integration Standards

## Approved Technology Stack

### CRITICAL: Technology Immutability

⚠️ **The technologies listed in this document are MANDATORY and CANNOT be replaced without explicit approval from the project stakeholders and architecture review board.**

AI agents are **FORBIDDEN** from:
- Suggesting alternative technologies
- Replacing core technologies
- Introducing competing libraries
- Deprecating approved technologies

---

## Frontend Technologies

### FE-1: React and Next.js

```
FRAMEWORK: Next.js 13+ (App Router)

MANDATORY USAGE:
- React 18+ for UI components
- Next.js App Router (NOT Pages Router)
- Server Components by default
- Client Components only when necessary

RATIONALE:
- Server-side rendering for SEO and performance
- File-based routing
- Built-in API routes
- Image optimization
- Font optimization
- Integrated TypeScript support

CONFIGURATION:
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['your-cdn-domain.com'],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;

DO NOT:
- Replace with Create React App
- Replace with Vite
- Replace with Remix
- Use Pages Router for new features
- Disable React Strict Mode
```

### FE-2: TypeScript

```
LANGUAGE: TypeScript 5+

MANDATORY USAGE:
- All new code must be TypeScript
- Strict mode enabled
- No implicit any
- Explicit return types for functions

CONFIGURATION:
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

BEST PRACTICES:
- Define interfaces for all props
- Use type inference where appropriate
- Avoid 'any' type (use 'unknown' if needed)
- Use utility types (Partial, Pick, Omit, etc.)

DO NOT:
- Write new code in JavaScript
- Use @ts-ignore except in extreme cases (document reason)
- Disable strict mode
- Use 'any' type without justification
```

### FE-3: UI Component Library (shadcn/ui)

```
COMPONENT LIBRARY: shadcn/ui (built on Radix UI)

MANDATORY USAGE:
- Use shadcn/ui components as base
- Customize via Tailwind CSS
- Maintain consistent design system

INSTALLATION:
npx shadcn-ui@latest init

COMPONENTS LOCATION:
/src/components/ui/

INCLUDED COMPONENTS:
- button, input, textarea, select
- dialog, alert-dialog, dropdown-menu
- card, sheet, toast
- form components with validation
- accordion, tabs, tooltip
- avatar, badge, separator

CUSTOMIZATION:
- Use Tailwind classes for styling
- Extend component variants
- Maintain accessibility (ARIA attributes)

DO NOT:
- Replace with Material-UI (MUI)
- Replace with Ant Design
- Replace with Chakra UI
- Remove Radix UI primitives
- Violate accessibility standards
```

### FE-4: Styling (Tailwind CSS)

```
STYLING FRAMEWORK: Tailwind CSS 3+

MANDATORY USAGE:
- Utility-first CSS approach
- Use Tailwind classes in JSX
- Custom utilities in tailwind.config
- No inline styles (use Tailwind)

CONFIGURATION:
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette
        primary: {...},
        secondary: {...},
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

BEST PRACTICES:
- Use semantic color names (primary, secondary)
- Responsive design (mobile-first)
- Dark mode support (if implemented)
- Consistent spacing scale

DO NOT:
- Replace with CSS Modules
- Replace with Styled Components
- Replace with Emotion
- Write custom CSS files (use Tailwind)
- Use !important (fix specificity instead)
```

### FE-5: Form Handling

```
FORM LIBRARY: react-hook-form

VALIDATION LIBRARY: Zod

MANDATORY USAGE:
- react-hook-form for form state management
- Zod for schema validation
- Integrate with shadcn/ui form components

EXAMPLE:
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  price: z.number().positive().optional(),
});

type FormData = z.infer<typeof formSchema>;

function BookForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      author: '',
    },
  });

  // Form implementation
}

BENEFITS:
- Type-safe forms with TypeScript
- Automatic validation
- Performance optimization (less re-renders)
- Easy integration with Next.js Server Actions

DO NOT:
- Replace with Formik
- Replace with Final Form
- Use manual form state management
- Skip validation (always use Zod)
```

---

## Backend Technologies

### BE-1: Node.js Runtime

```
RUNTIME: Node.js 18 LTS or higher

MANDATORY VERSION:
- Minimum: Node.js 18.17.0
- Recommended: Node.js 20 LTS
- Support: Match Vercel deployment environment

FEATURES USED:
- ES modules (import/export)
- Async/await
- Fetch API (native)
- Web Crypto API

DO NOT:
- Use Node.js < 18
- Replace with Deno
- Replace with Bun (unless specifically approved)
```

### BE-2: Next.js API Routes and Server Actions

```
API LAYER: Next.js App Router API Routes + Server Actions

MANDATORY USAGE:
- API Routes for public endpoints: /src/app/api/[resource]/route.ts
- Server Actions for mutations: /src/app/actions.ts
- Server Components for data fetching

API ROUTE STRUCTURE:
// /src/app/api/books/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  // Handle GET request
  return NextResponse.json({ data: [] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Handle POST request
}

SERVER ACTION STRUCTURE:
// /src/app/actions.ts
'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';

export async function createBook(formData: FormData) {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  // Validate and create book
  
  revalidatePath('/books');
  return { success: true };
}

BEST PRACTICES:
- Use Server Actions for form submissions
- Use API Routes for external integrations
- Validate input on server side always
- Return serializable data only
- Revalidate cache after mutations

DO NOT:
- Create separate Express.js server
- Use tRPC (unless specifically approved)
- Skip server-side validation
- Return non-serializable data
```

### BE-3: Database (MongoDB)

```
DATABASE: MongoDB 5.0+

ORM/ODM: Mongoose 7+

MANDATORY USAGE:
- MongoDB as primary database
- Mongoose for schema definition
- MongoDB Atlas for hosting (or self-hosted)

CONNECTION:
// /src/lib/mongodb.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;

SCHEMA DEFINITION:
// /src/models/Book.ts
import mongoose, { Schema, Document } from 'mongoose';

interface IBook extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  author: string;
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor';
  listingType: 'sell' | 'exchange';
  price?: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    condition: {
      type: String,
      enum: ['new', 'like-new', 'good', 'fair', 'poor'],
      required: true,
    },
    listingType: {
      type: String,
      enum: ['sell', 'exchange'],
      required: true,
    },
    price: {
      type: Number,
      min: 0,
      required: function (this: IBook) {
        return this.listingType === 'sell';
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'exchanged', 'sold', 'donated'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BookSchema.index({ userId: 1 });
BookSchema.index({ title: 'text', author: 'text', description: 'text' });
BookSchema.index({ city: 1, condition: 1, listingType: 1 });

export default mongoose.models.Book || mongoose.model<IBook>('Book', BookSchema);

DO NOT:
- Replace with PostgreSQL
- Replace with MySQL
- Replace with Prisma ORM
- Skip schema validation
- Disable Mongoose timestamps
```

### BE-4: Authentication (NextAuth.js)

```
AUTHENTICATION: NextAuth.js v5 (Auth.js)

MANDATORY USAGE:
- NextAuth.js for authentication
- Credentials provider (email/password)
- Session-based authentication

CONFIGURATION:
// /src/lib/auth-config.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from './mongodb';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await User.findOne({ email: credentials.email });
        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
      }
      return session;
    },
  },
};

USAGE IN SERVER COMPONENTS:
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

export default async function Page() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }
  
  // Render protected content
}

USAGE IN CLIENT COMPONENTS:
'use client';
import { useSession } from 'next-auth/react';

export default function Component() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') {
    return <div>Loading...</div>;
  }
  
  if (!session) {
    return <div>Not authenticated</div>;
  }
  
  // Render authenticated content
}

DO NOT:
- Replace with Clerk
- Replace with Auth0
- Replace with Supabase Auth
- Implement custom JWT authentication
- Use OAuth without NextAuth.js
```

### BE-5: Password Hashing (bcrypt)

```
HASHING LIBRARY: bcryptjs

MANDATORY USAGE:
- bcryptjs for password hashing
- Salt rounds: 10-12

USAGE:
import bcrypt from 'bcryptjs';

// Hash password on registration
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

// Verify password on login
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const isValid = await bcrypt.compare(password, hash);
  return isValid;
}

DO NOT:
- Replace with Argon2 (without approval)
- Replace with PBKDF2
- Reduce salt rounds below 10
- Store plain text passwords
- Hash passwords on client side
```

---

## Real-Time Communication

### RT-1: WebSocket (Socket.IO)

```
WEBSOCKET LIBRARY: Socket.IO 4+

MANDATORY USAGE:
- Socket.IO for real-time messaging
- Custom Next.js server (server.ts)
- Redis adapter for scaling (production)

CUSTOM SERVER:
// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
  });

  // Redis adapter for horizontal scaling (production)
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
    });
  }

  // Socket.IO event handlers
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinChat', (chatId) => {
      socket.join(chatId);
    });

    socket.on('sendMessage', async (data) => {
      // Validate and save message
      io.to(data.chatId).emit('newMessage', message);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});

CLIENT PROVIDER:
// /src/components/socket-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_APP_URL!, {
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

DO NOT:
- Replace with plain WebSocket API
- Replace with Pusher
- Replace with Ably
- Replace with Firebase Realtime Database
- Skip Redis adapter in production
```

---

## AI Integration

### AI-1: Genkit with Gemini

```
AI FRAMEWORK: Firebase Genkit

AI MODEL: Google Gemini 2.5 Flash

MANDATORY USAGE:
- Genkit for AI flow orchestration
- Gemini AI for language model
- Structured tools for database queries

SETUP:
// /src/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI, gemini25Flash } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: gemini25Flash,
});

FLOW DEFINITION:
// /src/ai/flows/recommendations.ts
import { ai } from '../genkit';
import { searchBooksTool } from '../tools/searchBooks';

export const getBookRecommendationsFlow = ai.defineFlow(
  {
    name: 'getBookRecommendations',
    inputSchema: z.object({
      userInput: z.string(),
      userId: z.string(),
    }),
    outputSchema: z.object({
      recommendations: z.array(z.object({
        bookId: z.string(),
        title: z.string(),
        reason: z.string(),
      })),
    }),
  },
  async (input) => {
    const { response } = await ai.generate({
      model: gemini25Flash,
      prompt: `Based on user input: "${input.userInput}", recommend books from the database.`,
      tools: [searchBooksTool],
      config: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    return { recommendations: parseRecommendations(response) };
  }
);

TOOL DEFINITION:
// /src/ai/tools/searchBooks.ts
import { ai } from '../genkit';
import { z } from 'zod';
import Book from '@/models/Book';

export const searchBooksTool = ai.defineTool(
  {
    name: 'searchBooks',
    description: 'Search for books in the database',
    inputSchema: z.object({
      query: z.string(),
      filters: z.object({
        genre: z.string().optional(),
        condition: z.string().optional(),
        city: z.string().optional(),
      }).optional(),
    }),
    outputSchema: z.array(z.object({
      id: z.string(),
      title: z.string(),
      author: z.string(),
      condition: z.string(),
      price: z.number().optional(),
    })),
  },
  async ({ query, filters }) => {
    const searchQuery: any = {
      $text: { $search: query },
      status: 'active',
    };

    if (filters) {
      if (filters.genre) searchQuery.genre = filters.genre;
      if (filters.condition) searchQuery.condition = filters.condition;
      if (filters.city) searchQuery.city = filters.city;
    }

    const books = await Book.find(searchQuery).limit(10);
    return books.map(book => ({
      id: book._id.toString(),
      title: book.title,
      author: book.author,
      condition: book.condition,
      price: book.price,
    }));
  }
);

RATE LIMITING:
- Implement 5 requests per hour per user
- Track in user session or database
- Return 429 if exceeded

DO NOT:
- Replace with OpenAI (ChatGPT)
- Replace with Anthropic (Claude)
- Replace with custom LLM
- Skip rate limiting
- Expose API key to client
```

---

## Development Tools

### DEV-1: Package Manager

```
PACKAGE MANAGER: npm (Node Package Manager)

MANDATORY USAGE:
- Use npm for dependency management
- Commit package-lock.json
- Use exact versions for critical packages

COMMANDS:
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript check

DO NOT:
- Replace with Yarn (unless team decision)
- Replace with pnpm (unless team decision)
- Delete package-lock.json
- Mix package managers
```

### DEV-2: Code Quality (ESLint + Prettier)

```
LINTING: ESLint 8+

FORMATTING: Prettier 3+

CONFIGURATION:
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}

// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}

ENFORCEMENT:
- Run ESLint on pre-commit hook (Husky)
- Run Prettier on save (VS Code)
- Fail build if linting errors

DO NOT:
- Disable ESLint rules globally
- Skip formatting
- Commit code with linting errors
```

### DEV-3: Version Control (Git)

```
VERSION CONTROL: Git

BRANCHING STRATEGY:
- main: Production-ready code
- develop: Integration branch
- feature/[name]: New features
- bugfix/[name]: Bug fixes
- hotfix/[name]: Urgent fixes

COMMIT CONVENTION:
feat: Add new book listing feature
fix: Fix message delivery bug
docs: Update API documentation
style: Format code with Prettier
refactor: Refactor authentication logic
test: Add tests for exchange flow
chore: Update dependencies

HOOKS (Husky):
pre-commit:
  - Run ESLint
  - Run Prettier
  - Run TypeScript check

pre-push:
  - Run tests
  - Build project

DO NOT:
- Commit directly to main
- Force push to shared branches
- Commit secrets or API keys
- Skip commit messages
```

---

## Deployment and Infrastructure

### DEPLOY-1: Hosting Platform

```
HOSTING: Vercel (Primary)

ALTERNATIVES (if needed):
- AWS (EC2, ECS, Lambda)
- Google Cloud Platform (App Engine, Cloud Run)
- Self-hosted (Docker + Kubernetes)

VERCEL CONFIGURATION:
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "MONGODB_URI": "@mongodb-uri",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "GEMINI_API_KEY": "@gemini-api-key"
  }
}

DEPLOYMENT:
- Automatic deployment from main branch
- Preview deployments for pull requests
- Environment variables in Vercel dashboard
- Custom domain configuration

DO NOT:
- Deploy to Netlify (not optimized for Next.js)
- Deploy to GitHub Pages (static only)
- Skip environment variable configuration
```

### DEPLOY-2: Database Hosting

```
DATABASE HOSTING: MongoDB Atlas (Primary)

ALTERNATIVES:
- Self-hosted MongoDB
- AWS DocumentDB
- Google Cloud Firestore (not recommended)

MONGODB ATLAS:
- M10 cluster minimum (production)
- M0 free tier (development)
- Replica set enabled
- Automated backups (daily)
- IP whitelist configured
- Database user with limited permissions

CONNECTION STRING:
mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>?retryWrites=true&w=majority

SECURITY:
- Use environment variables for credentials
- Rotate passwords quarterly
- Enable encryption at rest
- Enable TLS/SSL

DO NOT:
- Use local MongoDB in production
- Expose MongoDB port publicly
- Use default credentials
- Disable authentication
```

### DEPLOY-3: File Storage

```
FILE STORAGE: AWS S3 or Google Cloud Storage

CONFIGURATION:
Bucket Structure:
- bookex-production/
  - books/         # Book cover images
  - avatars/       # User profile pictures
  - attachments/   # Chat attachments
  - community/     # Community images

Security:
- Private buckets (no public access)
- Signed URLs for uploads (presigned)
- Signed URLs for downloads (time-limited)
- CORS configuration for allowed origins

CDN:
- CloudFront (AWS) or Cloud CDN (GCP)
- Cache static assets (images, PDFs)
- Edge locations for performance
- Custom domain (cdn.bookex.com)

DO NOT:
- Store files in database
- Store files on application server
- Use public buckets
- Skip CDN configuration
```

---

## Integration Standards

### INT-1: External Service Integration Checklist

Before integrating any external service, verify:

1. **Security:**
   - [ ] API keys stored securely (environment variables)
   - [ ] HTTPS for all API calls
   - [ ] Rate limiting implemented
   - [ ] Error handling for service failures

2. **Reliability:**
   - [ ] Fallback mechanism for service downtime
   - [ ] Retry logic for transient failures
   - [ ] Circuit breaker pattern (if critical)
   - [ ] Monitoring and alerting configured

3. **Privacy:**
   - [ ] Review service privacy policy
   - [ ] Sign Data Processing Agreement (DPA)
   - [ ] Minimize data sent to service
   - [ ] Comply with GDPR/privacy regulations

4. **Cost:**
   - [ ] Understand pricing model
   - [ ] Set usage limits/budgets
   - [ ] Monitor usage and costs
   - [ ] Have cost alerts configured

5. **Documentation:**
   - [ ] Document integration in codebase
   - [ ] Add service to architecture diagram
   - [ ] Include in disaster recovery plan

### INT-2: API Client Pattern

```typescript
// /src/lib/api-client.ts
export class APIClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(baseURL: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    };
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // put, delete methods...
}

// Usage
const geminiClient = new APIClient(
  'https://generativelanguage.googleapis.com',
  process.env.GEMINI_API_KEY
);
```

---

## Technology Migration Policy

### When Technology Migration is Allowed

Technology can only be migrated if:

1. **Critical Security Vulnerability:**
   - Library has unpatched critical vulnerability
   - No workaround available
   - Affects production system

2. **End of Life (EOL):**
   - Technology officially deprecated
   - No security updates
   - Community abandoned

3. **Performance Issues:**
   - Proven performance bottleneck
   - Alternative significantly faster (10x+)
   - Performance critical for business

4. **Architecture Decision Record (ADR) Approved:**
   - Document current state
   - Justify migration need
   - Propose alternative
   - Estimate effort and risk
   - Get stakeholder approval

### Migration Process

1. Create Architecture Decision Record (ADR)
2. Proof of concept with alternative
3. Benchmark comparison
4. Security review
5. Cost-benefit analysis
6. Stakeholder approval
7. Create migration plan
8. Execute in stages
9. Monitor post-migration

---

## Compliance Checklist for Technology Stack

Before using any new technology:

- [ ] Technology is on approved list OR has ADR approval
- [ ] Security review completed
- [ ] Privacy implications assessed
- [ ] Cost implications understood
- [ ] Team has necessary skills OR training planned
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Fallback plan exists

**AI agents must NEVER introduce new technologies without explicit approval.**

---

## Summary of Immutable Technologies

| Category | Technology | Status |
|----------|-----------|--------|
| Frontend Framework | Next.js (App Router) | IMMUTABLE |
| Language | TypeScript | IMMUTABLE |
| UI Library | shadcn/ui | IMMUTABLE |
| Styling | Tailwind CSS | IMMUTABLE |
| Forms | react-hook-form + Zod | IMMUTABLE |
| Database | MongoDB + Mongoose | IMMUTABLE |
| Authentication | NextAuth.js | IMMUTABLE |
| Password Hashing | bcryptjs | IMMUTABLE |
| Real-time | Socket.IO | IMMUTABLE |
| AI | Genkit + Gemini | IMMUTABLE |

**These technologies form the foundation of BookEx and cannot be changed without formal approval process.**
