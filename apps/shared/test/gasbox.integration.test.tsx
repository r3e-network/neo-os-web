import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gasbox/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { const m: Record<string,string> = { title:"GasBox", tapToPlay:"Pull", totalMachines:"Machines", totalPulls:"Pulls", collect:"Credit", congratulations:"Won!", commitPendingRetry:"Pending", createMachineAction:"Create", createPanelHint:"Hint", browseAll:"Browse", allMachines:"All", withdraw:"Withdraw", withdrawRevenue:"Revenue", topRevenue:"Revenue", create:"Studio", pulling:"Pulling...", docSubtitle:"Pull", docDescription:"Pull machines" }; return m[k] ?? k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { machines:[], selectedMachine:null, isLoading:false, isPulling:false, isCreating:false, pullResult:null, userPulls:0, totalPulls:0, machineCount:0, selectedMachineName:"", showResult:false, studioOpen:false, hasPlayCredit:false, formattedPlayCredit:"0", betPhase:"", canReveal:false, isAwaitingReveal:false, walletAddress:"", ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
const machine = { id:"m1", name:"Lucky", active:true, inventoryReady:true, poolReady:true, items:[] };
describe("gasbox integration: dispatch params + state", () => {
  it("dispatches pull with the selected machine id when wallet connected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", hasPlayCredit:true, selectedMachine:machine, machines:[machine], selectedMachineName:"Lucky" })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("pull", "m1"));
  });
  it("dispatches selectMachine with machine id", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ machines:[{id:"m1",name:"Lucky"}] })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".gasbox-machine-chip") as Element);
    expect(dispatch).toHaveBeenCalledWith("selectMachine", "m1");
  });
  it("dispatches reveal when isAwaitingReveal", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ isAwaitingReveal:true, walletAddress:"Nabc" })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("reveal"));
  });
  it("dispatches openStudio from the details drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc" })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const studioBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Studio"));
    expect(studioBtn).toBeTruthy();
    fireEvent.click(studioBtn!);
    expect(dispatch).toHaveBeenCalledWith("openStudio");
  });
});
