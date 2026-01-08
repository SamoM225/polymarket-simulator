"use client";

import { supabase } from "../../lib/supabaseClient";
import { MarketStoreState } from "../../lib/types";

type SetState = React.Dispatch<React.SetStateAction<MarketStoreState>>;

const DEFAULT_PASSWORD = "password";

/**
 * Hook pre login a logout funkcionalitu.
 * Používateľ zadá iba email - účet sa vytvorí automaticky a prihlási sa.
 */
export function useAuth(setState: SetState) {
  
  /**
   * Prihlási používateľa podľa emailu.
   * Ak účet neexistuje, automaticky ho vytvorí s heslom "password".
   */
  const handleLogin = async (email: string): Promise<string | null> => {
    if (!supabase) {
      return "Supabase client nie je k dispozícii";
    }

    setState((s) => ({ ...s, loadingUserState: true }));

    // Skús prihlásiť existujúceho používateľa
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: DEFAULT_PASSWORD,
    });

    // Ak používateľ neexistuje, vytvor ho
    if (error?.message?.includes("Invalid login credentials")) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: DEFAULT_PASSWORD,
      });

      if (signUpError) {
        setState((s) => ({ ...s, loadingUserState: false }));
        return signUpError.message;
      }

      // Po registrácii prihlás
      const result = await supabase.auth.signInWithPassword({
        email,
        password: DEFAULT_PASSWORD,
      });
      data = result.data;
      error = result.error;
    }

    if (error || !data?.user) {
      setState((s) => ({ ...s, loadingUserState: false }));
      return error?.message ?? "Prihlásenie zlyhalo";
    }

    // Načítaj balance z users tabuľky
    const { data: userData } = await supabase
      .from("users")
      .select("balance")
      .eq("id", data.user.id)
      .single();

    setState((s) => ({
      ...s,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        balance: userData?.balance ?? 1000,
        authenticated: true,
      },
      loadingUserState: false,
    }));

    return null;
  };

  const handleLogout = async (): Promise<string | null> => {
    if (!supabase) {
      return "Supabase client nie je k dispozícii";
    }

    setState((s) => ({ ...s, loadingUserState: true }));

    const { error } = await supabase.auth.signOut();
    if (error) {
      setState((s) => ({ ...s, loadingUserState: false }));
      return error.message;
    }

    setState((s) => ({
      ...s,
      user: {
        id: null,
        email: null,
        balance: 0,
        authenticated: false,
      },
      positions: [],
      loadingUserState: false,
      lastActionMessage: "Odhlásený",
    }));

    return null;
  };

  return { handleLogin, handleLogout };
}
