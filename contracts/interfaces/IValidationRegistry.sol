// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IValidationRegistry
/// @notice Minimal ERC-8004 Validation Registry interface.
///         Agents request independent verification; validators respond with scores.
interface IValidationRegistry {
    struct ValidationRequest {
        address requester;
        uint256 agentId;
        address validator;
        bytes32 requestHash;
        string requestURI;
    }

    struct ValidationResponse {
        uint8 response;       // 0-100 score
        string tag;
        string responseURI;
        bytes32 responseHash;
        bool exists;
    }

    struct ValidationSummary {
        uint256 validationCount;
        uint256 totalScore;
        uint8 averageScore;
    }

    /// @notice Agent requests validation from a specific validator
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external;

    /// @notice Validator responds with a score (0-100)
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;

    /// @notice Get validation status for a specific request
    function getValidationStatus(bytes32 requestHash) external view returns (ValidationResponse memory);

    /// @notice Get aggregated validation summary for an agent
    function getSummary(uint256 agentId) external view returns (ValidationSummary memory);

    /// @notice Get all validation request hashes for an agent
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory);
}
