# OmniAgent — Cross-Chain Agent Identity Bridge

## Project Overview

GitHub: https://github.com/Riglanto/OmniAgent

LayerZero V2 OApp that bridges ERC-8004 agent identity and reputation from Base to other chains (Arbitrum, Optimism). Includes a self-sovereign autonomous agent that monitors registrations and auto-bridges qualified agents. Built for The Synthesis hackathon.

## Key Contracts

- `contracts/bridge/AgentBridge.sol` — Source chain OApp (Base). Reads identity + reputation registries, encodes payload, sends via `_lzSend()`. Only the agent owner can bridge. Supports `bridgeToAll(agentId, dstEids[], options)` for batch multi-chain bridging with automatic fee quoting and refund.
- `contracts/bridge/AgentBridgeReceiver.sol` — Destination chain OApp. Receives via `_lzReceive()`, caches identity in `identities` mapping. Verification API:
  - `verifyAgent(address)` → (bool exists, int128 reputationAvg)
  - `isReputable(address, int128 minScore)` → bool
  - `isReputableFresh(address, int128 minScore, uint256 maxAge)` → (bool valid, int128 rep, uint256 dataAge) — freshness-aware check where the consumer decides how fresh data must be (maxAge=0 means any age)
- `contracts/demo/ReputationGatedVault.sol` — Demo vault that gates `deposit()` by verified cross-chain identity + minimum reputation score.
- `contracts/interfaces/` — `IIdentityRegistry` and `IReputationRegistry` matching ERC-8004 spec.
- `contracts/mocks/` — Mock implementations of the registries for testing/demo.

## Autonomous Agent

- `agent/bridge-agent.ts` — Full discover → analyze → decide → execute → verify loop:
  1. **Discover**: Monitors Identity Registry Transfer events for new mints
  2. **Analyze**: Reads owner, URI, reputation score/count from on-chain registries
  3. **Decide**: Bridges if reputation >= threshold AND has reviews; skips with reason logged
  4. **Execute**: Calls `bridgeToAll()` to all destination chains in one transaction
  5. **Verify**: Confirms transaction receipt, logs results
  - Produces structured `conversationLog` (JSON) for hackathon submission
  - Run demo: `npx hardhat run agent/bridge-agent.ts`
  - Run live: set env vars IDENTITY_REG, REPUTATION_REG, BRIDGE_ADDR, DEST_EIDS, RECEIVER_ADDRS

## Tech Stack

- Solidity 0.8.27, EVM target: cancun
- Hardhat + hardhat-deploy
- @layerzerolabs/oapp-evm (OApp base class)
- @openzeppelin/contracts v5 (ERC721, Ownable)
- ethers v6

## Commands

```bash
npm install --legacy-peer-deps
npx hardhat compile
npx hardhat test                          # 17 tests
npx hardhat run agent/bridge-agent.ts     # autonomous agent demo
```

## Testing Pattern

Tests use Hardhat account impersonation to simulate LayerZero message delivery:
1. `hardhat_setBalance` on the endpoint contract address
2. `hardhat_impersonateAccount` for the endpoint
3. Call `receiver.lzReceive(origin, guid, payload, executor, extraData)` from the impersonated endpoint
4. `hardhat_stopImpersonatingAccount`

This bypasses the full LZ mock setup (which requires registered libraries, etc.).

## Architecture Notes

- **Global Agent ID**: `keccak256(abi.encode(srcEid, agentId))` — unique across chains
- **Payload encoding**: `abi.encode(agentId, owner, agentURI, reputationAvg, reputationCount, reputationTotal, timestamp)`
- AgentBridge is send-only (`_lzReceive` reverts). AgentBridgeReceiver is receive-only (no send functions).
- `bridgeToAll()` iterates destinations, quotes each fee individually, sends all, refunds excess ETH.
- `isReputableFresh()` computes `dataAge = block.timestamp - bridgedAt` and checks against caller-provided `maxAge`.
- Peers must be set on both sides via `setPeer(eid, bytes32Address)`.
- The `Ownable(_delegate)` constructor must be explicitly called alongside `OApp(_endpoint, _delegate)` due to OZ v5 requiring `initialOwner`.

## Deploy Flow

1. Deploy registries on Base (testnet only — mainnet uses real ERC-8004)
2. Deploy AgentBridge on Base
3. Deploy AgentBridgeReceiver + ReputationGatedVault on destination chains
4. Wire peers: `setPeer` on both bridge and receiver
5. Register agent → give reputation → run autonomous agent OR manually bridge

## LZ Endpoint Addresses

- Mainnet (all chains): `0x1a44076050125825900e736c501f859c50fE728c`
- Testnet (all chains): `0x6EDCE65403992e310A62460808c4b910D972f10f`
