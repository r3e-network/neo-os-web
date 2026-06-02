import type { MiniAppLaunchContext } from "@shared/utils/launch-params";

type LaunchMachine = {
  id: string;
  active?: boolean;
  inventoryReady?: boolean;
};

export type GasBoxLaunchSelectionSource =
  | "none"
  | "requested"
  | "fallback"
  | "missing";

export type GasBoxLaunchSelection<T extends LaunchMachine> = {
  requestedId: string;
  machine: T | null;
  source: GasBoxLaunchSelectionSource;
};

const DRAW_OPERATIONS = new Set([
  "prepareminiappoperation",
  "drawcapsule",
  "opendrawconsole",
  "pull",
]);

export function getGasBoxLaunchMachineId(
  context: MiniAppLaunchContext,
): string {
  const params = context.params ?? {};
  return String(
    params.machineId ||
      params.machine_id ||
      params.machine ||
      params.id ||
      "",
  ).trim();
}

export function shouldApplyGasBoxLaunchSelection(
  context: MiniAppLaunchContext,
): boolean {
  const operation = String(context.operation || "")
    .trim()
    .toLowerCase();
  return Boolean(getGasBoxLaunchMachineId(context)) || DRAW_OPERATIONS.has(operation);
}

export function resolveGasBoxLaunchMachine<T extends LaunchMachine>(
  machines: readonly T[],
  context: MiniAppLaunchContext,
): GasBoxLaunchSelection<T> {
  const requestedId = getGasBoxLaunchMachineId(context);

  if (!requestedId && !shouldApplyGasBoxLaunchSelection(context)) {
    return { requestedId, machine: null, source: "none" };
  }

  if (requestedId) {
    const exact = machines.find((machine) => String(machine.id) === requestedId);
    if (exact) return { requestedId, machine: exact, source: "requested" };

    const legacyIndex = Number(requestedId);
    if (Number.isInteger(legacyIndex) && legacyIndex > 0) {
      const indexed = machines[legacyIndex - 1] ?? null;
      if (indexed) return { requestedId, machine: indexed, source: "requested" };
    }

    return { requestedId, machine: null, source: "missing" };
  }

  const fallback =
    machines.find((machine) => machine.active && machine.inventoryReady) ??
    machines[0] ??
    null;

  return {
    requestedId,
    machine: fallback,
    source: fallback ? "fallback" : "missing",
  };
}
