// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentBridgeReceiver} from "../bridge/AgentBridgeReceiver.sol";

/// @title ReputationGatedVault
/// @notice Demo contract: an ETH vault that only allows deposits from agents with
///         verified cross-chain identity and a minimum reputation score.
///         Shows why bridging ERC-8004 identity cross-chain matters.
contract ReputationGatedVault {
    AgentBridgeReceiver public immutable bridge;
    int128 public immutable minReputation;

    mapping(address => uint256) public balances;

    event Deposited(address indexed agent, uint256 amount, int128 reputation);
    event Withdrawn(address indexed agent, uint256 amount);

    error NotVerifiedAgent();
    error InsufficientReputation(int128 score, int128 required);
    error InsufficientBalance();

    constructor(address _bridge, int128 _minReputation) {
        bridge = AgentBridgeReceiver(_bridge);
        minReputation = _minReputation;
    }

    /// @notice Deposit ETH — only verified agents with sufficient reputation
    function deposit() external payable {
        (bool exists, int128 rep) = bridge.verifyAgent(msg.sender);
        if (!exists) revert NotVerifiedAgent();
        if (rep < minReputation) revert InsufficientReputation(rep, minReputation);

        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, rep);
    }

    /// @notice Withdraw deposited ETH
    function withdraw(uint256 amount) external {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
}
