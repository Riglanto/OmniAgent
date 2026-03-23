// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentBridgeReceiver
/// @notice Destination-chain OApp that caches bridged ERC-8004 agent identities
///         (identity + reputation + validation) and exposes a public verification API.
contract AgentBridgeReceiver is OApp {
    // --- Types ---
    struct AgentIdentity {
        uint256 agentId;
        address owner;
        string agentURI;
        int128 reputationAvg;
        uint256 reputationCount;
        int128 reputationTotal;
        uint8 validationAvg;
        uint256 validationCount;
        uint256 bridgedAt;
        uint32 sourceChainEid;
    }

    // --- State ---

    /// @notice Global agent ID (hash of sourceEid + agentId) => cached identity
    mapping(bytes32 => AgentIdentity) public identities;

    /// @notice Owner address => global agent ID (latest bridged identity)
    mapping(address => bytes32) public ownerToAgent;

    /// @notice All bridged global agent IDs
    bytes32[] public allAgents;

    // --- Events ---
    event AgentIdentityBridged(
        bytes32 indexed globalId,
        uint256 indexed agentId,
        address indexed owner,
        uint32 sourceChainEid
    );

    constructor(address _endpoint, address _delegate) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    // --- LayerZero Receive ---

    function _lzReceive(
        Origin calldata _origin,
        bytes32,
        bytes calldata _message,
        address,
        bytes calldata
    ) internal override {
        _processIdentity(_origin.srcEid, _message);
    }

    function _processIdentity(uint32 srcEid, bytes calldata _message) internal {
        // Decode in two stages to avoid stack-too-deep
        (uint256 agentId, address owner, string memory agentURI) =
            _decodeHeader(_message);

        bytes32 globalId = computeGlobalId(srcEid, agentId);
        if (identities[globalId].bridgedAt == 0) {
            allAgents.push(globalId);
        }

        AgentIdentity storage identity = identities[globalId];
        identity.agentId = agentId;
        identity.owner = owner;
        identity.agentURI = agentURI;
        identity.sourceChainEid = srcEid;

        _decodeScores(_message, identity);

        ownerToAgent[owner] = globalId;
        emit AgentIdentityBridged(globalId, agentId, owner, srcEid);
    }

    function _decodeHeader(bytes calldata _message) internal pure returns (
        uint256 agentId, address owner, string memory agentURI
    ) {
        (agentId, owner, agentURI,,,,,,) = abi.decode(
            _message, (uint256, address, string, int128, uint256, int128, uint8, uint256, uint256)
        );
    }

    function _decodeScores(bytes calldata _message, AgentIdentity storage identity) internal {
        (,,,
            int128 reputationAvg,
            uint256 reputationCount,
            int128 reputationTotal,
            uint8 validationAvg,
            uint256 validationCount,
            uint256 bridgedAt
        ) = abi.decode(_message, (uint256, address, string, int128, uint256, int128, uint8, uint256, uint256));

        identity.reputationAvg = reputationAvg;
        identity.reputationCount = reputationCount;
        identity.reputationTotal = reputationTotal;
        identity.validationAvg = validationAvg;
        identity.validationCount = validationCount;
        identity.bridgedAt = bridgedAt;
    }

    // --- Public Verification API ---

    /// @notice Check if an address has a bridged agent identity and return its reputation
    function verifyAgent(address agent) external view returns (bool exists, int128 reputationAvg) {
        bytes32 gid = ownerToAgent[agent];
        if (gid == bytes32(0)) return (false, 0);
        return (true, identities[gid].reputationAvg);
    }

    /// @notice Full verification: identity + reputation + validation + freshness
    function verifyAgentFull(address agent) external view returns (
        bool exists,
        int128 reputationAvg,
        uint256 reputationCount,
        uint8 validationAvg,
        uint256 validationCount,
        uint256 dataAge
    ) {
        bytes32 gid = ownerToAgent[agent];
        if (gid == bytes32(0)) return (false, 0, 0, 0, 0, 0);

        AgentIdentity storage id = identities[gid];
        return (
            true,
            id.reputationAvg,
            id.reputationCount,
            id.validationAvg,
            id.validationCount,
            block.timestamp - id.bridgedAt
        );
    }

    /// @notice Check if an agent meets a minimum reputation threshold
    function isReputable(address agent, int128 minScore) external view returns (bool) {
        bytes32 gid = ownerToAgent[agent];
        if (gid == bytes32(0)) return false;
        return identities[gid].reputationAvg >= minScore;
    }

    /// @notice Freshness-aware reputation check — consumer decides how fresh data must be
    function isReputableFresh(
        address agent,
        int128 minScore,
        uint256 maxAge
    ) external view returns (bool valid, int128 reputationAvg, uint256 dataAge) {
        bytes32 gid = ownerToAgent[agent];
        if (gid == bytes32(0)) return (false, 0, 0);

        AgentIdentity storage id = identities[gid];
        reputationAvg = id.reputationAvg;
        dataAge = block.timestamp - id.bridgedAt;

        valid = id.reputationAvg >= minScore && (maxAge == 0 || dataAge <= maxAge);
    }

    /// @notice Check if agent is both reputable AND validated
    function isVerifiedAgent(
        address agent,
        int128 minReputation,
        uint8 minValidation
    ) external view returns (bool) {
        bytes32 gid = ownerToAgent[agent];
        if (gid == bytes32(0)) return false;

        AgentIdentity storage id = identities[gid];
        return id.reputationAvg >= minReputation && id.validationAvg >= minValidation;
    }

    /// @notice Get full bridged identity for an agent
    function getIdentity(bytes32 globalId) external view returns (AgentIdentity memory) {
        return identities[globalId];
    }

    /// @notice Get full identity by owner address
    function getIdentityByOwner(address owner) external view returns (AgentIdentity memory) {
        return identities[ownerToAgent[owner]];
    }

    /// @notice Get the total number of bridged agents
    function getBridgedAgentCount() external view returns (uint256) {
        return allAgents.length;
    }

    // --- Utilities ---

    /// @notice Compute the global agent ID from source chain EID and agent token ID
    function computeGlobalId(uint32 srcEid, uint256 agentId) public pure returns (bytes32) {
        return keccak256(abi.encode(srcEid, agentId));
    }
}
