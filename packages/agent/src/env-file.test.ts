import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnvFile } from "./env-file.js";

describe("env file loader", () => {
  it("loads .env values while preserving explicit process values", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "arcpay-env-file-"));
    const envPath = path.join(directory, ".env");
    await writeFile(
      envPath,
      [
        "A=from-file",
        "B=\"quoted value\"",
        "# ignored",
        "INVALID_LINE",
      ].join("\n"),
      "utf8",
    );

    const env = loadEnvFile({ A: "from-process" }, envPath);

    expect(env.A).toBe("from-process");
    expect(env.B).toBe("quoted value");
    expect(env.INVALID_LINE).toBeUndefined();
  });
});
