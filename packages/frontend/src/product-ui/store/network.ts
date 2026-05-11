import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NetworkMode = "devnet" | "mainnet";

type NetworkState = {
  mode: NetworkMode;
  setMode: (mode: NetworkMode) => void;
};

export const useNetwork = create<NetworkState>()(
  persist(
    (set) => ({
      mode: "devnet",
      setMode: (mode) => set({ mode }),
    }),
    { name: "arcpay-network" },
  ),
);
