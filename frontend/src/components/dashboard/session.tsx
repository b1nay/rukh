"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import type { User } from "@/lib/types";

type Session = { user: User; logout: () => void };

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Loads the signed-in user, or sends the visitor to /login. */
export function SessionProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api
      .get<User>("/api/v1/auth/me")
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setToken(null);
        router.replace("/login");
      });
  }, [router]);

  const logout = useCallback(() => {
    api.post("/api/v1/auth/logout").catch(() => {});
    setToken(null);
    router.replace("/login");
  }, [router]);

  if (!user) return <>{fallback}</>;
  return <SessionContext.Provider value={{ user, logout }}>{children}</SessionContext.Provider>;
}

/** Fetches a GET endpoint and exposes loading / error / reload. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    api
      .get<T>(path)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading: !data && !error, reload, setData };
}
