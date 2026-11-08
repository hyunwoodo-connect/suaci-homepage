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

/** 로그인 상태. 저장된 토큰을 확인하는 동안은 `loading` 이라 로그인 화면으로 보내지 않는다 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** `useAuth` 가 돌려주는 값 — 지금 로그인한 사람과 로그인·로그아웃 동작 */
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

/** `[locale]` 화면 전체에 로그인 상태를 나눠 준다. 붙을 때 저장된 토큰으로 세션을 되살린다 */
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
      const tokens = await api.login({ email, password });
      await adoptTokens(tokens);
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

/** 로그인 상태와 동작을 읽는다. `AuthProvider` 밖에서 부르면 던진다 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
