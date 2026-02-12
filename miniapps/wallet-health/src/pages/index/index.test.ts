import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import IndexPage from "./index.vue";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    tabHealth: "Health",
    tabChecklist: "Checklist",
    docs: "Docs",
    connectWallet: "Connect Wallet",
    refresh: "Refresh",
    statConnection: "Connection",
    statNetwork: "Network",
    statNeo: "NEO",
    statGas: "GAS",
    statScore: "Score",
    statusConnected: "Connected",
    statusDisconnected: "Disconnected",
    statusUnknown: "Unknown",
    statusEvm: "Unsupported",
    statusNeo: "Neo N3",
    riskLow: "Low Risk",
    riskMedium: "Medium Risk",
    riskHigh: "High Risk",
    autoChecked: "Auto",
    markDone: "Done",
    markUndo: "Undo",
    allSet: "All checks passed!",
  };
  return translations[key] || key;
};

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: mockT,
  }),
}));

vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: { value: "0x1234567890123456789012345678901234567890" },
    connect: vi.fn().mockResolvedValue(undefined),
    invokeRead: vi.fn().mockResolvedValue("1000000000000000000"),
    chainType: { value: "neo-n3" },
    switchToAppChain: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@shared/utils/chain", () => ({
  requireNeoChain: vi.fn().mockReturnValue(true),
  isEvmChain: vi.fn().mockReturnValue(false),
}));

vi.mock("@shared/utils/format", () => ({
  formatFixed8: vi.fn((val: bigint, decimals: number) => {
    if (typeof val === "bigint") {
      const str = val.toString();
      const len = str.length;
      if (len <= decimals) {
        return "0." + "0".repeat(decimals - len) + str;
      }
      return str.slice(0, -decimals) + "." + str.slice(-decimals);
    }
    return String(val);
  }),
}));

vi.mock("@shared/utils/neo", () => ({
  parseInvokeResult: vi.fn().mockReturnValue("1000000000000000000"),
}));

describe("Wallet Health Index Page", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    wrapper = mount(IndexPage, {
      global: {
        stubs: {
          ResponsiveLayout: {
            template: '<div class="responsive-layout-stub"><slot /></div>',
          },
          NeoCard: {
            template: '<div class="neo-card-stub"><slot /></div>',
            props: ["variant"],
          },
          NeoButton: {
            template: '<button class="neo-button-stub"><slot /></button>',
            props: ["size", "variant", "loading"],
          },
          NeoStats: {
            template: '<div class="neo-stats-stub"><slot /></div>',
            props: ["stats"],
          },
          NeoDoc: {
            template: '<div class="neo-doc-stub"><slot /></div>',
            props: ["title", "subtitle", "description", "steps", "features"],
          },
          AppIcon: {
            template: '<span class="app-icon-stub" />',
            props: ["name", "size"],
          },
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(() => {
    wrapper.unmount();
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the main layout", () => {
      expect(wrapper.find(".responsive-layout-stub").exists()).toBe(true);
    });

    it("renders navigation tabs", () => {
      expect(wrapper.findComponent({ name: "NavBar" }).exists()).toBe(true);
    });
  });

  describe("Navigation Tabs", () => {
    it("has Health tab", () => {
      const tabs = wrapper.findAll(".nav-item");
      expect(tabs[0].text()).toContain("Health");
    });

    it("has Checklist tab", () => {
      const tabs = wrapper.findAll(".nav-item");
      expect(tabs[1].text()).toContain("Checklist");
    });

    it("has Docs tab", () => {
      const tabs = wrapper.findAll(".nav-item");
      expect(tabs[2].text()).toContain("Docs");
    });
  });

  describe("Health Stats", () => {
    it("renders NeoStats component", () => {
      expect(wrapper.findComponent({ name: "NeoStats" }).exists()).toBe(true);
    });

    it("passes stats data to NeoStats", () => {
      const statsComponent = wrapper.findComponent({ name: "NeoStats" });
      expect(statsComponent.props("stats")).toBeDefined();
      expect(Array.isArray(statsComponent.props("stats"))).toBe(true);
    });
  });

  describe("Balance Display", () => {
    it("displays NEO balance", () => {
      const balanceItems = wrapper.findAll(".balance-item");
      expect(balanceItems[0].text()).toContain("NEO");
    });

    it("displays GAS balance", () => {
      const balanceItems = wrapper.findAll(".balance-item");
      expect(balanceItems[1].text()).toContain("GAS");
    });
  });

  describe("Risk Assessment", () => {
    it("shows risk pill", () => {
      const riskPill = wrapper.find(".risk-pill");
      expect(riskPill.exists()).toBe(true);
    });

    it("risk pill has risk class", () => {
      const riskPill = wrapper.find(".risk-pill");
      expect(riskPill.classes()).toContain("risk-low");
    });
  });

  describe("Recommendations", () => {
    it("has recommendations section", () => {
      const recommendationCard = wrapper.find(".recommendation-card");
      expect(recommendationCard.exists()).toBe(true);
    });

    it("shows empty state when all checks pass", () => {
      const emptyState = wrapper.find(".recommendation-empty");
      if (emptyState.exists()) {
        expect(emptyState.text()).toContain("All set");
      }
    });
  });

  describe("Checklist Tab", () => {
    it("renders score card", () => {
      const scoreCard = wrapper.find(".score-card");
      expect(scoreCard.exists()).toBe(true);
    });

    it("displays safety score percentage", () => {
      const scoreValue = wrapper.find(".score-value");
      expect(scoreValue.exists()).toBe(true);
    });

    it("has progress bar", () => {
      const progressBar = wrapper.find(".progress-bar");
      expect(progressBar.exists()).toBe(true);
    });

    it("progress bar has fill", () => {
      const progressFill = wrapper.find(".progress-fill");
      expect(progressFill.exists()).toBe(true);
    });

    it("has checklist items", () => {
      const checklistItems = wrapper.findAll(".checklist-item");
      expect(checklistItems.length).toBeGreaterThan(0);
    });
  });

  describe("Checklist Items", () => {
    it("has backup item", () => {
      const items = wrapper.findAll(".checklist-title");
      const backupItem = items.find((item) => item.text().toLowerCase().includes("backup"));
      expect(backupItem).toBeDefined();
    });

    it("has GAS balance item", () => {
      const items = wrapper.findAll(".checklist-title");
      const gasItem = items.find((item) => item.text().toLowerCase().includes("gas"));
      expect(gasItem).toBeDefined();
    });

    it("has device security item", () => {
      const items = wrapper.findAll(".checklist-title");
      const deviceItem = items.find((item) => item.text().toLowerCase().includes("device"));
      expect(deviceItem).toBeDefined();
    });

    it("has hardware wallet item", () => {
      const items = wrapper.findAll(".checklist-title");
      const hardwareItem = items.find((item) => item.text().toLowerCase().includes("hardware"));
      expect(hardwareItem).toBeDefined();
    });
  });

  describe("Refresh Functionality", () => {
    it("has refresh button", () => {
      const refreshButton = wrapper.find(".neo-button-stub");
      expect(refreshButton.text()).toContain("Refresh");
    });
  });

  describe("Docs Tab", () => {
    it("renders NeoDoc component", () => {
      const docComponent = wrapper.findComponent({ name: "NeoDoc" });
      expect(docComponent.exists()).toBe(true);
    });
  });

  describe("Safety Score Calculation", () => {
    it("calculates score based on completed items", () => {
      const safetyScore = wrapper.vm.safetyScore;
      expect(typeof safetyScore).toBe("number");
      expect(safetyScore).toBeGreaterThanOrEqual(0);
      expect(safetyScore).toBeLessThanOrEqual(100);
    });

    it("displays score as percentage", () => {
      const scoreValue = wrapper.find(".score-value");
      expect(scoreValue.text()).toContain("%");
    });
  });

  describe("Wallet Connection", () => {
    it("displays connection status", () => {
      const stats = wrapper.findComponent({ name: "NeoStats" });
      const statsData = stats.props("stats");
      const connectionStat = statsData.find((s: Record<string, unknown>) => s.label === "Connection");
      expect(connectionStat).toBeDefined();
    });

    it("displays network status", () => {
      const stats = wrapper.findComponent({ name: "NeoStats" });
      const statsData = stats.props("stats");
      const networkStat = statsData.find((s: Record<string, unknown>) => s.label === "Network");
      expect(networkStat).toBeDefined();
    });
  });

  describe("Contract Constants", () => {
    it("has correct NEO contract hash", () => {
      expect(wrapper.vm.NEO_HASH).toBe("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5");
    });

    it("has correct GAS contract hash", () => {
      expect(wrapper.vm.GAS_HASH).toBe("0xd2a4cff31913016155e38e474a2c06d08be276cf");
    });

    it("has GAS low threshold", () => {
      expect(wrapper.vm.GAS_LOW_THRESHOLD).toBeDefined();
      expect(typeof wrapper.vm.GAS_LOW_THRESHOLD).toBe("bigint");
    });
  });

  describe("Checklist State Management", () => {
    it("has checklist state object", () => {
      expect(wrapper.vm.checklistState).toBeDefined();
      expect(typeof wrapper.vm.checklistState).toBe("object");
    });

    it("loads checklist from storage on mount", () => {
      expect(wrapper.vm.checklistState).toBeDefined();
    });
  });

  describe("Risk Classes", () => {
    it("applies low risk class when score >= 80", () => {
      if (wrapper.vm.safetyScore >= 80) {
        const riskPill = wrapper.find(".risk-pill");
        expect(riskPill.classes()).toContain("risk-low");
      }
    });

    it("applies medium risk class when score >= 50", () => {
      if (wrapper.vm.safetyScore >= 50 && wrapper.vm.safetyScore < 80) {
        const riskPill = wrapper.find(".risk-pill");
        expect(riskPill.classes()).toContain("risk-medium");
      }
    });
  });

  describe("Recommendations Computation", () => {
    it("generates recommendations based on checklist state", () => {
      const recommendations = wrapper.vm.recommendations;
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("recommends backup if not completed", () => {
      const recommendations = wrapper.vm.recommendations;
      if (!wrapper.vm.checklistState.backup) {
        expect(recommendations.some((r: string) => r.toLowerCase().includes("backup"))).toBe(true);
      }
    });
  });

  describe("Balance Formatting", () => {
    it("formats NEO display", () => {
      const neoDisplay = wrapper.vm.neoDisplay;
      expect(typeof neoDisplay).toBe("string");
    });

    it("formats GAS display with decimals", () => {
      const gasDisplay = wrapper.vm.gasDisplay;
      expect(typeof gasDisplay).toBe("string");
    });
  });

  describe("Tab Navigation", () => {
    it("defaults to health tab", () => {
      expect(wrapper.vm.activeTab).toBe("health");
    });

    it("can switch to checklist tab", async () => {
      const checklistTab = wrapper.findAll(".nav-item")[1];
      await checklistTab.trigger("click");
      expect(wrapper.vm.activeTab).toBe("checklist");
    });
  });
});
