// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, MessagingFee, MessagingReceipt, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";
import {IReputationRegistry} from "../interfaces/IReputationRegistry.sol";
import {IValidationRegistry} from "../interfaces/IValidationRegistry.sol";

/// @title AgentBridge
/// @notice Source-chain OApp (deployed on Base) that reads all three ERC-8004 registries
///         (identity, reputation, validation) and bridges agent data cross-chain via LayerZero V2.
contract AgentBridge is OApp {
    // --- State ---
    IIdentityRegistry public immutable identityRegistry;
    IReputationRegistry public immutable reputationRegistry;
    IValidationRegistry public immutable validationRegistry;

    // --- Events ---
    event IdentityBridged(
        uint256 indexed agentId,
        address indexed owner,
        uint32 dstEid,
        bytes32 guid
    );

    // --- Errors ---
    error NotAgentOwner();

    constructor(
        address _endpoint,
        address _delegate,
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        validationRegistry = IValidationRegistry(_validationRegistry);
    }

    /// @notice Bridge an agent's identity + reputation + validation to a destination chain
    function bridgeIdentity(
        uint256 agentId,
        uint32 dstEid,
        bytes calldata options
    ) external payable returns (MessagingReceipt memory receipt) {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        bytes memory payload = _buildPayload(agentId, msg.sender);
        receipt = _lzSend(dstEid, payload, options, MessagingFee(msg.value, 0), payable(msg.sender));
        emit IdentityBridged(agentId, msg.sender, dstEid, receipt.guid);
    }

    /// @notice Bridge identity to multiple destination chains in one transaction
    function bridgeToAll(
        uint256 agentId,
        uint32[] calldata dstEids,
        bytes calldata options
    ) external payable {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        bytes memory payload = _buildPayload(agentId, msg.sender);

        uint256 totalSpent = 0;
        for (uint256 i = 0; i < dstEids.length; i++) {
            MessagingFee memory fee = _quote(dstEids[i], payload, options, false);
            MessagingReceipt memory receipt = _lzSend(
                dstEids[i], payload, options, fee, payable(msg.sender)
            );
            totalSpent += fee.nativeFee;
            emit IdentityBridged(agentId, msg.sender, dstEids[i], receipt.guid);
        }

        if (msg.value > totalSpent) {
            payable(msg.sender).transfer(msg.value - totalSpent);
        }
    }

    /// @notice Estimate total fee for bridging to multiple chains
    function quoteBridgeAll(
        uint256 agentId,
        uint32[] calldata dstEids,
        bytes calldata options
    ) external view returns (uint256 totalFee) {
        bytes memory payload = _buildPayload(agentId, msg.sender);
        for (uint256 i = 0; i < dstEids.length; i++) {
            MessagingFee memory fee = _quote(dstEids[i], payload, options, false);
            totalFee += fee.nativeFee;
        }
    }

    /// @notice Estimate fee for bridging to a single chain
    function quoteBridge(
        uint256 agentId,
        uint32 dstEid,
        bytes calldata options
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = _buildPayload(agentId, msg.sender);
        fee = _quote(dstEid, payload, options, false);
    }

    /// @dev Build the cross-chain payload from all three ERC-8004 registries
    function _buildPayload(uint256 agentId, address owner) internal view returns (bytes memory) {
        string memory agentURI = identityRegistry.tokenURI(agentId);
        IReputationRegistry.ReputationSummary memory rep = reputationRegistry.getSummary(agentId);
        IValidationRegistry.ValidationSummary memory val = validationRegistry.getSummary(agentId);

        return abi.encode(
            agentId,
            owner,
            agentURI,
            rep.averageValue,
            rep.feedbackCount,
            rep.totalValue,
            val.averageScore,
            val.validationCount,
            block.timestamp
        );
    }

    /// @dev This contract only sends, never receives.
    function _lzReceive(
        Origin calldata, bytes32, bytes calldata, address, bytes calldata
    ) internal pure override {
        revert("AgentBridge: receive not supported");
    }
}
