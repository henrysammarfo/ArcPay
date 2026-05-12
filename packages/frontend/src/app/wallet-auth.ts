import { createHmac, randomUUID } from "node:crypto";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type ChallengePayload = {
  exp: number;
  iat: number;
  nonce: string;
  walletAddress: string;
};

export function normalizeWalletAddress(value: string) {
  return new PublicKey(value).toBase58();
}

export function createWalletChallenge(walletAddress: string) {
  const normalized = normalizeWalletAddress(walletAddress);
  const iat = Date.now();
  const payload: ChallengePayload = {
    walletAddress: normalized,
    nonce: randomUUID(),
    iat,
    exp: iat + CHALLENGE_TTL_MS,
  };

  return {
    challengeToken: signPayload(payload),
    message: buildWalletAuthMessage(payload),
    walletAddress: normalized,
  };
}

export function parseWalletChallenge(challengeToken: string, walletAddress: string) {
  const normalized = normalizeWalletAddress(walletAddress);
  const payload = readPayload(challengeToken);

  if (payload.walletAddress !== normalized) {
    throw new Error("Wallet challenge does not match the connected address.");
  }

  if (payload.exp < Date.now()) {
    throw new Error("Wallet challenge expired. Request a new wallet sign-in challenge.");
  }

  return payload;
}

export function verifyWalletChallengeSignature({
  challengeToken,
  signature,
  walletAddress,
}: {
  challengeToken: string;
  signature: string;
  walletAddress: string;
}) {
  const payload = parseWalletChallenge(challengeToken, walletAddress);
  const publicKey = new PublicKey(payload.walletAddress).toBytes();
  const signatureBytes = Buffer.from(signature, "base64");
  const messageBytes = new TextEncoder().encode(buildWalletAuthMessage(payload));

  if (!nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey)) {
    throw new Error("Wallet signature verification failed.");
  }

  return payload.walletAddress;
}

export function buildSyntheticWalletEmail(walletAddress: string) {
  const normalized = normalizeWalletAddress(walletAddress);
  return `${normalized}.wallet@arcpay.local`;
}

function buildWalletAuthMessage(payload: ChallengePayload) {
  return [
    "ArcPay wallet sign-in",
    "",
    `Wallet: ${payload.walletAddress}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${new Date(payload.iat).toISOString()}`,
    `Expires At: ${new Date(payload.exp).toISOString()}`,
    "",
    "Sign this message to create or access your ArcPay workspace.",
  ].join("\n");
}

function signPayload(payload: ChallengePayload) {
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getWalletAuthSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readPayload(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new Error("Wallet challenge token is malformed.");
  }

  const expected = createHmac("sha256", getWalletAuthSecret()).update(encoded).digest("base64url");
  if (signature !== expected) {
    throw new Error("Wallet challenge token is invalid.");
  }

  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<ChallengePayload>;
  if (
    typeof parsed.walletAddress !== "string" ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.iat !== "number" ||
    typeof parsed.exp !== "number"
  ) {
    throw new Error("Wallet challenge payload is invalid.");
  }

  return parsed as ChallengePayload;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function getWalletAuthSecret() {
  const secret = process.env.ARCPAY_WALLET_AUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("ARCPAY_WALLET_AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }

  return secret;
}
