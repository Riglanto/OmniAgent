// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/// @title MockIdentityRegistry
/// @notice Minimal ERC-8004 Identity Registry for testing and demo purposes
contract MockIdentityRegistry is ERC721URIStorage, IIdentityRegistry {
    uint256 private _nextTokenId;

    // agentId => key => value
    mapping(uint256 => mapping(string => string)) private _metadata;

    constructor() ERC721("Agent Identity", "AGENT") {}

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextTokenId++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        _setTokenURI(agentId, newURI);
    }

    function setMetadata(uint256 agentId, string calldata key, string calldata value) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        _metadata[agentId][key] = value;
    }

    function getMetadata(uint256 agentId, string calldata key) external view returns (string memory) {
        return _metadata[agentId][key];
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage, IIdentityRegistry)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function ownerOf(uint256 tokenId)
        public
        view
        override(ERC721, IERC721, IIdentityRegistry)
        returns (address)
    {
        return super.ownerOf(tokenId);
    }

    function balanceOf(address owner)
        public
        view
        override(ERC721, IERC721, IIdentityRegistry)
        returns (uint256)
    {
        return super.balanceOf(owner);
    }
}
