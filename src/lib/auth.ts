export interface AppUser {
  username: string;
  displayName: string;
  role: "admin" | "student";
  createdAt?: string;
}

let _cachedUser: AppUser | null = null;

export async function loginUser(
  username: string,
  password: string
): Promise<{ ok: boolean; user?: AppUser; error?: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Giriş başarısız." };
  _cachedUser = data.user as AppUser;
  return { ok: true, user: _cachedUser };
}

export async function fetchSession(): Promise<AppUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    _cachedUser = data.user ?? null;
    return _cachedUser;
  } catch {
    return null;
  }
}

export function getSession(): AppUser | null {
  return _cachedUser;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  _cachedUser = null;
}

export async function getUsers(): Promise<AppUser[]> {
  const res = await fetch("/api/users");
  if (!res.ok) return [];
  return res.json();
}

export async function createUser(
  username: string,
  displayName: string,
  password: string,
  role: "admin" | "student" = "student"
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", username, displayName, password, role }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error };
  window.dispatchEvent(new CustomEvent("studyexam:users-changed"));
  return { ok: true };
}

export async function deleteUser(username: string): Promise<void> {
  await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", username }),
  });
  window.dispatchEvent(new CustomEvent("studyexam:users-changed"));
}

export async function changePassword(username: string, newPassword: string): Promise<void> {
  await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "changePassword", username, newPassword }),
  });
}

export async function ensureDefaultAdmin(): Promise<void> {
  await fetch("/api/auth/me");
}
