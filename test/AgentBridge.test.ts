import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// New payload format: (agentId, owner, agentURI, repAvg, repCount, repTotal, valAvg, valCount, bridgedAt)
const PAYLOAD_TYPES = ["uint256", "address", "string", "int128", "uint256", "int128", "uint8", "uint256", "uint256"];

function encodePayload(
  agentId: number, owner: string, uri: string,
  repAvg: number, repCount: number, repTotal: number,
  valAvg: number, valCount: number, bridgedAt: number
) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    PAYLOAD_TYPES,
    [agentId, owner, uri, repAvg, repCount, repTotal, valAvg, valCount, bridgedAt]
  );
}

describe("OmniAgent", function () {
  const BASE_EID = 30184;
  const ARB_EID = 30110;

  let deployer: SignerWithAddress;
  let agentOwner: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let validator: SignerWithAddress;

  let identityRegistry: any;
  let reputationRegistry: any;
  let validationRegistry: any;
  let endpointBase: any;
  let endpointArb: any;
  let agentBridge: any;
  let receiver: any;
  let vault: any;

  async function deliverToReceiver(
    endpointAddr: string, receiverContract: any,
    srcEid: number, senderBytes32: string, nonce: number, payload: string
  ) {
    await network.provider.send("hardhat_setBalance", [endpointAddr, "0xDE0B6B3A7640000"]);
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [endpointAddr] });
    const endpointSigner = await ethers.getSigner(endpointAddr);

    const origin = { srcEid, sender: senderBytes32, nonce };
    const guid = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint32", "bytes32", "uint64"], [srcEid, senderBytes32, nonce])
    );

    await receiverContract.connect(endpointSigner).lzReceive(origin, guid, payload, deployer.address, "0x");
    await network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [endpointAddr] });
  }

  beforeEach(async function () {
    [deployer, agentOwner, randomUser, validator] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("MockIdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();

    const ReputationRegistry = await ethers.getContractFactory("MockReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy();

    const ValidationRegistry = await ethers.getContractFactory("MockValidationRegistry");
    validationRegistry = await ValidationRegistry.deploy();

    const EndpointV2Mock = await ethers.getContractFactory(
      require("@layerzerolabs/oapp-evm/artifacts/EndpointV2Mock.sol/EndpointV2Mock.json").abi,
      require("@layerzerolabs/oapp-evm/artifacts/EndpointV2Mock.sol/EndpointV2Mock.json").bytecode
    );
    endpointBase = await EndpointV2Mock.deploy(BASE_EID, deployer.address);
    endpointArb = await EndpointV2Mock.deploy(ARB_EID, deployer.address);

    const AgentBridge = await ethers.getContractFactory("AgentBridge");
    agentBridge = await AgentBridge.deploy(
      await endpointBase.getAddress(),
      deployer.address,
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      await validationRegistry.getAddress()
    );

    const AgentBridgeReceiver = await ethers.getContractFactory("AgentBridgeReceiver");
    receiver = await AgentBridgeReceiver.deploy(await endpointArb.getAddress(), deployer.address);

    const bridgeAddr = await agentBridge.getAddress();
    const receiverAddr = await receiver.getAddress();
    await agentBridge.setPeer(ARB_EID, ethers.zeroPadValue(receiverAddr, 32));
    await receiver.setPeer(BASE_EID, ethers.zeroPadValue(bridgeAddr, 32));

    const Vault = await ethers.getContractFactory("ReputationGatedVault");
    vault = await Vault.deploy(receiverAddr, 50);
  });

  describe("MockIdentityRegistry", function () {
    it("should register an agent and return agentId 0", async function () {
      await identityRegistry.connect(agentOwner).register("ipfs://agent-metadata");
      expect(await identityRegistry.ownerOf(0)).to.equal(agentOwner.address);
      expect(await identityRegistry.tokenURI(0)).to.equal("ipfs://agent-metadata");
    });

    it("should set and get metadata", async function () {
      await identityRegistry.connect(agentOwner).register("ipfs://agent");
      await identityRegistry.connect(agentOwner).setMetadata(0, "role", "trader");
      expect(await identityRegistry.getMetadata(0, "role")).to.equal("trader");
    });
  });

  describe("MockReputationRegistry", function () {
    it("should accumulate feedback and compute summary", async function () {
      await reputationRegistry.connect(deployer).giveFeedback(0, 80, 0, "quality", "");
      await reputationRegistry.connect(randomUser).giveFeedback(0, 90, 0, "quality", "");

      const summary = await reputationRegistry.getSummary(0);
      expect(summary.feedbackCount).to.equal(2);
      expect(summary.totalValue).to.equal(170);
      expect(summary.averageValue).to.equal(85);
    });
  });

  describe("MockValidationRegistry", function () {
    it("should request validation and receive response", async function () {
      const reqHash = ethers.keccak256(ethers.toUtf8Bytes("validate-agent-0"));

      // Agent requests validation
      await validationRegistry.connect(agentOwner).validationRequest(
        validator.address, 0, "ipfs://validation-request", reqHash
      );

      // Validator responds with score 90
      await validationRegistry.connect(validator).validationResponse(
        reqHash, 90, "ipfs://validation-evidence", ethers.ZeroHash, "security"
      );

      // Check response
      const status = await validationRegistry.getValidationStatus(reqHash);
      expect(status.response).to.equal(90);
      expect(status.exists).to.be.true;

      // Check summary
      const summary = await validationRegistry.getSummary(0);
      expect(summary.validationCount).to.equal(1);
      expect(summary.averageScore).to.equal(90);
    });

    it("should reject validation from non-designated validator", async function () {
      const reqHash = ethers.keccak256(ethers.toUtf8Bytes("validate-agent-0"));
      await validationRegistry.connect(agentOwner).validationRequest(
        validator.address, 0, "ipfs://req", reqHash
      );

      await expect(
        validationRegistry.connect(randomUser).validationResponse(reqHash, 80, "", ethers.ZeroHash, "")
      ).to.be.revertedWith("Not designated validator");
    });
  });

  describe("AgentBridge", function () {
    it("should revert if non-owner tries to bridge", async function () {
      await identityRegistry.connect(agentOwner).register("ipfs://agent");
      await expect(
        agentBridge.connect(randomUser).bridgeIdentity(0, ARB_EID, "0x", { value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(agentBridge, "NotAgentOwner");
    });
  });

  describe("AgentBridgeReceiver — simulated cross-chain delivery", function () {
    let bridgeSenderBytes32: string;
    let arbEndpointAddr: string;

    beforeEach(async function () {
      bridgeSenderBytes32 = ethers.zeroPadValue(await agentBridge.getAddress(), 32);
      arbEndpointAddr = await endpointArb.getAddress();
    });

    it("should store bridged identity with reputation + validation data", async function () {
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent-v1", 85, 10, 850, 92, 3, 1700000000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      const globalId = await receiver.computeGlobalId(BASE_EID, 0);
      const identity = await receiver.getIdentity(globalId);

      expect(identity.agentId).to.equal(0);
      expect(identity.owner).to.equal(agentOwner.address);
      expect(identity.agentURI).to.equal("ipfs://agent-v1");
      expect(identity.reputationAvg).to.equal(85);
      expect(identity.reputationCount).to.equal(10);
      expect(identity.validationAvg).to.equal(92);
      expect(identity.validationCount).to.equal(3);
      expect(identity.sourceChainEid).to.equal(BASE_EID);

      const [exists, rep] = await receiver.verifyAgent(agentOwner.address);
      expect(exists).to.be.true;
      expect(rep).to.equal(85);

      expect(await receiver.getBridgedAgentCount()).to.equal(1);
    });

    it("should update identity on re-bridge", async function () {
      const payload1 = encodePayload(0, agentOwner.address, "ipfs://v1", 50, 5, 250, 60, 1, 1000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload1);

      const payload2 = encodePayload(0, agentOwner.address, "ipfs://v2", 90, 20, 1800, 95, 5, 2000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 2, payload2);

      expect(await receiver.getBridgedAgentCount()).to.equal(1);
      const [, rep] = await receiver.verifyAgent(agentOwner.address);
      expect(rep).to.equal(90);
    });

    it("should return false for unverified agent", async function () {
      const [exists, rep] = await receiver.verifyAgent(randomUser.address);
      expect(exists).to.be.false;
      expect(rep).to.equal(0);
    });

    it("should reject messages from non-peer sender", async function () {
      const payload = encodePayload(0, agentOwner.address, "ipfs://fake", 99, 1, 99, 80, 1, 1000);
      const fakeSender = ethers.zeroPadValue(randomUser.address, 32);
      await expect(
        deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, fakeSender, 1, payload)
      ).to.be.revertedWithCustomError(receiver, "OnlyPeer");
    });

    it("should expose full verification including validation data", async function () {
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 85, 10, 850, 92, 3, 1700000000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      const [exists, repAvg, repCount, valAvg, valCount, dataAge] =
        await receiver.verifyAgentFull(agentOwner.address);

      expect(exists).to.be.true;
      expect(repAvg).to.equal(85);
      expect(repCount).to.equal(10);
      expect(valAvg).to.equal(92);
      expect(valCount).to.equal(3);
    });

    it("should check isVerifiedAgent with both reputation and validation thresholds", async function () {
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 85, 10, 850, 92, 3, 1700000000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      expect(await receiver.isVerifiedAgent(agentOwner.address, 50, 80)).to.be.true;
      expect(await receiver.isVerifiedAgent(agentOwner.address, 50, 95)).to.be.false; // val too high
      expect(await receiver.isVerifiedAgent(agentOwner.address, 90, 80)).to.be.false; // rep too high
      expect(await receiver.isVerifiedAgent(randomUser.address, 0, 0)).to.be.false;   // not found
    });
  });

  describe("Freshness-aware verification (isReputableFresh)", function () {
    let bridgeSenderBytes32: string;
    let arbEndpointAddr: string;

    beforeEach(async function () {
      bridgeSenderBytes32 = ethers.zeroPadValue(await agentBridge.getAddress(), 32);
      arbEndpointAddr = await endpointArb.getAddress();
    });

    it("should return valid=true for fresh data within maxAge", async function () {
      const block = await ethers.provider.getBlock("latest");
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 85, 10, 850, 90, 2, block!.timestamp);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      const [valid, rep, dataAge] = await receiver.isReputableFresh(agentOwner.address, 50, 3600);
      expect(valid).to.be.true;
      expect(rep).to.equal(85);
      expect(dataAge).to.be.lte(5);
    });

    it("should return valid=false for stale data exceeding maxAge", async function () {
      const block = await ethers.provider.getBlock("latest");
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 85, 10, 850, 90, 2, block!.timestamp - 7200);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      const [valid, , dataAge] = await receiver.isReputableFresh(agentOwner.address, 50, 3600);
      expect(valid).to.be.false;
      expect(dataAge).to.be.gte(7200);
    });

    it("should accept any age when maxAge=0", async function () {
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 85, 10, 850, 90, 2, 1000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      const [valid] = await receiver.isReputableFresh(agentOwner.address, 50, 0);
      expect(valid).to.be.true;
    });

    it("should return valid=false when reputation below threshold even if fresh", async function () {
      const block = await ethers.provider.getBlock("latest");
      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 30, 5, 150, 90, 2, block!.timestamp);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);

      const [valid, rep] = await receiver.isReputableFresh(agentOwner.address, 50, 3600);
      expect(valid).to.be.false;
      expect(rep).to.equal(30);
    });
  });

  describe("ReputationGatedVault", function () {
    let bridgeSenderBytes32: string;
    let arbEndpointAddr: string;

    beforeEach(async function () {
      bridgeSenderBytes32 = ethers.zeroPadValue(await agentBridge.getAddress(), 32);
      arbEndpointAddr = await endpointArb.getAddress();

      const payload = encodePayload(0, agentOwner.address, "ipfs://agent", 85, 10, 850, 90, 2, 1700000000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 1, payload);
    });

    it("should allow deposit from verified agent with sufficient reputation", async function () {
      await vault.connect(agentOwner).deposit({ value: ethers.parseEther("1.0") });
      expect(await vault.balances(agentOwner.address)).to.equal(ethers.parseEther("1.0"));
    });

    it("should reject deposit from unverified address", async function () {
      await expect(
        vault.connect(randomUser).deposit({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(vault, "NotVerifiedAgent");
    });

    it("should reject deposit from agent with low reputation", async function () {
      const payload = encodePayload(1, randomUser.address, "ipfs://low-rep", 20, 2, 40, 50, 1, 1700000000);
      await deliverToReceiver(arbEndpointAddr, receiver, BASE_EID, bridgeSenderBytes32, 2, payload);

      await expect(
        vault.connect(randomUser).deposit({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(vault, "InsufficientReputation");
    });

    it("should allow withdrawal", async function () {
      await vault.connect(agentOwner).deposit({ value: ethers.parseEther("2.0") });
      await vault.connect(agentOwner).withdraw(ethers.parseEther("1.0"));
      expect(await vault.balances(agentOwner.address)).to.equal(ethers.parseEther("1.0"));
    });

    it("should reject withdrawal exceeding balance", async function () {
      await vault.connect(agentOwner).deposit({ value: ethers.parseEther("1.0") });
      await expect(
        vault.connect(agentOwner).withdraw(ethers.parseEther("2.0"))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
  });
});
