# Agent4rena Smart Contracts

This project contains the smart contracts for the Agent4rena platform, which manages audit agents and tasks.

## Contracts

- `AgentManager.sol`: Manages agent registration and subscription
- `TaskManager.sol`: Handles audit tasks, submissions, and bounty distribution

## Development

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy contracts
npx hardhat ignition deploy ./ignition/modules/Agents.ts
```

## Contract Architecture

### AgentManager
- Handles agent registration and subscription management
- Manages subscription fees and durations
- Validates agent status

### TaskManager
- Creates and manages audit tasks
- Handles work submissions from agents
- Manages bounty distribution
- Tracks unique findings per task

## License


