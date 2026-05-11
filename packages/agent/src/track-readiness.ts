import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

export type TrackReadinessStatus = "ready" | "needs_funds" | "missing_env" | "waiting_external";

export interface TrackReadinessCheck {
  readonly track: string;
  readonly status: TrackReadinessStatus;
  readonly requiredEnv: readonly string[];
  readonly optionalEnv?: readonly string[];
  readonly missingEnv: readonly string[];
  readonly expectedEmptyWalletResult: string;
  readonly nextAction: string;
}

interface TrackDefinition {
  readonly track: string;
  readonly requiredEnv: readonly string[];
  readonly optionalEnv?: readonly string[];
  readonly fundedProof: boolean;
  readonly completedProofEnv?: string;
  readonly completedProofNextAction?: string;
  readonly externalBlock?: string;
  readonly expectedEmptyWalletResult: string;
  readonly nextActionReady: string;
  readonly nextActionMissing: string;
}

const TRACKS: readonly TrackDefinition[] = [
  {
    track: "Solana Program",
    requiredEnv: ["QUICKNODE_RPC_URL", "ARCPAY_PROGRAM_ID", "ARCPAY_SIGNER_KEYPAIR_PATH"],
    fundedProof: true,
    expectedEmptyWalletResult: "Program reads work; submitted token payment can fail with insufficient funds or missing token account.",
    nextActionReady: "Run devnet/mainnet program proof commands; fund wallet only for value-moving token proof.",
    nextActionMissing: "Set RPC, program ID, and local signer keypair path.",
  },
  {
    track: "QuickNode",
    requiredEnv: ["QUICKNODE_RPC_URL", "QUICKNODE_WEBHOOK_SECRET"],
    fundedProof: false,
    expectedEmptyWalletResult: "RPC can work immediately; webhook remains pending until a watched transaction occurs.",
    nextActionReady: "Start server and trigger a small transfer or wait for a watched wallet event.",
    nextActionMissing: "Create a QuickNode Solana endpoint and webhook Security Token.",
  },
  {
    track: "x402 / MagicBlock",
    requiredEnv: [
      "QUICKNODE_RPC_URL",
      "ARCPAY_PAYMENT_MODE",
      "AGENT_WALLET_ADDRESS",
      "USDC_MINT_ADDRESS",
    ],
    optionalEnv: [
      "ARCPAY_PROGRAM_ID",
      "AUDD_MINT_ADDRESS",
      "MAGICBLOCK_PRIVATE_PAYMENTS_API_URL",
      "MAGICBLOCK_PAYMENT_OWNER_ADDRESS",
      "MAGICBLOCK_PAYMENT_MINT_ADDRESS",
      "MAGICBLOCK_CLUSTER",
      "MAGICBLOCK_PAYMENT_AMOUNT",
    ],
    fundedProof: true,
    expectedEmptyWalletResult: "Protected route returns 402; MagicBlock Private Payments builder can return unsigned tx or minimum/funding error.",
    nextActionReady: "Run `proof:magicblock` for the sponsor Private Payments API surface, then run funded x402 payment proof.",
    nextActionMissing: "Set payment mode, RPC, receiving wallet, token mint env values, and MagicBlock Private Payments API values.",
  },
  {
    track: "Torque",
    requiredEnv: ["TORQUE_API_KEY", "TORQUE_EVENT_API_URL", "TORQUE_USER_PUBKEY", "TORQUE_AGENT_ID"],
    optionalEnv: ["TORQUE_PAYMENT_TX_SIGNATURE"],
    fundedProof: false,
    expectedEmptyWalletResult: "Custom events can be accepted without wallet funds if event definitions exist.",
    nextActionReady: "Run `npm run proof:torque -w @arcpay/agent` after event definitions exist.",
    nextActionMissing: "Create a Torque Event API key and configure custom event values.",
  },
  {
    track: "Birdeye",
    requiredEnv: ["BIRDEYE_API_KEY", "BIRDEYE_PRICE_MINT_ADDRESS"],
    fundedProof: false,
    expectedEmptyWalletResult: "Read-only price API should succeed without wallet funds.",
    nextActionReady: "Run partner smoke with live Birdeye enabled.",
    nextActionMissing: "Create a Birdeye API key and set the price mint.",
  },
  {
    track: "GoldRush",
    requiredEnv: ["GOLDRUSH_API_KEY", "GOLDRUSH_SCORE_WALLET"],
    fundedProof: false,
    expectedEmptyWalletResult: "Read-only balances/history API should succeed without wallet funds.",
    nextActionReady: "Run partner smoke with live GoldRush enabled.",
    nextActionMissing: "Create a GoldRush API key and set the wallet to score.",
  },
  {
    track: "DFlow",
    requiredEnv: ["DFLOW_API_BASE_URL", "DFLOW_INPUT_MINT_ADDRESS", "DFLOW_OUTPUT_MINT_ADDRESS", "DFLOW_QUOTE_AMOUNT", "ARCPAY_SIGNER_KEYPAIR_PATH"],
    optionalEnv: ["DFLOW_API_KEY", "ARCPAY_DFLOW_SUBMIT"],
    fundedProof: true,
    expectedEmptyWalletResult: "Quote/signable order can pass; submission should fail with insufficient funds until wallet is funded.",
    nextActionReady: "Run `proof:dflow` with submit false now; switch `ARCPAY_DFLOW_SUBMIT=true` after funding.",
    nextActionMissing: "Set DFlow base URL, route mints, quote amount, and local signer path.",
  },
  {
    track: "Zerion",
    requiredEnv: ["ZERION_API_KEY"],
    optionalEnv: ["ZERION_CLI_VERSION"],
    fundedProof: true,
    expectedEmptyWalletResult: "Quote route should reach Zerion and return insufficient funds or no route until funded.",
    nextActionReady: "Install `zerion-cli@1.1.0`, then run read/quote proof and final funded route later.",
    nextActionMissing: "Create a Zerion API key and set `ZERION_API_KEY`.",
  },
  {
    track: "Kamino",
    requiredEnv: ["QUICKNODE_RPC_URL", "AGENT_WALLET_ADDRESS", "KAMINO_MARKET_ADDRESS", "KAMINO_USDC_RESERVE_ADDRESS", "KAMINO_DEPOSIT_AMOUNT"],
    fundedProof: true,
    expectedEmptyWalletResult: "Unsigned builder can pass; submitted deposit should fail with insufficient funds until wallet is funded.",
    nextActionReady: "Run `smoke:kamino`; submit only after wallet funding.",
    nextActionMissing: "Set Kamino market, reserve, amount, wallet, and RPC env values.",
  },
  {
    track: "LP Agent",
    requiredEnv: ["LP_AGENT_API_KEY", "LP_AGENT_API_BASE_URL", "LP_AGENT_ZAP_IN_POOL_ID", "LP_AGENT_ZAP_IN_WALLET_ADDRESS", "LP_AGENT_ZAP_IN_INPUT_SOL"],
    optionalEnv: ["LP_AGENT_ZAP_IN_PERCENT_X", "LP_AGENT_ZAP_IN_SLIPPAGE_BPS"],
    fundedProof: true,
    expectedEmptyWalletResult: "Zap-In builder should return unsigned tx, minimum amount, no pool, or insufficient funds before any submit.",
    nextActionReady: "Run LP Agent Zap-In smoke; sign/submit only after wallet funding.",
    nextActionMissing: "Fill LP Agent Zap-In pool, wallet, and input amount env values.",
  },
  {
    track: "QVAC",
    requiredEnv: ["ARCPAY_REQUIRE_LIVE_QVAC", "QVAC_SDK_PATH", "QVAC_LINUX_HOST_CONFIRMED"],
    optionalEnv: ["QVAC_MODEL_SRC", "QVAC_MODEL_CONFIG_JSON"],
    fundedProof: false,
    expectedEmptyWalletResult: "No wallet funds needed; proof should return a local model decision.",
    nextActionReady: "Run `proof:qvac` on native Linux x64; do not use WSL for the final QVAC proof.",
    nextActionMissing: "Install `@qvac/sdk` on native Linux x64, set QVAC_SDK_PATH, and set QVAC_LINUX_HOST_CONFIRMED=true after verifying the host is not WSL.",
  },
  {
    track: "Umbra",
    requiredEnv: ["UMBRA_NETWORK", "UMBRA_INDEXER_API_ENDPOINT", "ARCPAY_SIGNER_KEYPAIR_PATH"],
    fundedProof: true,
    expectedEmptyWalletResult: "Shield flow should fail with missing funds, unsupported pool, or minimum amount until funded/configured.",
    nextActionReady: "Run live Umbra flow after SDK/network/funds are confirmed.",
    nextActionMissing: "Set Umbra network/indexer and signer path.",
  },
  {
    track: "Cloak",
    requiredEnv: ["CLOAK_NETWORK", "CLOAK_RELAY_URL", "CLOAK_PROGRAM_ID", "CLOAK_MOCK_USDC_MINT", "ARCPAY_SIGNER_KEYPAIR_PATH"],
    optionalEnv: ["CLOAK_API_KEY", "CLOAK_VIEWING_KEY", "CLOAK_DEVNET_PROOF_SIGNATURE"],
    fundedProof: true,
    completedProofEnv: "CLOAK_DEVNET_PROOF_SIGNATURE",
    completedProofNextAction: "Cloak devnet SOL deposit proof is recorded; next proof is mainnet/private payroll or viewing-key audit.",
    expectedEmptyWalletResult: "Without faucet funds, devnet deposit/payroll should fail with insufficient SOL or mock USDC.",
    nextActionReady: "Run Cloak devnet proof with `@cloak.dev/sdk-devnet`; faucet devnet SOL/mock USDC before final proof.",
    nextActionMissing: "Set Cloak devnet relay, program, mock USDC mint, and signer path.",
  },
  {
    track: "Encrypt / Ika",
    requiredEnv: ["IKA_SOLANA_RPC_URL", "IKA_GRPC_ENDPOINT", "IKA_PROGRAM_ID", "ARCPAY_SIGNER_KEYPAIR_PATH"],
    optionalEnv: [
      "IKA_DWALLET_ADDRESS",
      "IKA_APPROVE_SPEND_USD",
      "IKA_APPROVE_MAX_SPEND_USD",
      "IKA_APPROVE_EXPIRY_SECONDS",
      "IKA_APPROVE_SUBMIT",
      "IKA_APPROVE_TX_SIGNATURE",
      "IKA_MESSAGE_APPROVAL_ADDRESS",
      "ENCRYPT_GRPC_ENDPOINT",
      "ENCRYPT_SOLANA_RPC_URL",
      "ENCRYPT_PROGRAM_ID",
    ],
    fundedProof: true,
    completedProofEnv: "IKA_APPROVE_TX_SIGNATURE",
    completedProofNextAction: "Ika pre-alpha dWallet creation and policy-gated ApproveMessage transaction are recorded; keep pre-alpha/no production MPC caveat in the demo.",
    expectedEmptyWalletResult: "Ika pre-alpha RPC/program can be reached; dWallet signing can fail with missing funds or missing dWallet state until configured.",
    nextActionReady: "Run `proof:ika:create-dwallet`, set IKA_DWALLET_ADDRESS, then run `proof:ika:approve` for the policy-gated dWallet approval proof.",
    nextActionMissing: "Set Ika pre-alpha RPC, gRPC endpoint, program ID, and local signer keypair path.",
  },
  {
    track: "AUDD",
    requiredEnv: ["AUDD_MINT_ADDRESS"],
    fundedProof: true,
    expectedEmptyWalletResult: "AUDD route/payment can fail with missing balance/liquidity until funded.",
    nextActionReady: "Use AUDD mint in x402 or swap proof after wallet funding/liquidity confirmation.",
    nextActionMissing: "Set verified AUDD mint address.",
  },
  {
    track: "PUSD",
    requiredEnv: ["PUSD_MINT_ADDRESS", "PUSD_RPC_URL", "PUSD_API_BASE_URL"],
    optionalEnv: ["PUSD_EXPECTED_DECIMALS"],
    fundedProof: true,
    expectedEmptyWalletResult: "PUSD read-only proof should pass; receive/pay proof can fail with missing PUSD balance until funded.",
    nextActionReady: "Run `proof:pusd`; final track proof needs a real PUSD receive/pay transaction or accepted mainnet payment flow.",
    nextActionMissing: "Set official Palm USD Solana mint, Palm API base URL, and mainnet RPC URL.",
  },
  {
    track: "Eitherway / Public App",
    requiredEnv: ["NEXT_PUBLIC_ARCPAY_SERVER_URL", "NEXT_PUBLIC_QUICKNODE_RPC_URL"],
    fundedProof: true,
    expectedEmptyWalletResult: "Dashboard should load and show wallet/RPC state; mainnet actions can show insufficient funds.",
    nextActionReady: "Move to frontend polish, responsive screenshots, and public deployment.",
    nextActionMissing: "Set public frontend RPC/server URLs before final dashboard proof.",
  },
];

export function runTrackReadiness(source: NodeJS.ProcessEnv = process.env): readonly TrackReadinessCheck[] {
  return TRACKS.map((track) => {
    const missingEnv = track.requiredEnv.filter((key) => !hasEnvValue(source, key));
    const signerMissing =
      track.requiredEnv.includes("ARCPAY_SIGNER_KEYPAIR_PATH") &&
      hasEnvValue(source, "ARCPAY_SIGNER_KEYPAIR_PATH") &&
      !existsSync(expandHome(source.ARCPAY_SIGNER_KEYPAIR_PATH!.trim()));
    const effectiveMissing = signerMissing ? [...missingEnv, "ARCPAY_SIGNER_KEYPAIR_PATH(file missing)"] : missingEnv;

    if (track.externalBlock && effectiveMissing.length > 0) {
      return toCheck(track, "waiting_external", effectiveMissing, `${track.externalBlock} ${track.nextActionMissing}`);
    }

    if (track.externalBlock) {
      return toCheck(track, "waiting_external", effectiveMissing, track.externalBlock);
    }

    if (effectiveMissing.length > 0) {
      return toCheck(track, "missing_env", effectiveMissing, track.nextActionMissing);
    }

    if (track.completedProofEnv && hasEnvValue(source, track.completedProofEnv)) {
      return toCheck(
        track,
        "ready",
        [],
        track.completedProofNextAction ?? track.nextActionReady,
      );
    }

    return toCheck(
      track,
      track.fundedProof ? "needs_funds" : "ready",
      [],
      track.nextActionReady,
    );
  });
}

export function loadReadinessEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  envPath?: string,
): NodeJS.ProcessEnv {
  return loadEnvFile(source, envPath);
}

function toCheck(
  track: TrackDefinition,
  status: TrackReadinessStatus,
  missingEnv: readonly string[],
  nextAction: string,
): TrackReadinessCheck {
  return {
    track: track.track,
    status,
    requiredEnv: track.requiredEnv,
    optionalEnv: track.optionalEnv,
    missingEnv,
    expectedEmptyWalletResult: track.expectedEmptyWalletResult,
    nextAction,
  };
}

function hasEnvValue(source: NodeJS.ProcessEnv, key: string): boolean {
  const value = source[key]?.trim();
  return value !== undefined && value.length > 0 && !isPlaceholder(value);
}

function isPlaceholder(value: string): boolean {
  return (
    value.includes("xxxxxxxx") ||
    value.includes("YourSolanaPublicKeyHere") ||
    value.includes("PUSDMintAddressOnSolana") ||
    value === "change_this_shared_secret" ||
    value === "[64,byte,array,here]"
  );
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  }

  return resolve(path);
}

if (
  process.argv[1] !== undefined &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  const checks = runTrackReadiness(loadReadinessEnvironment());

  for (const check of checks) {
    console.log(`${check.status.toUpperCase()} ${check.track}: ${check.nextAction}`);
    if (check.missingEnv.length > 0) {
      console.log(`  Missing: ${check.missingEnv.join(", ")}`);
    }
    console.log(`  Empty wallet: ${check.expectedEmptyWalletResult}`);
  }

  const hardFailures = checks.filter((check) => check.status === "missing_env");
  if (hardFailures.length > 0) {
    process.exitCode = 1;
  }
}
