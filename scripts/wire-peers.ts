import { ethers } from "hardhat";

/**
 * Wire peers between AgentBridge (Base) and AgentBridgeReceiver (destination chains).
 *
 * Usage:
 *   BRIDGE_ADDR=0x... RECEIVER_ADDR=0x... DEST_EID=30110 npx hardhat run scripts/wire-peers.ts --network base-sepolia
 *
 * Then run the reverse on the destination:
 *   RECEIVER_ADDR=0x... BRIDGE_ADDR=0x... SOURCE_EID=30245 npx hardhat run scripts/wire-peers.ts --network arbitrum-sepolia
 */

// LayerZero Endpoint IDs
const EID: Record<string, number> = {
  "base-sepolia": 40245,
  "base-mainnet": 30184,
  "arbitrum-sepolia": 40231,
  "optimism-sepolia": 40232,
};

async function main() {
  const bridgeAddr = process.env.BRIDGE_ADDR;
  const receiverAddr = process.env.RECEIVER_ADDR;
  const destEid = process.env.DEST_EID ? parseInt(process.env.DEST_EID) : undefined;
  const sourceEid = process.env.SOURCE_EID ? parseInt(process.env.SOURCE_EID) : undefined;

  if (!bridgeAddr || !receiverAddr) {
    console.error("Set BRIDGE_ADDR and RECEIVER_ADDR env vars");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log(`Wiring peers with signer: ${signer.address}`);

  if (destEid) {
    // We're on the source chain (Base) — set peer on AgentBridge
    const bridge = await ethers.getContractAt("AgentBridge", bridgeAddr);
    const peerBytes32 = ethers.zeroPadValue(receiverAddr, 32);
    console.log(`Setting peer on AgentBridge: EID=${destEid} → ${receiverAddr}`);
    const tx = await bridge.setPeer(destEid, peerBytes32);
    await tx.wait();
    console.log(`Done: ${tx.hash}`);
  }

  if (sourceEid) {
    // We're on the destination chain — set peer on AgentBridgeReceiver
    const receiver = await ethers.getContractAt("AgentBridgeReceiver", receiverAddr);
    const peerBytes32 = ethers.zeroPadValue(bridgeAddr, 32);
    console.log(`Setting peer on AgentBridgeReceiver: EID=${sourceEid} → ${bridgeAddr}`);
    const tx = await receiver.setPeer(sourceEid, peerBytes32);
    await tx.wait();
    console.log(`Done: ${tx.hash}`);
  }
}

main().catch(console.error);
