// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdentityRegistry
/// @notice Minimal ERC-8004 Identity Registry interface (ERC-721 + agent metadata)
interface IIdentityRegistry {
    /// @notice Register a new agent, minting an NFT identity
    /// @param agentURI The URI pointing to the agent's registration file (JSON)
    /// @return agentId The newly minted token ID
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Update an agent's registration URI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice Store on-chain metadata key-value pair for an agent
    function setMetadata(uint256 agentId, string calldata key, string calldata value) external;

    /// @notice Read on-chain metadata
    function getMetadata(uint256 agentId, string calldata key) external view returns (string memory);

    // --- ERC-721 subset ---
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function balanceOf(address owner) external view returns (uint256);
}
