import { ethers } from "hardhat";

const BRIDGE_ADDR = "0x83A543C32Bda488b51C29b31ccA490cD6F7d5CdD";
const IDENTITY_REG = "0x51a07E8f24c8704e5e76ed0A76Cc68096536edbb";
const REPUTATION_REG = "0x070425B1d977e4871fc7A3841E6382Db8560a360";
const VALIDATION_REG = "0x4B7A3D7D0D2Fce8A25C5fAEd3204aa471f8fE06b";
const ARB_SEPOLIA_EID = 40231;

async function main() {
  const identity = await ethers.getContractAt("MockIdentityRegistry", IDENTITY_REG);
  const reputation = await ethers.getContractAt("MockReputationRegistry", REPUTATION_REG);
  const validation = await ethers.getContractAt("MockValidationRegistry", VALIDATION_REG);

  // Check agent 0
  try {
    const owner = await identity.ownerOf(0);
    console.log(`Agent #0 owner: ${owner}`);
    const uri = await identity.tokenURI(0);
    console.log(`Agent #0 URI: ${uri.slice(0, 80)}...`);
  } catch (e: any) {
    console.log(`ownerOf(0) failed: ${e.message}`);
  }

  try {
    const rep = await reputation.getSummary(0);
    console.log(`Rep summary: avg=${rep.averageValue}, count=${rep.feedbackCount}`);
  } catch (e: any) {
    console.log(`rep.getSummary(0) failed: ${e.message}`);
  }

  try {
    const val = await validation.getSummary(0);
    console.log(`Val summary: avg=${val.averageScore}, count=${val.validationCount}`);
  } catch (e: any) {
    console.log(`val.getSummary(0) failed: ${e.message}`);
  }

  // Try quoteBridge directly
  const bridge = await ethers.getContractAt("AgentBridge", BRIDGE_ADDR);
  try {
    const fee = await bridge.quoteBridge(0, ARB_SEPOLIA_EID, "0x");
    console.log(`Quote: ${ethers.formatEther(fee.nativeFee)} ETH`);
  } catch (e: any) {
    console.log(`quoteBridge failed: ${e.message.slice(0, 200)}`);
  }
}

main().catch(console.error);
