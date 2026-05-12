"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNetwork } from "../product-ui/store/network";
import { NetworkModeProvider } from "./network-context";
import "@solana/wallet-adapter-react-ui/styles.css";

type WalletProviderProps = Parameters<typeof WalletProvider>[0];
type WalletAdapter = NonNullable<WalletProviderProps["wallets"]>[number];
type PersistState = {
  hasHydrated?: () => boolean;
  onFinishHydration?: (callback: () => void) => () => void;
};

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <NetworkModeProvider>
      <WalletConnectionProvider>{children}</WalletConnectionProvider>
    </NetworkModeProvider>
  );
}

function WalletConnectionProvider({ children }: { readonly children: ReactNode }) {
  const persist = (useNetwork as typeof useNetwork & { persist?: PersistState }).persist;
  const network = useNetwork((state) => state.mode);
  const [hydrated, setHydrated] = useState(() => persist?.hasHydrated?.() ?? true);
  const endpoint =
    network === "mainnet"
      ? process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com"
      : process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL ?? "https://api.devnet.solana.com";
  const wallets = useMemo(
    () => [new SolflareWalletAdapter(), new PhantomWalletAdapter()] satisfies WalletAdapter[],
    [],
  );
  const handleWalletError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.warn("Solana wallet connection failed.", message);
  }, []);

  useEffect(() => {
    if (!persist) {
      setHydrated(true);
      return;
    }

    if (persist.hasHydrated?.()) {
      setHydrated(true);
      return;
    }

    const unsubscribe = persist.onFinishHydration?.(() => setHydrated(true));
    return () => unsubscribe?.();
  }, [persist]);

  if (!hydrated) {
    return null;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={handleWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
