"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TokenResponse, User } from "@/types";
import { api } from "@/lib/api";
import { tokenStore } from "./token-store";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** 로그인해 있던 세션이 끝났다(토큰 만료 등) — '로그인이 풀렸어요' 안내용. 다시 로그인하거나 로그아웃하면 false */
  sessionEnded: boolean;
  login(email: string, password: string): Promise<void>;
  /** 소셜 로그인이 받아 온 토큰을 입양 — 저장하고 내 정보를 불러 authenticated 로 */
  adoptTokens(tokens: TokenResponse): Promise<void>;
  logout(): Promise<void>;
  /** 세션을 다시 확인한다. 로그인 중에 API 가 AUTH_REQUIRED 를 주면 부른다 — 토큰이 없거나 안 맞으면 세션 끝 */
  recheckSession(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionEnded, setSessionEnded] = useState(false);

  const endSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
    setSessionEnded(true);
  }, []);

  const recheckSession = useCallback(async () => {
    if (!tokenStore.getAccessToken()) {
      endSession();
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
      setStatus("authenticated");
    } catch {
      endSession();
    }
  }, [endSession]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      if (!tokenStore.getAccessToken()) {
        if (active) setStatus("anonymous");
        return;
      }
      try {
        const me = await api.getMe();
        if (active) {
          setUser(me);
          setStatus("authenticated");
        }
      } catch {
        // 저장된 토큰이 있었는데 안 맞는다 = 지난 로그인이 풀렸다
        if (active) endSession();
        else tokenStore.clear();
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [endSession]);

  const adoptTokens = useCallback(async (tokens: TokenResponse) => {
    tokenStore.save(tokens);
    const me = await api.getMe();
    setUser(me);
    setStatus("authenticated");
    setSessionEnded(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await adoptTokens(await api.login({ email, password }));
    },
    [adoptTokens],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
    setSessionEnded(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionEnded, login, adoptTokens, logout, recheckSession }),
    [user, status, sessionEnded, login, adoptTokens, logout, recheckSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
