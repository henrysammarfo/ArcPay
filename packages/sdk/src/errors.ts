/**
 * Stable SDK error codes used across all ArcPay integration adapters.
 */
export type ArcPayErrorCode =
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  | "POLICY_REJECTION"
  | "UNSUPPORTED_OPERATION";

/**
 * Domain error that preserves original causes without leaking secrets.
 */
export class ArcPaySdkError extends Error {
  public readonly code: ArcPayErrorCode;
  public readonly cause?: unknown;

  public constructor(code: ArcPayErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ArcPaySdkError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Wraps unknown third-party failures in a stable ArcPay error.
 */
export function wrapExternalError(
  service: string,
  operation: string,
  cause: unknown,
): ArcPaySdkError {
  return new ArcPaySdkError(
    "EXTERNAL_SERVICE_ERROR",
    `${service} failed during ${operation}.`,
    cause,
  );
}
