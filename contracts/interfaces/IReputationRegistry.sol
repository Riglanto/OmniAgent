// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IReputationRegistry
/// @notice Minimal ERC-8004 Reputation Registry interface
interface IReputationRegistry {
    struct FeedbackEntry {
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    struct ReputationSummary {
        int128 totalValue;
        uint256 feedbackCount;
        int128 averageValue;
    }

    /// @notice Submit feedback for an agent
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2
    ) external;

    /// @notice Revoke previously given feedback
    function revokeFeedback(uint256 agentId, uint256 feedbackIndex) external;

    /// @notice Get aggregated reputation summary for an agent
    function getSummary(uint256 agentId) external view returns (ReputationSummary memory);

    /// @notice Get the number of feedback entries for an agent
    function getFeedbackCount(uint256 agentId) external view returns (uint256);
}
