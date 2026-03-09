// lib/auth-accounts.ts

import { randomUUID } from "crypto";
import { firestore } from "@/lib/firebase-admin";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getDefaultPermissionsForRole } from "@/lib/auth-permissions";
import type {
  AppAccount,
  AppAccountRecord,
  AppPermission,
  AppRole,
  SessionUserPayload,
} from "@/types/auth";

const COLLECTION_NAME = "app_accounts";

type CreateAccountInput = {
  username: string;
  password: string;
  role: AppRole;
  permissions: AppPermission[];
  createdBy?: string;
};

type UpdateAccountInput = {
  username?: string;
  role?: AppRole;
  permissions?: AppPermission[];
  isActive?: boolean;
};

function accountsCollection() {
  return firestore.collection(COLLECTION_NAME);
}

function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase("pl-PL");
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeAccount(record: AppAccountRecord): AppAccount {
  const { passwordHash: _passwordHash, ...rest } = record;
  return rest;
}

function uniquePermissions(permissions: AppPermission[]) {
  return [...new Set(permissions)];
}

async function getAccountDocByUsername(username: string) {
  const normalized = normalizeUsername(username);

  const snapshot = await accountsCollection()
    .where("username", "==", normalized)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0];
}

export async function getAccountByUsername(
  username: string,
): Promise<AppAccountRecord | null> {
  const doc = await getAccountDocByUsername(username);

  if (!doc) {
    return null;
  }

  return doc.data() as AppAccountRecord;
}

export async function getAccountById(
  id: string,
): Promise<AppAccountRecord | null> {
  const doc = await accountsCollection().doc(id).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as AppAccountRecord;
}

async function ensureSingleSystemAdminAccount() {
  const adminUsername = process.env.DEV_SYSTEM_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.DEV_SYSTEM_ADMIN_PASSWORD || "grafik5566";

  const existing = await getAccountByUsername(adminUsername);
  const timestamp = nowIso();
  const permissions = getDefaultPermissionsForRole("admin");

  if (!existing) {
    const payload: AppAccountRecord = {
      id: "system-admin-user",
      username: normalizeUsername(adminUsername),
      passwordHash: hashPassword(adminPassword),
      role: "admin",
      permissions,
      isActive: true,
      isSystem: true,
      mustChangePassword: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await accountsCollection().doc(payload.id).set(payload);
    return;
  }

  await accountsCollection()
    .doc(existing.id)
    .set(
      {
        ...existing,
        username: normalizeUsername(adminUsername),
        role: "admin",
        permissions,
        isSystem: true,
        isActive: true,
        updatedAt: timestamp,
      },
      { merge: true },
    );
}

export async function ensureSystemAccounts() {
  await ensureSingleSystemAdminAccount();
}

export async function authorizeFirestoreAccount(
  username: string,
  password: string,
): Promise<SessionUserPayload | null> {
  await ensureSystemAccounts();

  const account = await getAccountByUsername(username);

  if (!account || !account.isActive) {
    return null;
  }

  const isValid = verifyPassword(password, account.passwordHash);

  if (!isValid) {
    return null;
  }

  await accountsCollection().doc(account.id).set(
    {
      lastLoginAt: nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true },
  );

  return {
    id: account.id,
    username: account.username,
    role: account.role,
    permissions: account.permissions,
    isSystem: account.isSystem,
  };
}

export async function listAccounts(): Promise<AppAccount[]> {
  await ensureSystemAccounts();

  const snapshot = await accountsCollection().get();
  const items = snapshot.docs.map((doc) => doc.data() as AppAccountRecord);

  return items
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) {
        return a.isSystem ? -1 : 1;
      }
      return a.username.localeCompare(b.username, "pl");
    })
    .map(sanitizeAccount);
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<AppAccount[]> {
  await ensureSystemAccounts();

  const username = normalizeUsername(input.username);

  if (!username) {
    throw new Error("Login jest wymagany.");
  }

  if (!input.password || input.password.length < 6) {
    throw new Error("Hasło musi mieć minimum 6 znaków.");
  }

  if (input.role === "admin") {
    throw new Error("Nie można tworzyć kolejnych kont admina z panelu.");
  }

  const existing = await getAccountByUsername(username);

  if (existing) {
    throw new Error("Konto o takim loginie już istnieje.");
  }

  const timestamp = nowIso();

  const permissions =
    input.permissions.length > 0
      ? uniquePermissions(input.permissions)
      : getDefaultPermissionsForRole(input.role);

  const payload: AppAccountRecord = {
    id: randomUUID(),
    username,
    passwordHash: hashPassword(input.password),
    role: input.role,
    permissions,
    isActive: true,
    isSystem: false,
    mustChangePassword: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: input.createdBy,
  };

  await accountsCollection().doc(payload.id).set(payload);

  return listAccounts();
}

export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
): Promise<AppAccount[]> {
  await ensureSystemAccounts();

  const account = await getAccountById(id);

  if (!account) {
    throw new Error("Nie znaleziono konta.");
  }

  const patch: Partial<AppAccountRecord> = {
    updatedAt: nowIso(),
  };

  if (input.username !== undefined) {
    const username = normalizeUsername(input.username);

    if (!username) {
      throw new Error("Login jest wymagany.");
    }

    const existing = await getAccountByUsername(username);

    if (existing && existing.id !== id) {
      throw new Error("Konto o takim loginie już istnieje.");
    }

    patch.username = username;
  }

  if (input.role !== undefined) {
    if (account.isSystem && input.role !== "admin") {
      throw new Error("Nie można zmienić roli konta systemowego.");
    }

    if (input.role === "admin" && !account.isSystem) {
      throw new Error("Nie można nadać roli admin z panelu.");
    }

    patch.role = input.role;
  }

  if (input.permissions !== undefined) {
    patch.permissions = uniquePermissions(input.permissions);
  }

  if (input.isActive !== undefined) {
    if (account.isSystem && input.isActive === false) {
      throw new Error("Nie można dezaktywować konta systemowego.");
    }

    patch.isActive = input.isActive;
  }

  await accountsCollection().doc(id).set(patch, { merge: true });

  return listAccounts();
}

export async function changeAccountPassword(
  id: string,
  newPassword: string,
): Promise<AppAccount[]> {
  await ensureSystemAccounts();

  const account = await getAccountById(id);

  if (!account) {
    throw new Error("Nie znaleziono konta.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Hasło musi mieć minimum 6 znaków.");
  }

  await accountsCollection()
    .doc(id)
    .set(
      {
        passwordHash: hashPassword(newPassword),
        passwordChangedAt: nowIso(),
        updatedAt: nowIso(),
        mustChangePassword: false,
      },
      { merge: true },
    );

  return listAccounts();
}

export async function deleteAccount(id: string): Promise<AppAccount[]> {
  await ensureSystemAccounts();

  const account = await getAccountById(id);

  if (!account) {
    throw new Error("Nie znaleziono konta.");
  }

  if (account.isSystem) {
    throw new Error("Nie można usunąć konta systemowego.");
  }

  await accountsCollection().doc(id).delete();

  return listAccounts();
}
