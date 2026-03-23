import { ethers } from "hardhat";

const BRIDGE_ADDR = "0x83A543C32Bda488b51C29b31ccA490cD6F7d5CdD";
const RECEIVER_ADDR = "0xEC50f64bAC775bF6b614D1E51E8B8daf7dcE41e2";
const BASE_SEPOLIA_EID = 40245;
const ARB_SEPOLIA_EID = 40231;

async function main() {
  const action = process.env.ACTION;

  if (action === "wire-base") {
    await wireBase();
  } else if (action === "wire-arb") {
    await wireArb();
  } else {
    console.log("Set ACTION=wire-base or ACTION=wire-arb");
  }
}

async function wireBase() {
  console.log("Setting peer on AgentBridge (Base Sepolia)...");
  const bridge = await ethers.getContractAt("AgentBridge", BRIDGE_ADDR);
  const peerBytes32 = ethers.zeroPadValue(RECEIVER_ADDR, 32);
  const tx = await bridge.setPeer(ARB_SEPOLIA_EID, peerBytes32);
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();
  console.log(`  Done! Bridge → Receiver peer set for EID ${ARB_SEPOLIA_EID}`);
}

async function wireArb() {
  console.log("Setting peer on AgentBridgeReceiver (Arbitrum Sepolia)...");
  const receiver = await ethers.getContractAt("AgentBridgeReceiver", RECEIVER_ADDR);
  const peerBytes32 = ethers.zeroPadValue(BRIDGE_ADDR, 32);
  const tx = await receiver.setPeer(BASE_SEPOLIA_EID, peerBytes32);
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();
  console.log(`  Done! Receiver → Bridge peer set for EID ${BASE_SEPOLIA_EID}`);
}

main().catch(console.error);
