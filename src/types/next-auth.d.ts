import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
      status?: 'active' | 'suspended' | 'deactivated';
      profileCompleted?: boolean;
    } & DefaultSession["user"]
  }
}
