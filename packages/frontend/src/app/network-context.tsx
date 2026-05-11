"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ArcPayNetwork = "devnet" | "mainnet";

interface NetworkContextValue {
  readonly network: ArcPayNetwork;
  readonly endpoint: string;
  readonly setNetwork: (network: ArcPayNetwork) => void;
}

const NETWORK_STORAGE_KEY = "arcpay-network-mode-v1";
const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkModeProvider({ children }: { readonly children: ReactNode }) {
  const [network, setNetworkState] = useState<ArcPayNetwork>("devnet");

  useEffect(() => {
    const stored = window.localStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === "devnet" || stored === "mainnet") {
      setNetworkState(stored);
    }
  }, []);

  const value = useMemo<NetworkContextValue>(() => {
    const endpoint =
      network === "mainnet"
        ? process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com"
        : process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL ?? "https://api.devnet.solana.com";

    return {
      network,
      endpoint,
      setNetwork(nextNetwork) {
        setNetworkState(nextNetwork);
        window.localStorage.setItem(NETWORK_STORAGE_KEY, nextNetwork);
      },
    };
  }, [network]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkMode(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (!value) {
    throw new Error("useNetworkMode must be used inside NetworkModeProvider.");
  }

  return value;
}
