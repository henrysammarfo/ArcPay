#!/usr/bin/env node
import { Command } from "commander";
import {
  handleBalance,
  handlePay,
  handleReceive,
  handleScore,
  handleTreasuryInit,
  handleYield,
  handleZerionPolicy,
  handleZerionStatus,
  printResult,
} from "./commands.js";

const program = new Command();

program
  .name("arcpay")
  .description("ArcPay private autonomous treasury CLI")
  .version("0.1.0");

const treasury = program.command("treasury").description("Treasury commands");

treasury
  .command("init")
  .requiredOption("--agent-id <agentId>")
  .requiredOption("--daily-limit <dailyLimit>")
  .option("--max-single-tx <maxSingleTx>")
  .action(async (options) => {
    printResult(await handleTreasuryInit(options));
  });

program
  .command("receive")
  .requiredOption("--currency <currency>")
  .option("--webhook <webhook>")
  .action(async (options) => {
    printResult(await handleReceive(options));
  });

program
  .command("pay")
  .requiredOption("--to <wallet>")
  .requiredOption("--amount <amount>")
  .requiredOption("--currency <currency>")
  .option("--private")
  .action(async (options) => {
    printResult(await handlePay(options));
  });

program
  .command("yield")
  .requiredOption("--action <action>")
  .requiredOption("--amount <amount>")
  .requiredOption("--provider <provider>")
  .action(async (options) => {
    printResult(await handleYield(options));
  });

program
  .command("balance")
  .requiredOption("--agent <agent>")
  .action(async (options) => {
    printResult(await handleBalance(options));
  });

program
  .command("score")
  .requiredOption("--wallet <wallet>")
  .option("--tx-count <txCount>")
  .action(async (options) => {
    printResult(await handleScore(options));
  });

const zerion = program.command("zerion").description("Official Zerion CLI integration checks");

zerion.command("status").action(async () => {
  printResult(await handleZerionStatus());
});

zerion
  .command("policy")
  .description("Validate a scoped policy before handing execution to a forked Zerion CLI")
  .requiredOption("--chain <chain>", "Chain lock, for example solana or base")
  .requiredOption("--max-spend-usd <amount>", "Maximum USD-equivalent spend for this policy")
  .requiredOption("--expires-at <isoDate>", "Policy expiry as an ISO timestamp")
  .option("--wallet <wallet>", "Wallet address allowed to execute under this policy")
  .option("--route <route>", "Allowed route type: swap, bridge, or rebalance", "swap")
  .option("--allowed-asset <symbol>", "Allowed asset symbol; can be repeated", collectValues, [])
  .option("--blocked-action <action>", "Blocked action; can be repeated", collectValues, [])
  .action(async (options) => {
    printResult(await handleZerionPolicy(options));
  });

await program.parseAsync();

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}
