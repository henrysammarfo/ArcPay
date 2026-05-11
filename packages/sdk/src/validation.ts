import { ArcPaySdkError } from "./errors.js";

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function assertNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} is required.`);
  }

  return value.trim();
}

export function assertPositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must be a positive number.`);
  }

  return value;
}

export function assertPercentageScore(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new ArcPaySdkError(
      "VALIDATION_ERROR",
      `${fieldName} must be an integer from 0 to 100.`,
    );
  }

  return value;
}

export function assertSolanaAddress(value: string, fieldName: string): string {
  const address = assertNonEmptyString(value, fieldName);

  if (!SOLANA_ADDRESS_PATTERN.test(address)) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must be a Solana address.`);
  }

  return address;
}

export function assertUrl(value: string, fieldName: string): string {
  const url = assertNonEmptyString(value, fieldName);

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported protocol.");
    }
  } catch (cause) {
    throw new ArcPaySdkError("VALIDATION_ERROR", `${fieldName} must be a valid URL.`, cause);
  }

  return url;
}
