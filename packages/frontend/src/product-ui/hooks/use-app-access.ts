"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { getOptionalSupabaseClient } from "../../app/supabase-client";

export function useAppAccess() {
  const wallet = useWallet();
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getOptionalSupabaseClient();
    let mounted = true;

    async function loadSession() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSignedIn(Boolean(data.session?.user));
      setLoading(false);
    }

    void loadSession();

    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      setLoading(false);
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const walletConnected = Boolean(wallet.connected && wallet.publicKey);
  const canOpenApp = signedIn;

  return {
    canOpenApp,
    loading,
    openAppPath: canOpenApp ? "/app/dashboard" : "/onboard",
    signedIn,
    walletConnected,
  };
}
