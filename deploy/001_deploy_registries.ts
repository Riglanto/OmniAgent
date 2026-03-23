import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Only deploy mock registries on testnets — on mainnet, use the real ERC-8004 registries
  const network = hre.network.name;
  if (network === "base-mainnet") {
    console.log("Skipping mock registry deployment on mainnet");
    return;
  }

  await deploy("MockIdentityRegistry", {
    from: deployer,
    args: [],
    log: true,
  });

  await deploy("MockReputationRegistry", {
    from: deployer,
    args: [],
    log: true,
  });
};

func.tags = ["Registries"];
export default func;
