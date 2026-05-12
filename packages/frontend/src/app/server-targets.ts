export type ArcPayRuntimeNetwork = "devnet" | "mainnet";

const DEFAULT_DEVNET_SERVER_URL = "http://20.208.46.195:4030";

export function resolveArcPayServerCandidates(
  network: ArcPayRuntimeNetwork,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const networkSpecific =
    network === "mainnet"
      ? [
          env.ARCPAY_MAINNET_SERVER_URL,
          env.NEXT_PUBLIC_ARCPAY_MAINNET_SERVER_URL,
        ]
      : [
          env.ARCPAY_DEVNET_SERVER_URL,
          env.NEXT_PUBLIC_ARCPAY_DEVNET_SERVER_URL,
        ];

  const shared = [env.ARCPAY_SERVER_URL, env.NEXT_PUBLIC_ARCPAY_SERVER_URL];
  const fallback = network === "devnet" ? [DEFAULT_DEVNET_SERVER_URL] : [];

  return Array.from(
    new Set(
      [...networkSpecific, ...shared, ...fallback]
        .map((value) => value?.trim().replace(/\/+$/, ""))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function resolveArcPayServerUrl(
  network: ArcPayRuntimeNetwork,
  env: Record<string, string | undefined> = process.env,
): string {
  const url = resolveArcPayServerCandidates(network, env)[0];
  if (!url) {
    throw new Error(`No ArcPay backend URL is configured for ${network}.`);
  }

  return url;
}

export function parseRuntimeNetwork(value: string | null | undefined): ArcPayRuntimeNetwork {
  return value === "mainnet" ? "mainnet" : "devnet";
}
