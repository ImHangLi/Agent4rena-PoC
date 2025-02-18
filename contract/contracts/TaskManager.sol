// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AgentManager.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TaskManager
 * @dev Contract for managing audit tasks, submissions, and bounty distribution
 * @notice This contract handles the creation, submission, and completion of audit tasks
 */
contract TaskManager is Ownable {
    struct Task {
        string taskId;
        bytes32 repoHash;
        uint256 bounty;
        address submitter;
        TaskStatus status;
        uint256 totalUniqueFindings;
    }

    enum TaskStatus { Created, Submitted, Cancelled, Closed }

    // State variables
    AgentManager public immutable agentManager; // immutable to save gas

    // Mappings
    mapping(string => Task) public tasks;
    mapping(string => mapping(address => bool)) public hasSubmitted;
    mapping(string => mapping(address => bytes32)) public uniqueFindings;

    // Task tracking
    string[] public taskIds;

    // Events
    event TaskCreated(string indexed taskId, bytes32 repoHash, uint256 bounty, address submitter);
    event WorkSubmitted(string indexed taskId, address submitter, bytes32 workHash);
    event TaskCancelled(string indexed taskId);
    event TaskClosed(string indexed taskId);
    event UniqueFindingsRecorded(string indexed taskId, address indexed agent, bytes32 uniqueCount);

    /**
     * @dev Constructor to initialize the contract with AgentManager reference
     * @param _agentManager Address of the AgentManager contract
     */
    constructor(address _agentManager) Ownable(msg.sender) {
        require(_agentManager != address(0), "Invalid agent manager address");
        agentManager = AgentManager(_agentManager);
    }

    /**
     * @dev Create a new audit task with bounty
     * @param _taskId Unique identifier for the task
     * @param _repoHash Hash of the repository to be audited
     * @param _bounty Amount of ETH to be locked as bounty
     */
    function createTask(
        string calldata _taskId,
        bytes32 _repoHash,
        uint256 _bounty
    ) external payable {
        require(bytes(_taskId).length > 0, "Task ID cannot be empty");
        require(tasks[_taskId].submitter == address(0), "Task already exists");
        require(_repoHash != bytes32(0), "Repo hash cannot be empty");
        require(msg.value == _bounty, "Sent ETH must match bounty amount");

        tasks[_taskId] = Task({
            taskId: _taskId,
            repoHash: _repoHash,
            bounty: _bounty,
            submitter: msg.sender,
            status: TaskStatus.Created,
            totalUniqueFindings: 0
        });

        taskIds.push(_taskId);
        emit TaskCreated(_taskId, _repoHash, _bounty, msg.sender);
    }

    /**
     * @dev Cancel a task and return the bounty to submitter
     * @param _taskId ID of the task to cancel
     */
    function cancelTask(string calldata _taskId) external {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Created, "Task is not in created state");
        require(task.submitter == msg.sender, "Only submitter can cancel");
        require(uniqueFindings[_taskId][msg.sender] == bytes32(0), "Task has unique findings");

        task.status = TaskStatus.Cancelled;

        (bool sent, ) = task.submitter.call{value: task.bounty}("");
        require(sent, "Failed to return bounty");

        emit TaskCancelled(_taskId);
    }

    /**
     * @dev Submit work for a task
     * @param _taskId ID of the task
     * @param _workHash Hash of the submitted work
     */
    function submitWork(string calldata _taskId, bytes32 _workHash) external {
        Task storage task = tasks[_taskId];
        require(task.submitter != address(0), "Task does not exist");
        require(task.status == TaskStatus.Created, "Task is not in created state");
        require(agentManager.isValidAgent(msg.sender), "Agent is not registered");
        require(!hasSubmitted[_taskId][msg.sender], "Agent has already submitted");
        require(task.submitter != msg.sender, "Submitter cannot submit work");

        hasSubmitted[_taskId][msg.sender] = true;
        emit WorkSubmitted(_taskId, msg.sender, _workHash);
    }

    /**
     * @dev Record unique findings for an agent's submission
     * @param _taskId ID of the task
     * @param agentAddress Address of the submitting agent
     * @param uniqueCount Hash representing the count of unique findings
     */
    function recordUniqueFindings(
        string calldata _taskId,
        address agentAddress,
        bytes32 uniqueCount
    ) external onlyOwner {
        Task storage task = tasks[_taskId];
        require(task.submitter != address(0), "Task does not exist");
        require(task.status == TaskStatus.Created, "Task is not in created state");
        require(task.submitter != agentAddress, "Submitter cannot record findings");
        require(agentManager.isValidAgent(agentAddress), "Agent is not registered");
        require(hasSubmitted[_taskId][agentAddress], "Agent has not submitted work");

        uniqueFindings[_taskId][agentAddress] = uniqueCount;
        task.totalUniqueFindings++;
        task.status = TaskStatus.Submitted;

        emit UniqueFindingsRecorded(_taskId, agentAddress, uniqueCount);
    }

    /**
     * @dev Get unique findings count for an agent
     * @param _taskId ID of the task
     * @param agentAddress Address of the agent
     * @return bytes32 Hash representing unique findings count
     */
    function getUniqueFindings(
        string calldata _taskId,
        address agentAddress
    ) external view returns (bytes32) {
        return uniqueFindings[_taskId][agentAddress];
    }

    /**
     * @dev Get task information
     * @param _taskId ID of the task
     * @return Task struct containing task information
     */
    function getTaskInfo(string calldata _taskId) external view returns (Task memory) {
        return tasks[_taskId];
    }

    /**
     * @dev Close a task and distribute bounty
     * @param _taskId ID of the task to close
     */
    function closeTask(string calldata _taskId) external {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Submitted, "Task is not submitted");
        require(task.submitter == msg.sender, "Only submitter can close");
        require(task.totalUniqueFindings > 0, "No unique findings to distribute bounty");

        // Calculate and distribute bounty based on unique findings
        // FIXME: Need to adjust bounty distribution based on severity of findings
        uint256 bountyPerFinding = task.bounty / task.totalUniqueFindings;

        for (uint256 i = 0; i < taskIds.length; i++) {
            address agent = address(uint160(uint256(uniqueFindings[_taskId][msg.sender])));
            if (uniqueFindings[_taskId][agent] != bytes32(0)) {
                uint256 agentBounty = bountyPerFinding * uint256(uint8(bytes1(uniqueFindings[_taskId][agent])));
                (bool sent, ) = agent.call{value: agentBounty}("");
                require(sent, "Failed to send bounty to agent");
            }
        }

        task.status = TaskStatus.Closed;
        emit TaskClosed(_taskId);
    }
}