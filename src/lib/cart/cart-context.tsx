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
import type { AddToCartRequest, Cart } from "@/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";

export interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  loading: boolean;
  refresh(): Promise<void>;
  add(r: AddToCartRequest): Promise<void>;
  setQty(variantId: string, qty: number): Promise<void>;
  remove(variantId: string): Promise<void>;
  clear(): Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      setCart(await api.getCart());
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(async (r: AddToCartRequest) => {
    setCart(await api.addToCart(r));
  }, []);

  const setQty = useCallback(async (variantId: string, qty: number) => {
    setCart(await api.updateCartItem(variantId, qty));
  }, []);

  const remove = useCallback(async (variantId: string) => {
    setCart(await api.removeCartItem(variantId));
  }, []);

  const clear = useCallback(async () => {
    setCart(await api.clearCart());
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart?.totals.itemCount ?? 0,
      loading,
      refresh,
      add,
      setQty,
      remove,
      clear,
    }),
    [cart, loading, refresh, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
