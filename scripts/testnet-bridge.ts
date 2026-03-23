/**
 * Execute a real cross-chain identity bridge on testnet.
 * Produces a verifiable LayerZero transaction hash.
 *
 * Run: npx hardhat run scripts/testnet-bridge.ts --network base-sepolia
 */

import { ethers } from "hardhat";

const IDENTITY_REG = "0x51a07E8f24c8704e5e76ed0A76Cc68096536edbb";
const REPUTATION_REG = "0x070425B1d977e4871fc7A3841E6382Db8560a360";
const BRIDGE_ADDR = "0x83A543C32Bda488b51C29b31ccA490cD6F7d5CdD";
const ARB_SEPOLIA_EID = 40231;

async function sendTx(label: string, fn: () => Promise<any>) {
  console.log(`   ${label}...`);
  const tx = await fn();
  console.log(`   tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   confirmed block ${receipt?.blockNumber}`);
  // Wait for nonce to sync
  await new Promise(r => setTimeout(r, 5000));
  return { tx, receipt };
}

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  let nonce = await ethers.provider.getTransactionCount(signer.address);

  console.log(`\nSigner: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`Nonce: ${nonce}\n`);

  const identity = await ethers.getContractAt("MockIdentityRegistry", IDENTITY_REG);
  const reputation = await ethers.getContractAt("MockReputationRegistry", REPUTATION_REG);
  const bridge = await ethers.getContractAt("AgentBridge", BRIDGE_ADDR);

  // 1. Register agent
  console.log("1. Registering agent...");
  const { tx: regTx } = await sendTx("register", () =>
    identity.register(
      "data:application/json," + encodeURIComponent(JSON.stringify({
        name: "OmniAgent Demo",
        type: "bridge-agent",
        harness: "claude-code",
      })),
      { nonce: nonce++ }
    )
  );

  // Get agentId from event
  const regReceipt = await regTx.wait();
  const transferLog = regReceipt?.logs.find(
    (l: any) => l.topics[0] === ethers.id("Transfer(address,address,uint256)")
  );
  const agentId = transferLog ? Number(transferLog.topics[3]) : 0;
  console.log(`   Agent #${agentId}\n`);

  // 2. Give reputation
  console.log("2. Giving reputation...");
  await sendTx("feedback 1 (score=90)", () =>
    reputation.giveFeedback(agentId, 90, 0, "quality", "", { nonce: nonce++ })
  );
  await sendTx("feedback 2 (score=85)", () =>
    reputation.giveFeedback(agentId, 85, 0, "reliability", "", { nonce: nonce++ })
  );

  const summary = await reputation.getSummary(agentId);
  console.log(`   Reputation: avg=${summary.averageValue}, count=${summary.feedbackCount}\n`);

  // 3. Quote + bridge
  console.log("3. Bridging to Arbitrum Sepolia...");

  // Build LZ options: type 3 with executor lzReceive gas (200000 gas for destination execution)
  // Options format: 0x0003 (type3) + 01 (worker) + 0011 (length=17) + 00030d40 (gas=200000) + 00 (value=0 padded)
  const options = ethers.concat([
    "0x00030100110100000000000000000000000000030d40",
  ]);

  const fee = await bridge.quoteBridge(agentId, ARB_SEPOLIA_EID, options);
  console.log(`   Fee: ${ethers.formatEther(fee.nativeFee)} ETH`);

  const { tx: bridgeTx, receipt: bridgeReceipt } = await sendTx("bridgeIdentity", () =>
    bridge.bridgeIdentity(agentId, ARB_SEPOLIA_EID, options, {
      value: fee.nativeFee,
      nonce: nonce++,
    })
  );

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  REAL TESTNET BRIDGE COMPLETE");
  console.log("═".repeat(60));
  console.log(`\n  Agent ID:     ${agentId}`);
  console.log(`  Register tx:  ${regTx.hash}`);
  console.log(`  Bridge tx:    ${bridgeTx.hash}`);
  console.log(`  Source:        Base Sepolia → Arbitrum Sepolia`);
  console.log(`\n  LayerZero Scan: https://testnet.layerzeroscan.com/tx/${bridgeTx.hash}`);
  console.log(`  Basescan:       https://sepolia.basescan.org/tx/${bridgeTx.hash}`);
  console.log(`\n  Final balance:  ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH`);
}

main().catch(console.error);
