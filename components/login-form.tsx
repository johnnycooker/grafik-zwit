"use client";

import { useState } from "react";
import { LogIn, Shield, UserCircle2 } from "lucide-react";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    if (!result) {
      setError("Nie udało się zalogować.");
      setLoading(false);
      return;
    }

    if (result.error) {
      setError("Nieprawidłowy login lub hasło.");
      setLoading(false);
      return;
    }

    window.location.href = result.url || "/";
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_40px_160px_rgba(0,0,0,0.55)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden border-r border-white/10 p-10 lg:block">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Auth.js + Credentials
            </div>

            <h1 className="text-4xl font-semibold tracking-tight">
              Grafik pracy
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
              Zaloguj się, aby przejść do podglądu grafiku, edycji zmian i
              zarządzania użytkownikami. Konta pracowników i koordynatorów są
              obsługiwane indywidualnie przez Firestore.
            </p>

            <div className="mt-10 grid gap-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="text-lg font-semibold">Role i uprawnienia</div>
                <div className="mt-1 text-sm text-zinc-400">
                  Sesja przenosi role i permissiony, więc każdy użytkownik widzi
                  tylko to, do czego ma dostęp.
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                  <UserCircle2 className="h-4 w-4" />
                </div>
                <div className="text-lg font-semibold">Indywidualne konta</div>
                <div className="mt-1 text-sm text-zinc-400">
                  Pracownicy i koordynatorzy logują się własnymi danymi, a konto
                  systemowe admina służy do zarządzania dostępami.
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                  Panel logowania
                </div>

                <h2 className="text-3xl font-semibold tracking-tight">
                  Zaloguj się
                </h2>

                <p className="mt-2 text-sm text-zinc-400">
                  Podaj login i hasło swojego konta.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-zinc-300">
                    Login
                  </div>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                    placeholder="Wpisz login"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-zinc-300">
                    Hasło
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                    placeholder="Wpisz hasło"
                  />
                </label>

                {error ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  {loading ? "Logowanie..." : "Zaloguj"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
