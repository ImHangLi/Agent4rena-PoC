import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const AgentsModule = buildModule("AgentsModule", m => {
  // Deploy AgentManager first
  const subscriptionFee = m.getParameter(
    "subscriptionFee",
    "100000000000000000"
  ) // 0.1 ETH
  const subscriptionDuration = m.getParameter("subscriptionDuration", "2592000") // 30 days in seconds

  const agentManager = m.contract("AgentManager", [
    subscriptionFee,
    subscriptionDuration,
  ])

  // Deploy TaskManager with AgentManager address
  const taskManager = m.contract("TaskManager", [agentManager])

  return { agentManager, taskManager }
})

export default AgentsModule
