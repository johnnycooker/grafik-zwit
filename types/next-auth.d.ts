// types/next-auth.d.ts

import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import type { AppPermission, AppRole } from "@/types/auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      role: AppRole;
      permissions: AppPermission[];
      isSystem: boolean;
    };
  }

  interface User {
    id: string;
    username: string;
    role: AppRole;
    permissions: AppPermission[];
    isSystem: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: AppRole;
    permissions?: AppPermission[];
    isSystem?: boolean;
  }
}
