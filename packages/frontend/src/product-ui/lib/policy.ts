"use client";

import { readLocalJson, writeLocalJson } from "@/lib/browser-cache";

export const POLICY_STORAGE_KEY = "arcpay-policy-settings";
export const WORKSPACE_SETTINGS_STORAGE_KEY = "arcpay-workspace-settings";

export type PolicySettings = {
  allowlist: string[];
  blocked: string[];
  daily: number;
  minScore: number;
  networks: string[];
  paused: boolean;
  perTx: number;
  requireApproval: number;
  tokens: string[];
};

export type WorkspaceSettingsSnapshot = {
  requireWalletForActions: boolean;
  emailNotifications: boolean;
  riskAlerts: boolean;
  autoYieldSweeps: boolean;
  defaultNetwork: "devnet" | "mainnet";
};

export const DEFAULT_POLICY_SETTINGS: PolicySettings = {
  allowlist: [],
  blocked: [],
  daily: 0,
  minScore: 60,
  networks: ["Devnet", "Mainnet"],
  paused: false,
  perTx: 0,
  requireApproval: 0,
  tokens: ["USDC", "AUDD", "PUSD", "SOL"],
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettingsSnapshot = {
  requireWalletForActions: true,
  emailNotifications: true,
  riskAlerts: true,
  autoYieldSweeps: false,
  defaultNetwork: "devnet",
};

export function parsePolicySettings(value: unknown): PolicySettings | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<PolicySettings>;

  return {
    allowlist: Array.isArray(raw.allowlist) ? raw.allowlist.map(String) : DEFAULT_POLICY_SETTINGS.allowlist,
    blocked: Array.isArray(raw.blocked) ? raw.blocked.map(String) : DEFAULT_POLICY_SETTINGS.blocked,
    daily: Number.isFinite(raw.daily) ? Number(raw.daily) : DEFAULT_POLICY_SETTINGS.daily,
    minScore: Number.isFinite(raw.minScore) ? Number(raw.minScore) : DEFAULT_POLICY_SETTINGS.minScore,
    networks: Array.isArray(raw.networks) ? raw.networks.map(String) : DEFAULT_POLICY_SETTINGS.networks,
    paused: Boolean(raw.paused),
    perTx: Number.isFinite(raw.perTx) ? Number(raw.perTx) : DEFAULT_POLICY_SETTINGS.perTx,
    requireApproval: Number.isFinite(raw.requireApproval)
      ? Number(raw.requireApproval)
      : DEFAULT_POLICY_SETTINGS.requireApproval,
    tokens: Array.isArray(raw.tokens) ? raw.tokens.map(String) : DEFAULT_POLICY_SETTINGS.tokens,
  };
}

export function loadSavedPolicySettings() {
  return parsePolicySettings(readLocalJson(POLICY_STORAGE_KEY, null));
}

export function savePolicySettings(settings: PolicySettings) {
  writeLocalJson(POLICY_STORAGE_KEY, settings);
}

export function loadWorkspaceSettingsSnapshot() {
  const raw = readLocalJson<Partial<WorkspaceSettingsSnapshot> | null>(WORKSPACE_SETTINGS_STORAGE_KEY, null);
  if (!raw || typeof raw !== "object") return DEFAULT_WORKSPACE_SETTINGS;

  return {
    requireWalletForActions:
      typeof raw.requireWalletForActions === "boolean"
        ? raw.requireWalletForActions
        : DEFAULT_WORKSPACE_SETTINGS.requireWalletForActions,
    emailNotifications:
      typeof raw.emailNotifications === "boolean"
        ? raw.emailNotifications
        : DEFAULT_WORKSPACE_SETTINGS.emailNotifications,
    riskAlerts:
      typeof raw.riskAlerts === "boolean"
        ? raw.riskAlerts
        : DEFAULT_WORKSPACE_SETTINGS.riskAlerts,
    autoYieldSweeps:
      typeof raw.autoYieldSweeps === "boolean"
        ? raw.autoYieldSweeps
        : DEFAULT_WORKSPACE_SETTINGS.autoYieldSweeps,
    defaultNetwork:
      raw.defaultNetwork === "devnet" || raw.defaultNetwork === "mainnet"
        ? raw.defaultNetwork
        : DEFAULT_WORKSPACE_SETTINGS.defaultNetwork,
  };
}

export function saveWorkspaceSettingsSnapshot(settings: WorkspaceSettingsSnapshot) {
  writeLocalJson(WORKSPACE_SETTINGS_STORAGE_KEY, settings);
}

type ActionLabel = "Send" | "Swap" | "Yield deposit" | "Yield withdraw" | "Shield" | "Issue viewing key";

type PolicyCheckArgs = {
  action: ActionLabel;
  network: "devnet" | "mainnet";
  amount?: number;
  token?: string;
  walletConnected?: boolean;
  counterpartyWallets?: string[];
  minObservedScore?: number | null;
};

export function checkActionPolicies(args: PolicyCheckArgs): string | null {
  const workspace = loadWorkspaceSettingsSnapshot();
  const policies = loadSavedPolicySettings();

  if (workspace.requireWalletForActions && !args.walletConnected) {
    return "Connect a wallet before running this action.";
  }

  if (!policies) return null;

  if (policies.paused) return "Treasury is paused by policy.";
  if (policies.blocked.includes(args.action)) return `${args.action} is blocked by policy.`;

  const allowedNetworks = policies.networks.map((value) => value.toLowerCase());
  if (allowedNetworks.length > 0 && !allowedNetworks.includes(args.network)) {
    return `${args.network} is not allowed by policy.`;
  }

  if (args.token && policies.tokens.length > 0 && !policies.tokens.includes(args.token)) {
    return `${args.token} is not allowed by policy.`;
  }

  if (typeof args.amount === "number" && args.amount > 0) {
    if (policies.perTx > 0 && args.amount > policies.perTx) {
      return `Amount exceeds per-transaction limit of $${policies.perTx.toLocaleString()}.`;
    }
    if (policies.daily > 0 && args.amount > policies.daily) {
      return `Amount exceeds daily limit of $${policies.daily.toLocaleString()}.`;
    }
    if (policies.requireApproval > 0 && args.amount > policies.requireApproval) {
      return `Amount requires approval because it is above $${policies.requireApproval.toLocaleString()}.`;
    }
  }

  if (Array.isArray(args.counterpartyWallets) && policies.allowlist.length > 0) {
    const blockedWallet = args.counterpartyWallets.find((wallet) => !policies.allowlist.includes(wallet));
    if (blockedWallet) {
      return `Wallet ${blockedWallet} is not in the contractor allowlist.`;
    }
  }

  if (typeof args.minObservedScore === "number" && args.minObservedScore < policies.minScore) {
    return `Minimum score ${args.minObservedScore} is below policy floor ${policies.minScore}.`;
  }

  return null;
}
