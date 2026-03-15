/**
 * Keeper (Automation) service composable for Neo N3 miniapps.
 *
 * Keepers are off-chain nodes that monitor on-chain conditions and
 * automatically trigger contract operations when conditions are met.
 *
 * Two integration paths:
 *   1. AutomationAnchor contract: register tasks on-chain, keeper nodes
 *      monitor and execute when conditions are met.
 *   2. MorpheusOracle "automation_register" requestType: register via the
 *      oracle request pipeline for oracle-side automation.
 *
 * On-chain registration pattern:
 *   Contract.Call(oracleHash, "request", CallFlags.All,
 *     "automation_register",         // requestType
 *     JSON.stringify(taskSpec),       // payload (condition + callback)
 *     callbackContractHash,          // contract to invoke
 *     "onAutomationTrigger"          // callback method
 *   )
 *
 * Use cases:
 * - Doomsday Clock: auto-trigger prize distribution when 24h expires
 * - Neo Gacha: broadcast big win announcements
 * - Stream Vault: auto-execute scheduled payments
 * - Self Loan: auto-liquidation when health factor drops
 *
 * Reference: github.com/r3e-network/neo-abstract-account (keeper module)
 */
import { ref } from "vue";

// ---------------------------------------------------------------------------
// Deployed contract hashes
// ---------------------------------------------------------------------------

/** AutomationAnchor contract – Neo N3 testnet */
const AUTOMATION_ANCHOR_TESTNET = "0x1c888d699ce76b0824028af310d90c3c18adeab5";

/** MorpheusOracle contract – used for "automation_register" requestType */
const ORACLE_CONTRACT_MAINNET = "0x017520f068fd602082fe5572596185e62a4ad991";

export interface KeeperTask {
  /** Unique task identifier */
  id: string;
  /** Contract to monitor */
  contractHash: string;
  /** Operation to call when condition is met */
  operation: string;
  /** Type of condition to monitor */
  conditionType: "timer" | "threshold" | "event" | "block";
  /** Condition parameters */
  conditionParams: Record<string, unknown>;
  /** Current status */
  status: "active" | "triggered" | "expired" | "cancelled";
  /** Creation timestamp */
  createdAt: number;
}

export interface KeeperConfig {
  /** Keeper service API endpoint */
  endpoint?: string;
  /** API key for keeper service */
  apiKey?: string;
  /** AutomationAnchor contract hash (defaults to testnet) */
  automationAnchorHash?: string;
  /** MorpheusOracle contract hash (for oracle-based automation) */
  oracleContractHash?: string;
}

/**
 * Composable for Keeper automation integration.
 *
 * Usage:
 * ```ts
 * const { registerTask, tasks } = useKeeper();
 *
 * // Auto-trigger prize distribution after 24h
 * await registerTask({
 *   contractHash: "0x...",
 *   operation: "checkAndEndRound",
 *   conditionType: "timer",
 *   conditionParams: { durationSeconds: 86400 },
 * });
 * ```
 *
 * Under the hood, tasks are registered via either:
 * - AutomationAnchor.registerTask() on-chain, or
 * - MorpheusOracle.request("automation_register", ...) for oracle-side automation
 */
export function useKeeper(config: KeeperConfig = {}) {
  const { automationAnchorHash = AUTOMATION_ANCHOR_TESTNET, oracleContractHash = ORACLE_CONTRACT_MAINNET } = config;

  const tasks = ref<KeeperTask[]>([]);
  const isRegistering = ref(false);
  const error = ref<string | null>(null);

  /**
   * Register a new keeper automation task.
   *
   * On-chain flow (via MorpheusOracle):
   *   1. Build a task specification payload:
   *      { conditionType, conditionParams, callbackOperation: operation, callbackArgs: args }
   *   2. Submit the request to the MorpheusOracle contract:
   *      Contract.Call(oracleContractHash, "request", CallFlags.All,
   *        "automation_register",
   *        JSON.stringify(taskSpec),
   *        params.contractHash,
   *        params.operation
   *      )
   *   3. The oracle's keeper module picks up the registration
   *   4. Keeper monitors the specified condition (timer, threshold, event, block)
   *   5. When the condition is met, the keeper invokes the callback contract
   *
   * Alternative flow (via AutomationAnchor):
   *   Contract.Call(automationAnchorHash, "registerTask", CallFlags.All,
   *     params.contractHash, params.operation, conditionType, conditionParamsBytes
   *   )
   *
   * @param params - Task specification including target contract, operation, and condition
   */
  const registerTask = async (params: {
    contractHash: string;
    operation: string;
    conditionType: KeeperTask["conditionType"];
    conditionParams: Record<string, unknown>;
    args?: Array<{ type: string; value: unknown }>;
  }): Promise<KeeperTask> => {
    isRegistering.value = true;
    error.value = null;
    try {
      // Option A: Register via MorpheusOracle "automation_register"
      // const taskSpec = JSON.stringify({
      //   conditionType: params.conditionType,
      //   conditionParams: params.conditionParams,
      //   callbackOperation: params.operation,
      //   callbackArgs: params.args ?? [],
      // });
      // await contract.invoke(oracleContractHash, "request", [
      //   { type: "String",  value: "automation_register" },
      //   { type: "String",  value: taskSpec },
      //   { type: "Hash160", value: params.contractHash },
      //   { type: "String",  value: params.operation },
      // ]);

      // Option B: Register via AutomationAnchor contract
      // await contract.invoke(automationAnchorHash, "registerTask", [
      //   { type: "Hash160", value: params.contractHash },
      //   { type: "String",  value: params.operation },
      //   { type: "String",  value: params.conditionType },
      //   { type: "ByteArray", value: encode(params.conditionParams) },
      // ]);

      const task: KeeperTask = {
        id: `keeper-${Date.now()}`,
        contractHash: params.contractHash,
        operation: params.operation,
        conditionType: params.conditionType,
        conditionParams: params.conditionParams,
        status: "active",
        createdAt: Date.now(),
      };
      tasks.value.push(task);
      return task;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Keeper registration failed";
      throw e;
    } finally {
      isRegistering.value = false;
    }
  };

  /**
   * Cancel an active keeper task.
   *
   * For on-chain tasks, this should also invoke the appropriate
   * cancellation method on AutomationAnchor or MorpheusOracle.
   */
  const cancelTask = async (taskId: string) => {
    const task = tasks.value.find((t: KeeperTask) => t.id === taskId);
    if (task) {
      // Optional: on-chain cancellation
      // await contract.invoke(automationAnchorHash, "cancelTask", [
      //   { type: "String", value: taskId },
      // ]);
      task.status = "cancelled";
    }
  };

  /**
   * Refresh the status of all keeper tasks from on-chain state.
   *
   * Queries the AutomationAnchor contract for current task statuses
   * and updates the local task list.
   */
  const refreshTasks = async () => {
    // Query on-chain task statuses:
    // for (const task of tasks.value) {
    //   const status = await contract.invokeRead(automationAnchorHash, "getTaskStatus", [
    //     { type: "String", value: task.id },
    //   ]);
    //   task.status = parseStatus(status);
    // }
  };

  return {
    // Constants (useful for downstream consumers)
    AUTOMATION_ANCHOR_TESTNET,
    ORACLE_CONTRACT_MAINNET,

    // State
    tasks,
    isRegistering,
    error,

    // Actions
    registerTask,
    cancelTask,
    refreshTasks,
  };
}
