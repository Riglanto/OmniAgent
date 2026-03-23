import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// LayerZero Endpoint V2 addresses (same on all EVM chains)
const LZ_ENDPOINT_V2 = "0x1a44076050125825900e736c501f859c50fE728c";

// LayerZero Endpoint V2 testnet addresses
const LZ_ENDPOINTS: Record<string, string> = {
  "base-sepolia": "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "arbitrum-sepolia": "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "optimism-sepolia": "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "base-mainnet": LZ_ENDPOINT_V2,
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const network = hre.network.name;
  const endpoint = LZ_ENDPOINTS[network];
  if (!endpoint) {
    console.log(`No LZ endpoint configured for ${network}, skipping bridge deployment`);
    return;
  }

  // Only deploy AgentBridge on Base (source chain)
  if (network.startsWith("base")) {
    const identityRegistry = await get("MockIdentityRegistry");
    const reputationRegistry = await get("MockReputationRegistry");

    await deploy("AgentBridge", {
      from: deployer,
      args: [endpoint, deployer, identityRegistry.address, reputationRegistry.address],
      log: true,
    });
  }
};

func.tags = ["Bridge"];
func.dependencies = ["Registries"];
export default func;
