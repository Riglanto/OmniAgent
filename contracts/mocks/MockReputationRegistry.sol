// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReputationRegistry} from "../interfaces/IReputationRegistry.sol";

/// @title MockReputationRegistry
/// @notice Minimal ERC-8004 Reputation Registry for testing and demo purposes
contract MockReputationRegistry is IReputationRegistry {
    // agentId => feedback entries
    mapping(uint256 => FeedbackEntry[]) private _feedback;

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2
    ) external {
        _feedback[agentId].push(
            FeedbackEntry({
                client: msg.sender,
                value: value,
                valueDecimals: valueDecimals,
                tag1: tag1,
                tag2: tag2,
                isRevoked: false
            })
        );
    }

    function revokeFeedback(uint256 agentId, uint256 feedbackIndex) external {
        FeedbackEntry storage entry = _feedback[agentId][feedbackIndex];
        require(entry.client == msg.sender, "Not feedback author");
        entry.isRevoked = true;
    }

    function getSummary(uint256 agentId) external view returns (ReputationSummary memory summary) {
        FeedbackEntry[] storage entries = _feedback[agentId];
        int128 total = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < entries.length; i++) {
            if (!entries[i].isRevoked) {
                total += entries[i].value;
                count++;
            }
        }

        summary.totalValue = total;
        summary.feedbackCount = count;
        summary.averageValue = count > 0 ? total / int128(int256(count)) : int128(0);
    }

    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return _feedback[agentId].length;
    }
}
