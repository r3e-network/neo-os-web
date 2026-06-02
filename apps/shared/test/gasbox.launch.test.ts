import { describe, expect, it } from "vitest";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import { resolveGasBoxLaunchMachine } from "../../gasbox/src/launch";

const machines = [
  { id: "alpha", active: false, inventoryReady: true },
  { id: "beta", active: true, inventoryReady: true },
  { id: "gamma", active: true, inventoryReady: false },
];

describe("GasBox launch selection", () => {
  it("preselects the requested machineId from launch params", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/gasbox/index.html?operation=prepareMiniAppOperation&machineId=beta",
      "miniapp-gasbox",
    );

    expect(resolveGasBoxLaunchMachine(machines, context)).toEqual({
      requestedId: "beta",
      machine: machines[1],
      source: "requested",
    });
  });

  it("keeps legacy numeric machine launch params useful as one-based indexes", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/gasbox/index.html?operation=prepareMiniAppOperation&machine=2",
      "miniapp-gasbox",
    );

    expect(resolveGasBoxLaunchMachine(machines, context)).toEqual({
      requestedId: "2",
      machine: machines[1],
      source: "requested",
    });
  });

  it("falls back to the first playable machine for draw-console launches", () => {
    const context = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/gasbox/index.html?operation=prepareMiniAppOperation",
      "miniapp-gasbox",
    );

    expect(resolveGasBoxLaunchMachine(machines, context)).toEqual({
      requestedId: "",
      machine: machines[1],
      source: "fallback",
    });
  });
});
