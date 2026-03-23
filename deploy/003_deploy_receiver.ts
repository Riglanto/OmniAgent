import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const LZ_ENDPOINTS: Record<string, string> = {
  "arbitrum-sepolia": "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "optimism-sepolia": "0x6EDCE65403992e310A62460808c4b910D972f10f",
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const network = hre.network.name;
  const endpoint = LZ_ENDPOINTS[network];
  if (!endpoint) {
    console.log(`No LZ endpoint for ${network} or not a destination chain, skipping receiver`);
    return;
  }

  const receiverDeployment = await deploy("AgentBridgeReceiver", {
    from: deployer,
    args: [endpoint, deployer],
    log: true,
  });

  // Deploy demo vault with min reputation of 50
  await deploy("ReputationGatedVault", {
    from: deployer,
    args: [receiverDeployment.address, 50],
    log: true,
  });
};

func.tags = ["Receiver"];
export default func;
