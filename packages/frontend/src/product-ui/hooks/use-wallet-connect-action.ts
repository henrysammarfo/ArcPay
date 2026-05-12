"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useState } from "react";

type WalletConnectAction = {
  readonly connectWallet: () => Promise<void>;
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly errorMessage: string | null;
  readonly label: string;
  readonly publicKeyBase58: string | null;
  readonly selectedWalletName: string | null;
};

export function useWalletConnectAction(): WalletConnectAction {
  const { connect, connected, connecting, publicKey, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const publicKeyBase58 = publicKey?.toBase58() ?? null;
  const selectedWalletName = wallet?.adapter.name ?? null;

  const connectWallet = useCallback(async () => {
    if (connected) {
      setErrorMessage(null);
      setVisible(true);
      return;
    }

    if (!wallet) {
      setErrorMessage(null);
      setVisible(true);
      return;
    }

    try {
      setErrorMessage(null);
      await connect();
    } catch (error) {
      const message = getWalletErrorMessage(error, selectedWalletName);
      setErrorMessage(message);
      console.warn("Solana wallet connection failed.", message);
    }
  }, [connect, connected, selectedWalletName, setVisible, wallet]);

  const label = connected && publicKeyBase58
    ? short(publicKeyBase58)
    : connecting
      ? "Connecting..."
      : selectedWalletName
        ? `Approve ${selectedWalletName}`
        : "Connect";

  return {
    connectWallet,
    connected,
    connecting,
    errorMessage,
    label,
    publicKeyBase58,
    selectedWalletName,
  };
}

function short(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getWalletErrorMessage(error: unknown, walletName: string | null) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const normalized = rawMessage.trim();

  if (!normalized || normalized === "Unexpected error") {
    return `${walletName ?? "Wallet"} rejected the connection or the extension did not open. Unlock the extension, remove localhost from connected sites, then try again.`;
  }

  return normalized;
}
