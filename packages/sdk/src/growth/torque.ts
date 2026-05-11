import { wrapExternalError } from "../errors.js";
import { ArcPaySdkError } from "../errors.js";
import { assertNonEmptyString, assertSolanaAddress, assertUrl } from "../validation.js";
import type { TorqueClient } from "../types.js";

export const DEFAULT_TORQUE_EVENT_API_URL = "https://ingest.torque.so/events";

export type TorqueCustomEventValue = string | number | boolean | null;

export interface TorqueCustomEventClientOptions {
  readonly apiKey: string;
  readonly eventApiUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface TorqueCustomEventParams {
  readonly eventName: string;
  readonly userPubkey: string;
  readonly timestamp?: number | string;
  readonly data?: Readonly<Record<string, TorqueCustomEventValue>>;
}

export interface TorqueCustomEventResult {
  readonly liveProof: true;
  readonly eventName: string;
  readonly userPubkey: string;
  readonly timestamp: number | string;
  readonly response: unknown;
}

export interface RegisterReferralParams {
  readonly campaignId: string;
  readonly referrerWallet: string;
  readonly newCustomerWallet: string;
}

export interface TrackLeaderboardParams {
  readonly campaignId: string;
  readonly limit?: number;
}

/**
 * Creates a minimal Torque custom-event client using the official MCP ingester
 * shape: POST /events with an x-api-key header.
 */
export function createTorqueCustomEventClient(
  options: TorqueCustomEventClientOptions,
): {
  readonly sendCustomEvent: (
    params: TorqueCustomEventParams,
  ) => Promise<TorqueCustomEventResult>;
} {
  const apiKey = assertNonEmptyString(options.apiKey, "apiKey");
  const eventApiUrl = assertUrl(options.eventApiUrl ?? DEFAULT_TORQUE_EVENT_API_URL, "eventApiUrl");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async sendCustomEvent(params) {
      const eventName = assertNonEmptyString(params.eventName, "eventName");
      const userPubkey = assertSolanaAddress(params.userPubkey, "userPubkey");
      const timestamp = params.timestamp ?? Date.now();
      const data = validateCustomEventData(params.data);

      try {
        const response = await fetchImpl(eventApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            timestamp,
            userPubkey,
            eventName,
            data,
          }),
        });

        const body = await readResponseBody(response);

        if (!response.ok) {
          throw new ArcPaySdkError(
            "EXTERNAL_SERVICE_ERROR",
            `Torque custom event API returned HTTP ${response.status}.`,
            body,
          );
        }

        return {
          liveProof: true,
          eventName,
          userPubkey,
          timestamp,
          response: body,
        };
      } catch (cause) {
        if (cause instanceof ArcPaySdkError) {
          throw cause;
        }

        throw wrapExternalError("Torque", "custom event submission", cause);
      }
    },
  };
}

/**
 * Registers a Torque fee-rebate referral.
 */
export async function registerReferral(
  torque: TorqueClient,
  params: RegisterReferralParams,
): Promise<unknown> {
  const campaignId = assertNonEmptyString(params.campaignId, "campaignId");
  const referrerWallet = assertNonEmptyString(params.referrerWallet, "referrerWallet");
  const newCustomerWallet = assertNonEmptyString(params.newCustomerWallet, "newCustomerWallet");

  try {
    const campaign = await torque.campaigns.get(campaignId);

    return await torque.referrals.create({
      campaignId: campaign.id,
      referrer: referrerWallet,
      referee: newCustomerWallet,
      reward: {
        type: "FEE_REBATE",
        percent: 20,
      },
    });
  } catch (cause) {
    throw wrapExternalError("Torque", "referral registration", cause);
  }
}

/**
 * Fetches the public Torque leaderboard for ArcPay treasury volume.
 */
export async function trackLeaderboard(
  torque: TorqueClient,
  params: TrackLeaderboardParams,
): Promise<unknown> {
  const campaignId = assertNonEmptyString(params.campaignId, "campaignId");

  try {
    return await torque.leaderboard.get({
      campaignId,
      metric: "treasury_volume",
      limit: params.limit ?? 10,
    });
  } catch (cause) {
    throw wrapExternalError("Torque", "leaderboard fetch", cause);
  }
}

function validateCustomEventData(
  data: Readonly<Record<string, TorqueCustomEventValue>> | undefined,
): Readonly<Record<string, TorqueCustomEventValue>> {
  if (!data) {
    return {};
  }

  for (const [key, value] of Object.entries(data)) {
    assertNonEmptyString(key, "event data key");

    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new ArcPaySdkError(
        "VALIDATION_ERROR",
        `Torque custom event data field ${key} must be a string, number, boolean, or null.`,
      );
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new ArcPaySdkError(
        "VALIDATION_ERROR",
        `Torque custom event data field ${key} must be a finite number.`,
      );
    }
  }

  return data;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
