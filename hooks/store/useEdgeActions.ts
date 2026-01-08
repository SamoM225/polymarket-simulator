"use client";

import { useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { EDGE_MARKET_WRITE } from "../../lib/config";
import { MarketStoreState } from "../../lib/types";

type EdgeAction = "place_bet" | "close_position" | "simulation_tick";

/**
 * Hook pre sledovanie aktuálneho stavu používateľa
 */
export function useUserStateRef(user: MarketStoreState["user"]) {
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  return userRef;
}

/**
 * Volá Supabase Edge funkciu pre zápis do databázy.
 * Spracováva stavky, zatváranie pozícií a simulačné ticky.
 */
export async function sendEdgeAction(
  action: EdgeAction,
  payload: Record<string, unknown>,
  userRef: React.MutableRefObject<MarketStoreState["user"]>,
): Promise<boolean> {
  const currentUser = userRef.current;

  if (!supabase) {
    return false;
  }

  if (!currentUser.authenticated) {
    return false;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token || !currentUser.id) {
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke(EDGE_MARKET_WRITE, {
      body: { action, payload: { ...payload, userId: currentUser.id } },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

