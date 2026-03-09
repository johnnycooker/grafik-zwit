// auth.ts

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeFirestoreAccount } from "@/lib/auth-accounts";
import { writeAuditLog } from "@/lib/auth-audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: {
          label: "Login",
          type: "text",
        },
        password: {
          label: "Hasło",
          type: "password",
        },
      },
      async authorize(credentials, request) {
        const username =
          typeof credentials?.username === "string"
            ? credentials.username.trim()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!username || !password) {
          await writeAuditLog({
            actorUsername: username || null,
            action: "auth.login",
            category: "auth",
            entityType: "account",
            entityLabel: username || null,
            status: "failure",
            message: `Nieudane logowanie dla loginu ${username || "brak"}.`,
            meta: {
              reason: "Brak loginu lub hasła.",
            },
            request,
          });

          return null;
        }

        const user = await authorizeFirestoreAccount(username, password);

        if (!user) {
          await writeAuditLog({
            actorUsername: username,
            action: "auth.login",
            category: "auth",
            entityType: "account",
            entityLabel: username,
            status: "failure",
            message: `Nieudane logowanie dla loginu ${username}.`,
            meta: {
              reason: "Nieprawidłowy login lub hasło.",
            },
            request,
          });

          return null;
        }

        await writeAuditLog({
          actorId: user.id,
          actorUsername: user.username,
          action: "auth.login",
          category: "auth",
          entityType: "account",
          entityId: user.id,
          entityLabel: user.username,
          targetName: user.username,
          status: "success",
          message: `Użytkownik ${user.username} zalogował się do systemu.`,
          meta: {
            role: user.role,
          },
          request,
        });

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.permissions = user.permissions;
        token.isSystem = user.isSystem;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.username =
          typeof token.username === "string" ? token.username : "";
        session.user.role =
          token.role === "admin" ||
          token.role === "coordinator" ||
          token.role === "employee"
            ? token.role
            : "employee";
        session.user.permissions = Array.isArray(token.permissions)
          ? token.permissions
          : [];
        session.user.isSystem = Boolean(token.isSystem);
      }

      return session;
    },
  },
});
