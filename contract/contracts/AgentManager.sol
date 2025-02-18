// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentManager
 * @dev Contract for managing audit agents registration and subscription
 * @notice This contract handles agent registration, subscription management and validation
 */
contract AgentManager is Ownable {
    struct Agent {
        bool isRegistered;
        uint256 subscriptionExpiry;
    }

    // State variables
    uint256 public subscriptionFee; // in Wei
    uint256 public subscriptionDuration; // in seconds
    mapping(address => Agent) public agents;

    // Events
    event AgentRegistered(address indexed agent, uint256 subscriptionExpiry);
    event SubscriptionRenewed(address indexed agent, uint256 newExpiry);
    event SubscriptionFeeUpdated(uint256 newFee);
    event SubscriptionDurationUpdated(uint256 newDuration);

    /**
     * @dev Constructor to initialize the contract with subscription parameters
     * @param _subscriptionFee Fee in Wei required for agent registration
     * @param _subscriptionDuration Duration in seconds for subscription validity
     */
    constructor(uint256 _subscriptionFee, uint256 _subscriptionDuration) Ownable(msg.sender) {
        subscriptionFee = _subscriptionFee;
        subscriptionDuration = _subscriptionDuration;
    }

    /**
     * @dev Register a new agent with subscription fee
     * @notice Agents must pay the subscription fee to register
     */
    function registerAgent() external payable {
        require(msg.value == subscriptionFee, "Invalid subscription fee");
        require(!agents[msg.sender].isRegistered, "Agent already registered");

        agents[msg.sender] = Agent({
            isRegistered: true,
            subscriptionExpiry: block.timestamp + subscriptionDuration
        });

        emit AgentRegistered(msg.sender, block.timestamp + subscriptionDuration);
    }

    /**
     * @dev Renew subscription for an existing agent
     * @notice Only registered agents can renew their subscription
     */
    function renewSubscription() external payable {
        require(agents[msg.sender].isRegistered, "Agent not registered");
        require(msg.value == subscriptionFee, "Invalid subscription fee");

        agents[msg.sender].subscriptionExpiry = block.timestamp + subscriptionDuration;

        emit SubscriptionRenewed(msg.sender, block.timestamp + subscriptionDuration);
    }

    /**
     * @dev Check if an agent is registered and has valid subscription
     * @param _agent Address of the agent to check
     * @return bool True if agent is registered and subscription is valid
     */
    function isValidAgent(address _agent) external view returns (bool) {
        return agents[_agent].isRegistered && agents[_agent].subscriptionExpiry > block.timestamp;
    }

    /**
     * @dev Update subscription fee (only owner)
     * @param _newFee New subscription fee in Wei
     */
    function updateSubscriptionFee(uint256 _newFee) external onlyOwner {
        subscriptionFee = _newFee;
        emit SubscriptionFeeUpdated(_newFee);
    }

    /**
     * @dev Update subscription duration (only owner)
     * @param _newDuration New subscription duration in seconds
     */
    function updateSubscriptionDuration(uint256 _newDuration) external onlyOwner {
        subscriptionDuration = _newDuration;
        emit SubscriptionDurationUpdated(_newDuration);
    }
}
