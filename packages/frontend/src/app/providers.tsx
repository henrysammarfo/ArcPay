"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNetwork } from "../product-ui/store/network";
import { NetworkModeProvider } from "./network-context";
import "@solana/wallet-adapter-react-ui/styles.css";

type WalletProviderProps = Parameters<typeof WalletProvider>[0];
type WalletAdapter = NonNullable<WalletProviderProps["wallets"]>[number];

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <NetworkModeProvider>
      <WalletConnectionProvider>{children}</WalletConnectionProvider>
    </NetworkModeProvider>
  );
}

function WalletConnectionProvider({ children }: { readonly children: ReactNode }) {
  const network = useNetwork((state) => state.mode);
  const endpoint =
    network === "mainnet"
      ? process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com"
      : process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL ?? "https://api.devnet.solana.com";
  const [phantomWallet, setPhantomWallet] = useState<WalletAdapter | null>(null);
  const wallets = useMemo(
    () => [new SolflareWalletAdapter(), ...(phantomWallet ? [phantomWallet] : [])],
    [phantomWallet],
  );
  const handleWalletError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.warn("Solana wallet connection failed.", message);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPhantomWallet(): Promise<void> {
      try {
        const { PhantomWalletAdapter } = await import("@solana/wallet-adapter-phantom");

        if (mounted) {
          setPhantomWallet(new PhantomWalletAdapter());
        }
      } catch (error) {
        console.warn("Unable to load Phantom wallet adapter.", error);
      }
    }

    void loadPhantomWallet();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={handleWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
