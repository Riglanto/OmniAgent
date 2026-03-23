// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IValidationRegistry} from "../interfaces/IValidationRegistry.sol";

/// @title MockValidationRegistry
/// @notice Minimal ERC-8004 Validation Registry for testing and demo purposes
contract MockValidationRegistry is IValidationRegistry {
    // requestHash => response
    mapping(bytes32 => ValidationResponse) private _responses;

    // requestHash => request
    mapping(bytes32 => ValidationRequest) private _requests;

    // agentId => request hashes
    mapping(uint256 => bytes32[]) private _agentValidations;

    // requestHash => designated validator
    mapping(bytes32 => address) private _validators;

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        _requests[requestHash] = ValidationRequest({
            requester: msg.sender,
            agentId: agentId,
            validator: validatorAddress,
            requestHash: requestHash,
            requestURI: requestURI
        });
        _validators[requestHash] = validatorAddress;
        _agentValidations[agentId].push(requestHash);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        require(_validators[requestHash] == msg.sender, "Not designated validator");
        require(response <= 100, "Score must be 0-100");

        _responses[requestHash] = ValidationResponse({
            response: response,
            tag: tag,
            responseURI: responseURI,
            responseHash: responseHash,
            exists: true
        });
    }

    function getValidationStatus(bytes32 requestHash) external view returns (ValidationResponse memory) {
        return _responses[requestHash];
    }

    function getSummary(uint256 agentId) external view returns (ValidationSummary memory summary) {
        bytes32[] storage hashes = _agentValidations[agentId];
        uint256 total = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationResponse storage resp = _responses[hashes[i]];
            if (resp.exists) {
                total += resp.response;
                count++;
            }
        }

        summary.validationCount = count;
        summary.totalScore = total;
        summary.averageScore = count > 0 ? uint8(total / count) : 0;
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }
}
