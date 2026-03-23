import { ethers } from "hardhat";

/**
 * Demo script: Register an agent, give reputation, and bridge identity cross-chain.
 *
 * Usage (on Base testnet):
 *   IDENTITY_REG=0x... REPUTATION_REG=0x... BRIDGE_ADDR=0x... DEST_EID=40231 \
 *     npx hardhat run scripts/demo-bridge.ts --network base-sepolia
 */

async function main() {
  const identityAddr = process.env.IDENTITY_REG!;
  const reputationAddr = process.env.REPUTATION_REG!;
  const bridgeAddr = process.env.BRIDGE_ADDR!;
  const destEid = parseInt(process.env.DEST_EID!);

  if (!identityAddr || !reputationAddr || !bridgeAddr || !destEid) {
    console.error("Set IDENTITY_REG, REPUTATION_REG, BRIDGE_ADDR, DEST_EID env vars");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log(`Running demo with signer: ${signer.address}\n`);

  // 1. Register an agent
  console.log("--- Step 1: Register Agent ---");
  const identity = await ethers.getContractAt("MockIdentityRegistry", identityAddr);
  const regTx = await identity.register("ipfs://QmExampleAgentMetadata");
  const regReceipt = await regTx.wait();
  // Find the Transfer event to get the agentId
  const transferLog = regReceipt?.logs.find(
    (l: any) => l.topics[0] === ethers.id("Transfer(address,address,uint256)")
  );
  const agentId = transferLog ? BigInt(transferLog.topics[3]) : 0n;
  console.log(`Registered agent #${agentId} owned by ${signer.address}`);
  console.log(`Token URI: ${await identity.tokenURI(agentId)}`);

  // 2. Give reputation feedback
  console.log("\n--- Step 2: Give Reputation ---");
  const reputation = await ethers.getContractAt("MockReputationRegistry", reputationAddr);
  // Note: in real usage, other agents/users give feedback. For demo, we self-rate.
  await (await reputation.giveFeedback(agentId, 85, 0, "quality", "")).wait();
  await (await reputation.giveFeedback(agentId, 90, 0, "reliability", "")).wait();
  const summary = await reputation.getSummary(agentId);
  console.log(`Reputation: avg=${summary.averageValue}, count=${summary.feedbackCount}`);

  // 3. Quote and bridge
  console.log("\n--- Step 3: Bridge Identity Cross-Chain ---");
  const bridge = await ethers.getContractAt("AgentBridge", bridgeAddr);

  // Build options (empty for now — the enforced options on the receiver handle gas)
  const options = "0x";
  const fee = await bridge.quoteBridge(agentId, destEid, options);
  console.log(`Bridge fee: ${ethers.formatEther(fee.nativeFee)} ETH`);

  const bridgeTx = await bridge.bridgeIdentity(agentId, destEid, options, {
    value: fee.nativeFee,
  });
  const bridgeReceipt = await bridgeTx.wait();
  console.log(`Bridge tx: ${bridgeTx.hash}`);
  console.log(`\nIdentity bridged! Check the destination chain receiver for the cached identity.`);
}

main().catch(console.error);
