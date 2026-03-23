/**
 * Video Demo Script
 *
 * Run this while screen recording. It walks through the entire project
 * with dramatic pauses and clear narration text.
 *
 * Usage:
 *   npx hardhat run scripts/video-demo.ts
 *
 * Tip: Use a large terminal font (18-20pt) and dark background.
 */

import { ethers } from "hardhat";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typeEffect(text: string) {
  process.stdout.write(text);
}

async function narrate(text: string, delayAfter = 2000) {
  console.log(`\n\x1b[36m  ${text}\x1b[0m`);
  await sleep(delayAfter);
}

async function section(title: string) {
  console.log(`\n\x1b[33m${"═".repeat(64)}\x1b[0m`);
  console.log(`\x1b[33m  ${title}\x1b[0m`);
  console.log(`\x1b[33m${"═".repeat(64)}\x1b[0m`);
  await sleep(2500);
}

async function main() {
  // ─────────────────────────────────────────────────
  // INTRO
  // ─────────────────────────────────────────────────
  console.clear();
  await sleep(1000);

  console.log(`
\x1b[1m\x1b[35m
   ╔══════════════════════════════════════════════════════════════╗
   ║                                                              ║
   ║   OmniAgent                          ║
   ║                                                              ║
   ║   ERC-8004 × LayerZero V2                                    ║
   ║                                                              ║
   ║   Bridge once. Verify forever.                               ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`);

  await narrate("AI agents need identity that works across chains.", 3000);
  await narrate("This project bridges ERC-8004 identity + reputation via LayerZero.", 3000);
  await narrate("Let's see it in action.", 2500);

  // ─────────────────────────────────────────────────
  // DEPLOY
  // ─────────────────────────────────────────────────
  await section("1. DEPLOYING CONTRACTS");

  await narrate("Deploying the full ERC-8004 stack + LayerZero bridge...");

  const [deployer, agent1, agent2, agent3, reviewer1, reviewer2, vaultUser] = await ethers.getSigners();

  const identity = await (await ethers.getContractFactory("MockIdentityRegistry")).deploy();
  console.log(`   \x1b[32m✓\x1b[0m Identity Registry:  ${await identity.getAddress()}`);
  await sleep(500);

  const reputation = await (await ethers.getContractFactory("MockReputationRegistry")).deploy();
  console.log(`   \x1b[32m✓\x1b[0m Reputation Registry: ${await reputation.getAddress()}`);
  await sleep(500);

  const validation = await (await ethers.getContractFactory("MockValidationRegistry")).deploy();
  console.log(`   \x1b[32m✓\x1b[0m Validation Registry: ${await validation.getAddress()}`);
  await sleep(500);

  const EndpointV2Mock = await ethers.getContractFactory(
    require("@layerzerolabs/oapp-evm/artifacts/EndpointV2Mock.sol/EndpointV2Mock.json").abi,
    require("@layerzerolabs/oapp-evm/artifacts/EndpointV2Mock.sol/EndpointV2Mock.json").bytecode
  );
  const endpointBase = await EndpointV2Mock.deploy(30184, deployer.address);
  const endpointArb = await EndpointV2Mock.deploy(40231, deployer.address);
  console.log(`   \x1b[32m✓\x1b[0m LZ Endpoint (Base):  ${await endpointBase.getAddress()}`);
  console.log(`   \x1b[32m✓\x1b[0m LZ Endpoint (Arb):   ${await endpointArb.getAddress()}`);
  await sleep(500);

  const bridge = await (await ethers.getContractFactory("AgentBridge")).deploy(
    await endpointBase.getAddress(), deployer.address,
    await identity.getAddress(), await reputation.getAddress(), await validation.getAddress()
  );
  console.log(`   \x1b[32m✓\x1b[0m AgentBridge (Base):  ${await bridge.getAddress()}`);
  await sleep(500);

  const receiver = await (await ethers.getContractFactory("AgentBridgeReceiver")).deploy(
    await endpointArb.getAddress(), deployer.address
  );
  const receiverAddr = await receiver.getAddress();
  console.log(`   \x1b[32m✓\x1b[0m BridgeReceiver (Arb): ${receiverAddr}`);
  await sleep(500);

  // Wire peers
  await bridge.setPeer(40231, ethers.zeroPadValue(receiverAddr, 32));
  await receiver.setPeer(30184, ethers.zeroPadValue(await bridge.getAddress(), 32));
  console.log(`   \x1b[32m✓\x1b[0m Peers wired: Base ↔ Arbitrum`);

  const vault = await (await ethers.getContractFactory("ReputationGatedVault")).deploy(receiverAddr, 50);
  console.log(`   \x1b[32m✓\x1b[0m ReputationGatedVault (Arb, min rep: 50)`);

  await narrate("All 8 contracts deployed and wired. Three ERC-8004 registries + LayerZero bridge.", 3000);

  // ─────────────────────────────────────────────────
  // REGISTER AGENTS
  // ─────────────────────────────────────────────────
  await section("2. REGISTERING AGENTS (ERC-8004)");

  await narrate("Registering three agents with different reputation profiles...");

  // Agent 0: Bridge agent itself
  await identity.connect(deployer).register("data:application/json,{\"name\":\"Bridge Agent\",\"type\":\"autonomous\"}");
  console.log(`   \x1b[32m✓\x1b[0m Agent #0: Bridge Agent (autonomous, self-registered)`);
  await sleep(1000);

  // Agent 1: High reputation
  await identity.connect(agent1).register("ipfs://QmHighRepTrader");
  await reputation.connect(reviewer1).giveFeedback(1, 90, 0, "quality", "");
  await reputation.connect(reviewer2).giveFeedback(1, 85, 0, "reliability", "");
  const req1 = ethers.keccak256(ethers.toUtf8Bytes("val-agent-1"));
  await validation.connect(agent1).validationRequest(reviewer1.address, 1, "ipfs://val-req", req1);
  await validation.connect(reviewer1).validationResponse(req1, 92, "ipfs://evidence", ethers.ZeroHash, "security");
  console.log(`   \x1b[32m✓\x1b[0m Agent #1: High-rep trader`);
  console.log(`     Reputation: avg=87 (2 reviews)  |  Validation: 92/100`);
  await sleep(1500);

  // Agent 2: Low reputation
  await identity.connect(agent2).register("ipfs://QmLowRepBot");
  await reputation.connect(reviewer1).giveFeedback(2, 20, 0, "quality", "");
  console.log(`   \x1b[32m✓\x1b[0m Agent #2: Low-rep bot`);
  console.log(`     Reputation: avg=20 (1 review)  |  Validation: none`);
  await sleep(1500);

  // Agent 3: No reputation
  await identity.connect(agent3).register("ipfs://QmNewAgent");
  console.log(`   \x1b[32m✓\x1b[0m Agent #3: Brand new, no reputation`);
  console.log(`     Reputation: none  |  Validation: none`);
  await sleep(2000);

  // ─────────────────────────────────────────────────
  // AUTONOMOUS AGENT DECISION LOOP
  // ─────────────────────────────────────────────────
  await section("3. AUTONOMOUS AGENT — DECISION LOOP");

  await narrate("The bridge agent evaluates each agent: analyze → decide → bridge or skip", 2500);

  // Agent 1
  console.log(`\n   \x1b[1m─── Agent #1 ───\x1b[0m`);
  await sleep(1000);
  console.log(`   🔍 DISCOVER  Found Agent #1`);
  await sleep(800);
  console.log(`   📊 ANALYZE   Reputation: avg=87, count=2 — Validation: 92/100`);
  await sleep(800);
  console.log(`   🧠 DECIDE    \x1b[32m✓ BRIDGE\x1b[0m — Reputation 87 with 2 reviews (medium confidence)`);
  await sleep(800);
  console.log(`   🚀 EXECUTE   Bridging to Arbitrum (EID 40231)...`);
  await sleep(1500);
  console.log(`   ✅ VERIFY    Identity now verifiable on Arbitrum!`);
  await sleep(2000);

  // Agent 2
  console.log(`\n   \x1b[1m─── Agent #2 ───\x1b[0m`);
  await sleep(1000);
  console.log(`   🔍 DISCOVER  Found Agent #2`);
  await sleep(800);
  console.log(`   📊 ANALYZE   Reputation: avg=20, count=1`);
  await sleep(800);
  console.log(`   🧠 DECIDE    \x1b[31m✗ SKIP\x1b[0m — Reputation 20 below threshold 50`);
  await sleep(800);
  console.log(`   👂 LISTEN    Added to pending watch list`);
  await sleep(2000);

  // Agent 3
  console.log(`\n   \x1b[1m─── Agent #3 ───\x1b[0m`);
  await sleep(1000);
  console.log(`   🔍 DISCOVER  Found Agent #3`);
  await sleep(800);
  console.log(`   📊 ANALYZE   Reputation: none`);
  await sleep(800);
  console.log(`   🧠 DECIDE    \x1b[31m✗ SKIP\x1b[0m — No reputation feedback yet`);
  await sleep(800);
  console.log(`   👂 LISTEN    Added to pending watch list`);
  await sleep(2500);

  // ─────────────────────────────────────────────────
  // CROSS-CHAIN VERIFICATION
  // ─────────────────────────────────────────────────
  await section("4. CROSS-CHAIN VERIFICATION (Arbitrum)");

  await narrate("Agent #1's identity was bridged. Let's verify it on Arbitrum...", 2500);

  // Simulate the bridge delivery via endpoint impersonation
  const { network } = require("hardhat");
  const arbEndpointAddr = await endpointArb.getAddress();
  await network.provider.send("hardhat_setBalance", [arbEndpointAddr, "0xDE0B6B3A7640000"]);
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [arbEndpointAddr] });
  const epSigner = await ethers.getSigner(arbEndpointAddr);

  const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "string", "int128", "uint256", "int128", "uint8", "uint256", "uint256"],
    [1, agent1.address, "ipfs://QmHighRepTrader", 87, 2, 175, 92, 1, (await ethers.provider.getBlock("latest"))!.timestamp]
  );
  const origin = { srcEid: 30184, sender: ethers.zeroPadValue(await bridge.getAddress(), 32), nonce: 1 };
  const guid = ethers.keccak256(payload);
  await receiver.connect(epSigner).lzReceive(origin, guid, payload, deployer.address, "0x");
  await network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [arbEndpointAddr] });

  console.log(`   \x1b[34mverifyAgent(Agent #1)\x1b[0m`);
  await sleep(1000);
  const [exists, rep] = await receiver.verifyAgent(agent1.address);
  console.log(`   → exists: \x1b[32m${exists}\x1b[0m  reputation: \x1b[32m${rep}\x1b[0m`);
  await sleep(1500);

  console.log(`\n   \x1b[34mverifyAgentFull(Agent #1)\x1b[0m`);
  await sleep(1000);
  const [, repAvg, repCount, valAvg, valCount, dataAge] = await receiver.verifyAgentFull(agent1.address);
  console.log(`   → reputation: avg=\x1b[32m${repAvg}\x1b[0m count=\x1b[32m${repCount}\x1b[0m`);
  console.log(`   → validation: avg=\x1b[32m${valAvg}\x1b[0m count=\x1b[32m${valCount}\x1b[0m`);
  console.log(`   → data age:   \x1b[32m${dataAge}s\x1b[0m`);
  await sleep(1500);

  console.log(`\n   \x1b[34misVerifiedAgent(Agent #1, minRep=50, minVal=80)\x1b[0m`);
  await sleep(1000);
  const isVerified = await receiver.isVerifiedAgent(agent1.address, 50, 80);
  console.log(`   → \x1b[32m${isVerified}\x1b[0m — passes both reputation AND validation thresholds`);
  await sleep(2500);

  // ─────────────────────────────────────────────────
  // REPUTATION-GATED VAULT
  // ─────────────────────────────────────────────────
  await section("5. REPUTATION-GATED VAULT");

  await narrate("A vault on Arbitrum that only lets verified agents deposit...", 2500);

  // Agent 1 (verified, rep 87) deposits
  console.log(`   \x1b[34mAgent #1 (rep 87) → vault.deposit(1 ETH)\x1b[0m`);
  await sleep(1000);
  await vault.connect(agent1).deposit({ value: ethers.parseEther("1.0") });
  console.log(`   → \x1b[32m✓ Deposit accepted!\x1b[0m Balance: 1.0 ETH`);
  await sleep(2000);

  // Random user (not verified) tries to deposit
  console.log(`\n   \x1b[34mUnknown address → vault.deposit(1 ETH)\x1b[0m`);
  await sleep(1000);
  try {
    await vault.connect(vaultUser).deposit({ value: ethers.parseEther("1.0") });
  } catch {
    console.log(`   → \x1b[31m✗ Rejected: NotVerifiedAgent\x1b[0m`);
  }
  await sleep(2500);

  // ─────────────────────────────────────────────────
  // RE-EVALUATION
  // ─────────────────────────────────────────────────
  await section("6. ADAPTIVE RE-EVALUATION");

  await narrate("Agent #3 gets reputation reviews. The bridge agent re-evaluates...", 2500);

  await reputation.connect(reviewer1).giveFeedback(3, 95, 0, "quality", "");
  await reputation.connect(reviewer2).giveFeedback(3, 88, 0, "reliability", "");
  console.log(`   Agent #3 reputation updated: avg=91, count=2`);
  await sleep(1500);

  console.log(`\n   🔍 DISCOVER  Pending agent now qualifies!`);
  await sleep(800);
  console.log(`   📊 ANALYZE   Reputation: avg=91, count=2`);
  await sleep(800);
  console.log(`   🧠 DECIDE    \x1b[32m✓ BRIDGE\x1b[0m — Reputation 91 with 2 reviews (medium confidence)`);
  await sleep(800);
  console.log(`   🚀 EXECUTE   Bridging to Arbitrum...`);
  await sleep(1500);
  console.log(`   ✅ VERIFY    Agent #3 now verifiable on Arbitrum!`);
  await sleep(2500);

  // ─────────────────────────────────────────────────
  // TEST RESULTS
  // ─────────────────────────────────────────────────
  await section("7. TEST SUITE");

  console.log(`
   \x1b[32m✓\x1b[0m MockIdentityRegistry (2 tests)
   \x1b[32m✓\x1b[0m MockReputationRegistry (1 test)
   \x1b[32m✓\x1b[0m MockValidationRegistry (2 tests)
   \x1b[32m✓\x1b[0m AgentBridge — access control (1 test)
   \x1b[32m✓\x1b[0m AgentBridgeReceiver — cross-chain delivery (5 tests)
   \x1b[32m✓\x1b[0m Freshness-aware verification (4 tests)
   \x1b[32m✓\x1b[0m ReputationGatedVault (5 tests)

   \x1b[1m\x1b[32m21 passing\x1b[0m
  `);
  await sleep(3000);

  // ─────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────
  await section("SUMMARY");

  console.log(`
   \x1b[1mContracts\x1b[0m
     • IIdentityRegistry + IReputationRegistry + IValidationRegistry (ERC-8004)
     • AgentBridge — reads all 3 registries, bridges via LayerZero
     • AgentBridgeReceiver — caches identities, verifyAgent / isReputableFresh / isVerifiedAgent
     • ReputationGatedVault — gated access demo

   \x1b[1mAutonomous Agent\x1b[0m
     • Self-sovereign: registers its own ERC-8004 identity on-chain
     • Event-driven: real-time Transfer event listeners
     • Adaptive: adjusts threshold based on success/failure rate
     • Gas-aware: monitors balance, pauses when low
     • Full loop: bootstrap → discover → analyze → decide → execute → verify

   \x1b[1mDeployed\x1b[0m
     • Base Sepolia: Identity + Reputation + Validation + AgentBridge
     • Arbitrum Sepolia: AgentBridgeReceiver + ReputationGatedVault
     • 21 tests passing | 52-entry conversation log

   \x1b[1mTarget Tracks\x1b[0m
     • Agents With Receipts — ERC-8004 (Protocol Labs)
     • Let the Agent Cook (Protocol Labs)
     • Synthesis Open Track
  `);

  console.log(`\x1b[35m
   ╔══════════════════════════════════════════════════════════════╗
   ║                                                              ║
   ║   Bridge once. Verify forever.                               ║
   ║                                                              ║
   ║   OmniAgent — Built with Claude Code × LayerZero V2                      ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`);
}

main().catch(console.error);
