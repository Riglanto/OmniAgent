import { ethers } from "hardhat";

// LayerZero Endpoint V2 testnet address (same on all testnets)
const LZ_ENDPOINT_TESTNET = "0x6EDCE65403992e310A62460808c4b910D972f10f";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  const isBase = process.env.CHAIN === "base";
  const isArb = process.env.CHAIN === "arb";

  if (isBase) {
    await deployBase(deployer);
  } else if (isArb) {
    await deployArb(deployer);
  } else {
    console.log("Set CHAIN=base or CHAIN=arb");
  }
}

async function deployContract(name: string, args: any[], deployer: any) {
  console.log(`Deploying ${name}...`);
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  console.log(`  tx: ${tx?.hash}`);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`  ${name}: ${addr}`);
  // Wait a moment for nonce to sync
  await new Promise(r => setTimeout(r, 3000));
  return addr;
}

async function deployBase(deployer: any) {
  console.log("=== Deploying to Base Sepolia ===\n");

  const identityAddr = await deployContract("MockIdentityRegistry", [], deployer);
  const reputationAddr = await deployContract("MockReputationRegistry", [], deployer);
  const validationAddr = await deployContract("MockValidationRegistry", [], deployer);
  const bridgeAddr = await deployContract("AgentBridge", [
    LZ_ENDPOINT_TESTNET, deployer.address, identityAddr, reputationAddr, validationAddr
  ], deployer);

  console.log("\n=== Base Sepolia deployment complete ===");
  console.log(`\n  IDENTITY_REG=${identityAddr}`);
  console.log(`  REPUTATION_REG=${reputationAddr}`);
  console.log(`  VALIDATION_REG=${validationAddr}`);
  console.log(`  BRIDGE_ADDR=${bridgeAddr}`);
}

async function deployArb(deployer: any) {
  console.log("=== Deploying to Arbitrum Sepolia ===\n");

  const receiverAddr = await deployContract("AgentBridgeReceiver", [
    LZ_ENDPOINT_TESTNET, deployer.address
  ], deployer);
  const vaultAddr = await deployContract("ReputationGatedVault", [receiverAddr, 50], deployer);

  console.log("\n=== Arbitrum Sepolia deployment complete ===");
  console.log(`\n  RECEIVER_ADDR=${receiverAddr}`);
  console.log(`  VAULT_ADDR=${vaultAddr}`);
}

main().catch(console.error);
