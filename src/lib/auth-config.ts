import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import clientPromise from '@/lib/mongodb';
import { compare } from 'bcryptjs';
import type { User, UserRole, UserStatus } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { checkAuthRateLimit, recordAuthResult } from '@/lib/auth-rate-limiting';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  image: string | null;
  role: UserRole;
  status: UserStatus;
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        try {
          console.log('Auth attempt for:', credentials.email);

          const client = await clientPromise;
          const users = client.db('bookex').collection('users');
          
          const normalizedEmail = credentials.email.toLowerCase();
          const user = await users.findOne({ email: normalizedEmail }) as User | null;
          console.log('User found:', user ? 'Yes' : 'No');

          if (!user) {
            console.log('User not found in database');
            recordAuthResult('LOGIN', false, normalizedEmail);
            return null;
          }

          // Check if user account is suspended
          if (user.status === 'suspended') {
            console.log('User account is suspended');
            recordAuthResult('LOGIN', false, normalizedEmail);
            return null;
          }

          console.log('Checking password...');
          const isValid = await compare(credentials.password, user.password || '');
          console.log('Password valid:', isValid);

          if (!isValid) {
            console.log('Invalid password');
            recordAuthResult('LOGIN', false, normalizedEmail);
            return null;
          }

          console.log('Authentication successful, returning user object');
          recordAuthResult('LOGIN', true, normalizedEmail);
          // Return user object (password will be omitted automatically)
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            username: user.username || null,
            image: user.avatarUrl || null,
            role: user.role || 'user',
            status: user.status || 'active',
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authUser = user as unknown as AuthUser;
        token.role = authUser.role;
        token.status = authUser.status;
        token.username = authUser.username ?? undefined;
      }
      // Persist fields updated via useSession().update()
      if (trigger === 'update' && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.username !== undefined) token.username = session.username;
        if (session.image !== undefined) token.picture = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role ?? 'user';
        session.user.status = token.status;
        session.user.username = token.username;
        // Sync image from JWT so profile picture updates are reflected immediately
        if (token.picture !== undefined) {
          session.user.image = token.picture as string | null;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // Redirect users to homepage for login
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
