import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"

describe("TaskManager", function () {
  async function deployTaskManagerFixture() {
    // Deploy AgentManager first
    const subscriptionFee = ethers.parseEther("0.1") // 0.1 ETH
    const subscriptionDuration = 30 * 24 * 60 * 60 // 30 days in seconds

    const [owner, submitter, agent1, agent2] = await ethers.getSigners()

    const AgentManager = await ethers.getContractFactory("AgentManager")
    const agentManager = await AgentManager.deploy(
      subscriptionFee,
      subscriptionDuration
    )

    // Deploy TaskManager
    const TaskManager = await ethers.getContractFactory("TaskManager")
    const taskManager = await TaskManager.deploy(
      await agentManager.getAddress()
    )

    // Register agents
    await agentManager.connect(agent1).registerAgent({ value: subscriptionFee })
    await agentManager.connect(agent2).registerAgent({ value: subscriptionFee })

    return {
      taskManager,
      agentManager,
      owner,
      submitter,
      agent1,
      agent2,
      subscriptionFee,
    }
  }

  describe("Task Creation", function () {
    it("Should create a new task with correct parameters", async function () {
      const { taskManager, submitter } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")

      await expect(
        taskManager
          .connect(submitter)
          .createTask(taskId, repoHash, bounty, { value: bounty })
      )
        .to.emit(taskManager, "TaskCreated")
        .withArgs(taskId, repoHash, bounty, submitter.address)

      const task = await taskManager.getTaskInfo(taskId)
      expect(task.taskId).to.equal(taskId)
      expect(task.repoHash).to.equal(repoHash)
      expect(task.bounty).to.equal(bounty)
      expect(task.submitter).to.equal(submitter.address)
      expect(task.status).to.equal(0) // Created status
    })

    it("Should reject task creation with empty task ID", async function () {
      const { taskManager, submitter } = await loadFixture(
        deployTaskManagerFixture
      )
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")

      await expect(
        taskManager
          .connect(submitter)
          .createTask("", repoHash, bounty, { value: bounty })
      ).to.be.revertedWith("Task ID cannot be empty")
    })

    it("Should reject task creation with mismatched bounty", async function () {
      const { taskManager, submitter } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")

      await expect(
        taskManager
          .connect(submitter)
          .createTask(taskId, repoHash, bounty, { value: bounty - 1n })
      ).to.be.revertedWith("Sent ETH must match bounty amount")
    })
  })

  describe("Task Submission", function () {
    it("Should allow registered agent to submit work", async function () {
      const { taskManager, submitter, agent1 } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")
      const workHash = ethers.keccak256(ethers.toUtf8Bytes("work-submission"))

      // Create task
      await taskManager
        .connect(submitter)
        .createTask(taskId, repoHash, bounty, { value: bounty })

      // Submit work
      await expect(taskManager.connect(agent1).submitWork(taskId, workHash))
        .to.emit(taskManager, "WorkSubmitted")
        .withArgs(taskId, agent1.address, workHash)
    })

    it("Should reject submission from unregistered agent", async function () {
      const { taskManager, submitter } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")
      const workHash = ethers.keccak256(ethers.toUtf8Bytes("work-submission"))

      // Create task
      await taskManager
        .connect(submitter)
        .createTask(taskId, repoHash, bounty, { value: bounty })

      // Try to submit work with unregistered address
      await expect(
        taskManager.connect(submitter).submitWork(taskId, workHash)
      ).to.be.revertedWith("Agent is not registered")
    })

    it("Should reject duplicate submissions", async function () {
      const { taskManager, submitter, agent1 } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")
      const workHash = ethers.keccak256(ethers.toUtf8Bytes("work-submission"))

      // Create task
      await taskManager
        .connect(submitter)
        .createTask(taskId, repoHash, bounty, { value: bounty })

      // Submit work
      await taskManager.connect(agent1).submitWork(taskId, workHash)

      // Try to submit again
      await expect(
        taskManager.connect(agent1).submitWork(taskId, workHash)
      ).to.be.revertedWith("Agent has already submitted")
    })
  })

  describe("Task Management", function () {
    it("Should allow owner to record unique findings", async function () {
      const { taskManager, submitter, agent1, owner } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")
      const workHash = ethers.keccak256(ethers.toUtf8Bytes("work-submission"))
      const uniqueCount = ethers.keccak256(ethers.toUtf8Bytes("5")) // Representing 5 unique findings

      // Create and submit task
      await taskManager
        .connect(submitter)
        .createTask(taskId, repoHash, bounty, { value: bounty })
      await taskManager.connect(agent1).submitWork(taskId, workHash)

      // Record findings
      await expect(
        taskManager
          .connect(owner)
          .recordUniqueFindings(taskId, agent1.address, uniqueCount)
      )
        .to.emit(taskManager, "UniqueFindingsRecorded")
        .withArgs(taskId, agent1.address, uniqueCount)

      expect(
        await taskManager.getUniqueFindings(taskId, agent1.address)
      ).to.equal(uniqueCount)
    })

    it("Should allow submitter to close task and distribute bounty", async function () {
      const { taskManager, submitter, agent1, owner } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")
      const workHash = ethers.keccak256(ethers.toUtf8Bytes("work-submission"))
      const uniqueCount = ethers.keccak256(ethers.toUtf8Bytes("5"))

      // Create and submit task
      await taskManager
        .connect(submitter)
        .createTask(taskId, repoHash, bounty, { value: bounty })
      await taskManager.connect(agent1).submitWork(taskId, workHash)
      await taskManager
        .connect(owner)
        .recordUniqueFindings(taskId, agent1.address, uniqueCount)

      // Close task
      await expect(taskManager.connect(submitter).closeTask(taskId))
        .to.emit(taskManager, "TaskClosed")
        .withArgs(taskId)

      const task = await taskManager.getTaskInfo(taskId)
      expect(task.status).to.equal(3) // Closed status
    })

    it("Should allow task cancellation when no submissions", async function () {
      const { taskManager, submitter } = await loadFixture(
        deployTaskManagerFixture
      )
      const taskId = "TASK-001"
      const repoHash = ethers.keccak256(ethers.toUtf8Bytes("repo-url"))
      const bounty = ethers.parseEther("1.0")

      // Create task
      await taskManager
        .connect(submitter)
        .createTask(taskId, repoHash, bounty, { value: bounty })

      // Cancel task
      await expect(taskManager.connect(submitter).cancelTask(taskId))
        .to.emit(taskManager, "TaskCancelled")
        .withArgs(taskId)

      const task = await taskManager.getTaskInfo(taskId)
      expect(task.status).to.equal(2) // Cancelled status
    })
  })
})
