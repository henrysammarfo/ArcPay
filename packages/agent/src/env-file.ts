import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

export function loadEnvFile(
  source: NodeJS.ProcessEnv = process.env,
  envPath = findEnvFile(),
): NodeJS.ProcessEnv {
  if (!envPath) {
    return { ...source };
  }

  return {
    ...parseEnvFile(envPath),
    ...source,
  };
}

function findEnvFile(startDirectory = process.cwd()): string | undefined {
  let current = resolve(startDirectory);
  const root = parse(current).root;

  while (true) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    if (current === root) {
      return undefined;
    }

    current = dirname(current);
  }
}

function parseEnvFile(path: string): NodeJS.ProcessEnv {
  const parsed: NodeJS.ProcessEnv = {};
  const content = readFileSync(path, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = unquoteEnvValue(value);
  }

  return parsed;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
