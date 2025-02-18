import { expect } from "chai"
import { ethers } from "hardhat"
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"

describe("AgentManager", function () {
  // We define the fixtures to isolate each test, making sure that each test starts with a fresh contract
  async function deployAgentManagerFixture() {
    const subscriptionFee = ethers.parseEther("0.1") // 0.1 ETH
    const subscriptionDuration = 30 * 24 * 60 * 60 // 30 days in seconds

    // Get signers
    const [owner, agent1, agent2] = await ethers.getSigners()

    // Deploy AgentManager
    const AgentManager = await ethers.getContractFactory("AgentManager")
    const agentManager = await AgentManager.deploy(
      subscriptionFee,
      subscriptionDuration
    )

    return {
      agentManager,
      subscriptionFee,
      subscriptionDuration,
      owner,
      agent1,
      agent2,
    }
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { agentManager, owner } = await loadFixture(
        deployAgentManagerFixture
      )
      expect(await agentManager.owner()).to.equal(owner.address)
    })

    it("Should set the correct subscription fee", async function () {
      const { agentManager, subscriptionFee } = await loadFixture(
        deployAgentManagerFixture
      )
      expect(await agentManager.subscriptionFee()).to.equal(subscriptionFee)
    })

    it("Should set the correct subscription duration", async function () {
      const { agentManager, subscriptionDuration } = await loadFixture(
        deployAgentManagerFixture
      )
      expect(await agentManager.subscriptionDuration()).to.equal(
        subscriptionDuration
      )
    })
  })

  describe("Agent Registration", function () {
    it("Should allow agent registration with correct fee", async function () {
      const { agentManager, agent1, subscriptionFee } = await loadFixture(
        deployAgentManagerFixture
      )

      await expect(
        agentManager.connect(agent1).registerAgent({
          value: subscriptionFee,
        })
      ).to.not.be.reverted

      const agentInfo = await agentManager.agents(agent1.address)
      expect(agentInfo.isRegistered).to.be.true
    })

    it("Should reject registration with incorrect fee", async function () {
      const { agentManager, agent1, subscriptionFee } = await loadFixture(
        deployAgentManagerFixture
      )

      await expect(
        agentManager.connect(agent1).registerAgent({
          value: subscriptionFee - 1n,
        })
      ).to.be.revertedWith("Invalid subscription fee")
    })

    it("Should reject duplicate registration", async function () {
      const { agentManager, agent1, subscriptionFee } = await loadFixture(
        deployAgentManagerFixture
      )

      await agentManager.connect(agent1).registerAgent({
        value: subscriptionFee,
      })

      await expect(
        agentManager.connect(agent1).registerAgent({
          value: subscriptionFee,
        })
      ).to.be.revertedWith("Agent already registered")
    })
  })

  describe("Subscription Management", function () {
    it("Should allow subscription renewal", async function () {
      const { agentManager, agent1, subscriptionFee } = await loadFixture(
        deployAgentManagerFixture
      )

      // Register first
      await agentManager.connect(agent1).registerAgent({
        value: subscriptionFee,
      })

      // Advance time
      await time.increase(15 * 24 * 60 * 60) // 15 days

      // Renew subscription
      await expect(
        agentManager.connect(agent1).renewSubscription({
          value: subscriptionFee,
        })
      ).to.not.be.reverted
    })

    it("Should reject renewal from unregistered agent", async function () {
      const { agentManager, agent1, subscriptionFee } = await loadFixture(
        deployAgentManagerFixture
      )

      await expect(
        agentManager.connect(agent1).renewSubscription({
          value: subscriptionFee,
        })
      ).to.be.revertedWith("Agent not registered")
    })

    it("Should correctly validate agent status", async function () {
      const { agentManager, agent1, subscriptionFee, subscriptionDuration } =
        await loadFixture(deployAgentManagerFixture)

      // Register agent
      await agentManager.connect(agent1).registerAgent({
        value: subscriptionFee,
      })

      // Check valid status
      expect(await agentManager.isValidAgent(agent1.address)).to.be.true

      // Advance time beyond subscription
      await time.increase(subscriptionDuration + 1)

      // Check expired status
      expect(await agentManager.isValidAgent(agent1.address)).to.be.false
    })
  })

  describe("Owner Functions", function () {
    it("Should allow owner to update subscription fee", async function () {
      const { agentManager, owner } = await loadFixture(
        deployAgentManagerFixture
      )
      const newFee = ethers.parseEther("0.2")

      await expect(agentManager.connect(owner).updateSubscriptionFee(newFee))
        .to.emit(agentManager, "SubscriptionFeeUpdated")
        .withArgs(newFee)

      expect(await agentManager.subscriptionFee()).to.equal(newFee)
    })

    it("Should allow owner to update subscription duration", async function () {
      const { agentManager, owner } = await loadFixture(
        deployAgentManagerFixture
      )
      const newDuration = 60 * 24 * 60 * 60 // 60 days

      await expect(
        agentManager.connect(owner).updateSubscriptionDuration(newDuration)
      )
        .to.emit(agentManager, "SubscriptionDurationUpdated")
        .withArgs(newDuration)

      expect(await agentManager.subscriptionDuration()).to.equal(newDuration)
    })

    it("Should reject non-owner from updating subscription fee", async function () {
      const { agentManager, agent1 } = await loadFixture(
        deployAgentManagerFixture
      )
      const newFee = ethers.parseEther("0.2")

      await expect(
        agentManager.connect(agent1).updateSubscriptionFee(newFee)
      ).to.be.revertedWithCustomError(
        agentManager,
        "OwnableUnauthorizedAccount"
      )
    })
  })
})
