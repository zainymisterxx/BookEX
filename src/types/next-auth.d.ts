import { DefaultSession } from "next-auth"
import type { UserRole, UserStatus } from "@/lib/types"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string;
      role: UserRole;
      status?: UserStatus;
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    status?: UserStatus;
    username?: string;
  }
}
