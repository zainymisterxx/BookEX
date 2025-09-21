import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import clientPromise from '@/lib/mongodb';
import { compare } from 'bcryptjs';
import type { User } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { checkAuthRateLimit, recordAuthResult } from '@/lib/auth-rate-limiting';

export const authOptions: NextAuthOptions = {
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
          
          const user = await users.findOne({ email: credentials.email.toLowerCase() }) as User | null;
          console.log('User found:', user ? 'Yes' : 'No');

          if (!user) {
            console.log('User not found in database');
            return null;
          }

          // Check if user account is suspended
          if (user.status === 'suspended') {
            console.log('User account is suspended');
            return null;
          }

          console.log('Checking password...');
          const isValid = await compare(credentials.password, user.password || '');
          console.log('Password valid:', isValid);

          if (!isValid) {
            console.log('Invalid password');
            return null;
          }

          console.log('Authentication successful, returning user object');
          // Return user object (password will be omitted automatically)
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.avatarUrl || null,
            role: user.role || 'user',
            status: user.status || 'active',
            profileCompleted: user.profileCompleted || false,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.status = (user as any).status;
        token.profileCompleted = (user as any).profileCompleted;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as 'user' | 'admin';
        session.user.status = token.status as 'active' | 'suspended' | 'deactivated';
        session.user.profileCompleted = token.profileCompleted as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // Redirect users to homepage for login
  },
  secret: process.env.NEXTAUTH_SECRET,
};
