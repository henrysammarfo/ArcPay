import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ArcPaySdkError, wrapExternalError } from "../errors.js";
import { assertNonEmptyString, assertPositiveNumber } from "../validation.js";
import type { PendingPayment, QvacClient, TreasuryAction, TreasuryDecision } from "../types.js";

const DEFAULT_QVAC_MODEL_TYPE = "llamacpp-completion";
const DEFAULT_QVAC_MODEL_EXPORTS = ["BITNET_0_7B_INST_TQ2_0", "LLAMA_3_2_1B_INST_Q4_0"] as const;
type QvacModelSource = string | Record<string, unknown>;

type QvacRole = "system" | "user" | "assistant";

interface QvacMessage {
  readonly role: QvacRole;
  readonly content: string;
}

interface QvacSdkLike {
  readonly loadModel: (params: {
    readonly modelSrc: QvacModelSource;
    readonly modelType: string;
    readonly modelConfig?: Record<string, unknown>;
    readonly onProgress?: (progress: unknown) => void;
  }) => Promise<string> | string;
  readonly completion: (params: {
    readonly modelId: string;
    readonly history: readonly QvacMessage[];
    readonly stream?: boolean;
  }) => unknown;
  readonly unloadModel?: (params: { readonly modelId: string }) => Promise<void> | void;
  readonly close?: () => Promise<void> | void;
  readonly [key: string]: unknown;
}

export interface QvacLocalClientOptions {
  readonly modelSrc?: string;
  readonly modelType?: string;
  readonly modelConfig?: Record<string, unknown>;
  readonly onProgress?: (progress: unknown) => void;
  readonly sdkPath?: string;
  readonly sdk?: QvacSdkLike;
  readonly importSdk?: () => Promise<QvacSdkLike>;
}

export interface MakeTreasuryDecisionParams {
  readonly qvac: QvacClient;
  readonly balance: number;
  readonly currentRate: number;
  readonly pendingPayments: readonly PendingPayment[];
  readonly kaminoAPY: number;
}

/**
 * Uses a local QVAC-compatible reasoning client to choose the next treasury action.
 */
export async function makeTreasuryDecision(
  params: MakeTreasuryDecisionParams,
): Promise<TreasuryDecision> {
  const balance = assertPositiveNumber(params.balance, "balance");
  const currentRate = assertPositiveNumber(params.currentRate, "currentRate");

  if (!Number.isFinite(params.kaminoAPY) || params.kaminoAPY < 0) {
    throw new ArcPaySdkError("VALIDATION_ERROR", "kaminoAPY must be zero or greater.");
  }

  try {
    return await params.qvac.reason({
      context: `Agent treasury: ${balance} USDC. AUDD/USDC rate: ${currentRate}.`,
      context2: `Kamino APY: ${params.kaminoAPY}%. Pending payments: ${JSON.stringify(params.pendingPayments)}`,
      question:
        "Should I convert AUDD to USDC now, keep yielding in Kamino, or execute pending payments?",
      options: ["CONVERT_NOW", "KEEP_YIELDING", "EXECUTE_PAYMENTS", "WAIT"],
    });
  } catch (cause) {
    throw wrapExternalError("QVAC", "treasury decision", cause);
  }
}

/**
 * Creates a live QVAC client backed by the official local SDK.
 *
 * The package is loaded dynamically so normal ArcPay builds do not require a
 * QVAC runtime unless the QVAC proof path is explicitly executed.
 */
export function createQvacLocalClient(options: QvacLocalClientOptions = {}): QvacClient {
  const modelType = options.modelType ?? DEFAULT_QVAC_MODEL_TYPE;
  const loadSdk = options.sdk
    ? async () => options.sdk as QvacSdkLike
    : options.importSdk ?? (() => importQvacSdk(options.sdkPath));

  return {
    async reason(params) {
      const sdk = await loadSdk();
      const modelSrc = resolveModelSrc(sdk, options.modelSrc);
      const modelId = await sdk.loadModel({
        modelSrc,
        modelType,
        modelConfig: options.modelConfig,
        onProgress: options.onProgress,
      });

      try {
        const response = sdk.completion({
          modelId,
          stream: true,
          history: buildDecisionPrompt(params),
        });
        return parseTreasuryDecision(await extractCompletionText(response), params.options);
      } catch (cause) {
        throw wrapExternalError("QVAC", "local treasury reasoning", cause);
      } finally {
        await sdk.unloadModel?.({ modelId });
        await sdk.close?.();
      }
    },
  };
}

async function importQvacSdk(sdkPath?: string): Promise<QvacSdkLike> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;

  if (sdkPath) {
    try {
      return (await dynamicImport(toImportSpecifier(resolveExplicitSdkPath(sdkPath)))) as QvacSdkLike;
    } catch (cause) {
      throw new ArcPaySdkError(
        "CONFIGURATION_ERROR",
        `Failed to load @qvac/sdk from QVAC_SDK_PATH. Check that ${sdkPath} is an installed package path or module entry file.`,
        cause,
      );
    }
  }

  try {
    return (await dynamicImport("@qvac/sdk")) as QvacSdkLike;
  } catch (cause) {
    try {
      const requireFromConsumer = createRequire(`${process.cwd()}/package.json`);
      const resolvedSdkPath = requireFromConsumer.resolve("@qvac/sdk");
      return (await dynamicImport(pathToFileURL(resolvedSdkPath).href)) as QvacSdkLike;
    } catch (fallbackCause) {
      throw new ArcPaySdkError(
        "CONFIGURATION_ERROR",
        "@qvac/sdk is required for live QVAC proof. Install it in the workspace or set QVAC_SDK_PATH to the installed package path.",
        fallbackCause instanceof Error ? fallbackCause : cause,
      );
    }
  }
}

function resolveExplicitSdkPath(sdkPath: string): string {
  const candidate = assertNonEmptyString(sdkPath, "sdkPath");
  const requireFromConsumer = createRequire(`${process.cwd()}/package.json`);

  try {
    return requireFromConsumer.resolve(candidate);
  } catch {
    return resolvePackageDirectoryEntry(candidate);
  }
}

function resolvePackageDirectoryEntry(candidate: string): string {
  try {
    if (!statSync(candidate).isDirectory()) {
      return candidate;
    }
  } catch {
    return candidate;
  }

  const packageJsonPath = path.join(candidate, "package.json");
  const packageJson = readPackageJson(packageJsonPath);
  const configuredEntry = findPackageEntry(packageJson);
  const possibleEntries = [
    configuredEntry,
    "./dist/index.js",
    "./dist/index.mjs",
    "./index.js",
    "./index.mjs",
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  for (const entry of possibleEntries) {
    const resolvedEntry = path.resolve(candidate, entry);

    if (existsSync(resolvedEntry)) {
      return resolvedEntry;
    }
  }

  return candidate;
}

function readPackageJson(packageJsonPath: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function findPackageEntry(packageJson: Record<string, unknown> | undefined): string | undefined {
  if (!packageJson) {
    return undefined;
  }

  const exportsEntry = packageJson.exports;

  if (typeof exportsEntry === "string") {
    return exportsEntry;
  }

  if (typeof exportsEntry === "object" && exportsEntry !== null) {
    const rootExport = (exportsEntry as Record<string, unknown>)["."];

    if (typeof rootExport === "string") {
      return rootExport;
    }

    if (typeof rootExport === "object" && rootExport !== null) {
      const rootExportRecord = rootExport as Record<string, unknown>;
      const conditionalEntry =
        rootExportRecord.import ?? rootExportRecord.default ?? rootExportRecord.node ?? rootExportRecord.require;

      if (typeof conditionalEntry === "string") {
        return conditionalEntry;
      }
    }
  }

  const moduleEntry = packageJson.module;

  if (typeof moduleEntry === "string") {
    return moduleEntry;
  }

  const mainEntry = packageJson.main;

  if (typeof mainEntry === "string") {
    return mainEntry;
  }

  return undefined;
}

function toImportSpecifier(resolvedPathOrModule: string): string {
  if (
    resolvedPathOrModule.startsWith(".") ||
    resolvedPathOrModule.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(resolvedPathOrModule)
  ) {
    return pathToFileURL(resolvedPathOrModule).href;
  }

  return resolvedPathOrModule;
}

function resolveModelSrc(sdk: QvacSdkLike, configuredModelSrc: string | undefined): QvacModelSource {
  if (configuredModelSrc) {
    return assertNonEmptyString(configuredModelSrc, "modelSrc");
  }

  for (const exportName of DEFAULT_QVAC_MODEL_EXPORTS) {
    const exportedModel = sdk[exportName];

    if (typeof exportedModel === "string" && exportedModel.trim().length > 0) {
      return exportedModel;
    }

    if (typeof exportedModel === "object" && exportedModel !== null) {
      return exportedModel as Record<string, unknown>;
    }
  }

  throw new ArcPaySdkError(
    "CONFIGURATION_ERROR",
    `QVAC_MODEL_SRC is required because @qvac/sdk did not expose ${DEFAULT_QVAC_MODEL_EXPORTS.join(" or ")}.`,
  );
}

function buildDecisionPrompt(params: Parameters<QvacClient["reason"]>[0]): readonly QvacMessage[] {
  return [
    {
      role: "system",
      content:
        "You are ArcPay's local treasury reasoning engine. Return only strict JSON matching {\"action\":\"CONVERT_NOW|KEEP_YIELDING|EXECUTE_PAYMENTS|WAIT\",\"confidence\":0.0,\"reason\":\"short reason\"}.",
    },
    {
      role: "user",
      content: [
        params.context,
        params.context2,
        `Question: ${params.question}`,
        `Allowed actions: ${params.options.join(", ")}`,
        "Choose exactly one allowed action. Confidence must be between 0 and 1.",
      ].join("\n"),
    },
  ];
}

function parseTreasuryDecision(
  text: string,
  allowedActions: readonly TreasuryAction[],
): TreasuryDecision {
  const parsed = parseJsonObject(text);

  if (typeof parsed !== "object" || parsed === null) {
    throw new ArcPaySdkError("EXTERNAL_SERVICE_ERROR", "QVAC response was not a JSON object.");
  }

  const record = parsed as Partial<Record<keyof TreasuryDecision, unknown>>;
  const action = record.action;

  if (typeof action !== "string" || !allowedActions.includes(action as TreasuryAction)) {
    throw new ArcPaySdkError("EXTERNAL_SERVICE_ERROR", "QVAC response action was not allowed.");
  }

  const confidence = record.confidence;

  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new ArcPaySdkError(
      "EXTERNAL_SERVICE_ERROR",
      "QVAC response confidence must be between 0 and 1.",
    );
  }

  const reason = record.reason;

  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new ArcPaySdkError("EXTERNAL_SERVICE_ERROR", "QVAC response reason is required.");
  }

  return {
    action: action as TreasuryAction,
    confidence,
    reason: reason.trim(),
  };
}

async function extractCompletionText(response: unknown): Promise<string> {
  if (isPromiseLike(response)) {
    return extractCompletionText(await response);
  }

  if (typeof response === "string") {
    return response;
  }

  if (typeof response !== "object" || response === null) {
    throw new ArcPaySdkError("EXTERNAL_SERVICE_ERROR", "QVAC completion response was empty.");
  }

  const record = response as Record<string, unknown>;
  const directText = record.text ?? record.content ?? record.output ?? record.response;

  if (typeof directText === "string") {
    return directText;
  }

  if (isPromiseLike(directText)) {
    const resolved = await directText;

    if (typeof resolved === "string") {
      return resolved;
    }
  }

  const final = record.final;

  if (isPromiseLike(final)) {
    const resolvedFinal = await final;

    if (typeof resolvedFinal === "object" && resolvedFinal !== null) {
      const finalRecord = resolvedFinal as Record<string, unknown>;
      const finalText =
        finalRecord.contentText ??
        (typeof finalRecord.raw === "object" && finalRecord.raw !== null
          ? (finalRecord.raw as Record<string, unknown>).fullText
          : undefined);

      if (typeof finalText === "string") {
        return finalText;
      }
    }
  }

  const tokenStream = record.tokenStream;

  if (isAsyncIterable(tokenStream)) {
    let output = "";

    for await (const token of tokenStream) {
      if (typeof token === "string") {
        output += token;
      } else if (typeof token === "object" && token !== null && typeof (token as { text?: unknown }).text === "string") {
        output += (token as { text: string }).text;
      }
    }

    if (output.trim().length > 0) {
      return output;
    }
  }

  if (Array.isArray(record.content)) {
    const contentText = record.content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item === "object" && item !== null && typeof (item as { text?: unknown }).text === "string") {
          return (item as { text: string }).text;
        }

        return "";
      })
      .join("");

    if (contentText.trim().length > 0) {
      return contentText;
    }
  }

  throw new ArcPaySdkError("EXTERNAL_SERVICE_ERROR", "QVAC completion text was missing.");
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end <= start) {
      throw new ArcPaySdkError("EXTERNAL_SERVICE_ERROR", "QVAC response did not contain JSON.");
    }

    return JSON.parse(text.slice(start, end + 1));
  }
}
