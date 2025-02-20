// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentManager
 * @dev Contract for managing audit agents registration with suspension capability
 * @notice This contract handles agent registration, suspension and reactivation of agent
 */
contract AgentManager is Ownable {
    struct Agent {
        bool isRegistered;
        bool isActive;
    }

    // State variables
    mapping(address => Agent) public agents;
    mapping(address => bool) public admins;

    // Events
    event AgentRegistered(address indexed agent);
    event AgentDeregistered(address indexed agent);
    event AgentSuspended(address indexed agent);
    event AgentReactivated(address indexed agent);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    /**
     * @dev Modifier to make a function callable only by admin accounts.
     * Reverts with "Not authorized" if the caller is not an admin.
     */
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not authorized");
        _;
    }

    /**
     * @dev Constructor to initialize the contract with subscription parameters
     */
    constructor() Ownable(msg.sender) {
        admins[msg.sender] = true; // Set deployer as initial admin
        emit AdminAdded(msg.sender);
    }

    /**
     * @dev Add a new admin
     * @param _admin Address of the new admin
     * @notice Only owner can add admins
     */
    function addAdmin(address _admin) external onlyOwner {
        require(!admins[_admin], "Already an admin");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @dev Remove an admin
     * @param _admin Address of the admin to remove
     * @notice Only owner can remove admins
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(admins[_admin], "Not an admin");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /**
     * @dev Register a new agent.
     */
    function registerAgent() external payable {
        require(!agents[msg.sender].isRegistered, "Agent already registered");

        agents[msg.sender] = Agent(true, true);

        emit AgentRegistered(msg.sender);
    }

    /**
     * @dev Deregister an agent
     * @notice Only registered agents can deregister
     */
    function deregisterAgent() external {
        require(agents[msg.sender].isRegistered, "Not registered");
        delete agents[msg.sender];
        emit AgentDeregistered(msg.sender);
    }

    /**
     * @dev Suspend an agent for abuse
     * @param _agent Address of the agent to suspend
     * @notice Only admins can suspend an agent
     */
    function suspendAgent(address _agent) external onlyAdmin {
        require(agents[_agent].isRegistered, "Agent not registered");
        require(agents[_agent].isActive, "Agent already suspended");
        agents[_agent].isActive = false;
        emit AgentSuspended(_agent);
    }

    /**
     * @dev Reactivate a suspended agent
     * @param _agent Address of the agent to reactivate
     * @notice Only admins can reactivate an agent
     */
    function reactivateAgent(address _agent) external onlyAdmin {
        require(agents[_agent].isRegistered, "Agent not registered");
        require(!agents[_agent].isActive, "Agent already active");
        agents[_agent].isActive = true;
        emit AgentReactivated(_agent);
    }

    /**
     * @dev Check if an agent is registered and not suspended
     * @param _agent Address of the agent to check
     * @return bool True if agent is registered and active
     */
    function isValidAgent(address _agent) external view returns (bool) {
        return agents[_agent].isRegistered && agents[_agent].isActive;
    }
}
