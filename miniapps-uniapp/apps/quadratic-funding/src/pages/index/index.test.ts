import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import IndexPage from "./index.vue";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    rounds: "Rounds",
    projects: "Projects",
    contribute: "Contribute",
    roundTitle: "Round Title",
    roundTitlePlaceholder: "Enter round title",
    roundDescription: "Description",
    roundDescriptionPlaceholder: "Enter description",
    assetType: "Asset Type",
    assetGas: "GAS",
    matchingPool: "Matching Pool",
    matchingPoolHint: "Amount of GAS to match contributions",
    roundStart: "Start Time",
    roundStartPlaceholder: "Select start time",
    roundEnd: "End Time",
    roundEndPlaceholder: "Select end time",
    createRound: "Create Round",
    creatingRound: "Creating...",
    roundsTitle: "Funding Rounds",
    refresh: "Refresh",
    emptyRounds: "No rounds yet",
    matchingRemaining: "Matching Remaining",
    totalContributed: "Total Contributed",
    projectCount: "Projects",
    roundSchedule: "Schedule",
    roundCreator: "Creator",
    selectRound: "Select Round",
    selectedRound: "Selected",
    adminTools: "Admin Tools",
    addMatching: "Add Matching",
    addMatchingPlaceholder: "Amount",
    addingMatching: "Adding...",
    finalizeProjectsJson: "Projects JSON",
    finalizeProjectsPlaceholder: '["proj1", "proj2"]',
    finalizeMatchesJson: "Matches JSON",
    finalizeMatchesPlaceholder: '["100", "200"]',
    finalizeHint: "Finalize round and distribute matching funds",
    finalizeRound: "Finalize Round",
    finalizing: "Finalizing...",
    claimUnused: "Claim Unused",
    claimingUnused: "Claiming...",
    noSelectedRound: "No round selected",
    projectName: "Project Name",
    projectNamePlaceholder: "Enter project name",
    projectDescription: "Description",
    projectDescriptionPlaceholder: "Enter description",
    projectLink: "Link",
    projectLinkPlaceholder: "https://...",
    registerProject: "Register Project",
    registeringProject: "Registering...",
    tabProjects: "Projects",
    emptyProjects: "No projects yet",
    matchedAmount: "Matched",
    donors: "Donors",
    contributeNow: "Contribute",
    claimProject: "Claim",
    claimingProject: "Claiming...",
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
    invokeContract: vi.fn().mockResolvedValue({ txid: "0xabc123" }),
    invokeRead: vi.fn().mockResolvedValue([]),
    chainType: { value: "neo" },
    getContractAddress: vi.fn().mockResolvedValue("0xquadratic123"),
  }),
}));

vi.mock("@shared/utils/neo", () => ({
  parseInvokeResult: vi.fn((res) => res),
}));

vi.mock("@shared/utils/format", () => ({
  formatAmount: vi.fn((symbol, amount) => String(amount)),
}));

vi.mock("@shared/utils/chain", () => ({
  requireNeoChain: vi.fn().mockReturnValue(true),
}));

describe("Quadratic Funding Index Page", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    wrapper = mount(IndexPage, {
      global: {
        stubs: {
          ResponsiveLayout: {
            template: '<div class="responsive-layout-stub"><slot /></div>',
            props: ["class", "tabs", "activeTab", "desktopBreakpoint"],
          },
          NeoCard: {
            template: '<div class="neo-card-stub"><slot /></div>',
            props: ["variant"],
          },
          NeoButton: {
            template: '<button class="neo-button-stub"><slot /></button>',
            props: ["size", "variant", "block", "loading", "disabled"],
          },
          NeoInput: {
            template: '<input class="neo-input-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ["modelValue", "type", "label", "placeholder", "suffix", "hint"],
          },
          ChainWarning: {
            template: '<div class="chain-warning-stub" />',
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

    it("renders tab content", () => {
      const tabContent = wrapper.find(".tab-content");
      expect(tabContent.exists()).toBe(true);
    });
  });

  describe("Navigation Tabs", () => {
    it("has Rounds tab", () => {
      expect(wrapper.vm.navTabs[0].id).toBe("rounds");
    });

    it("has Projects tab", () => {
      expect(wrapper.vm.navTabs[1].id).toBe("projects");
    });

    it("has Contribute tab", () => {
      expect(wrapper.vm.navTabs[2].id).toBe("contribute");
    });
  });

  describe("Tab State", () => {
    it("defaults to rounds tab", () => {
      expect(wrapper.vm.activeTab).toBe("rounds");
    });

    it("can switch to projects tab", async () => {
      await wrapper.vm.onTabChange("projects");
      expect(wrapper.vm.activeTab).toBe("projects");
    });

    it("can switch to contribute tab", async () => {
      await wrapper.vm.onTabChange("contribute");
      expect(wrapper.vm.activeTab).toBe("contribute");
    });
  });

  describe("Round Creation Form", () => {
    it("has round form state", () => {
      expect(wrapper.vm.roundForm).toBeDefined();
      expect(wrapper.vm.roundForm.title).toBe("");
      expect(wrapper.vm.roundForm.description).toBe("");
      expect(wrapper.vm.roundForm.matchingPool).toBe("");
      expect(wrapper.vm.roundForm.startTime).toBe("");
      expect(wrapper.vm.roundForm.endTime).toBe("");
    });

    it("has isCreatingRound state", () => {
      expect(wrapper.vm.isCreatingRound).toBe(false);
    });
  });

  describe("Rounds List", () => {
    it("has rounds state", () => {
      expect(wrapper.vm.rounds).toEqual([]);
    });

    it("has isRefreshingRounds state", () => {
      expect(wrapper.vm.isRefreshingRounds).toBe(false);
    });
  });

  describe("Round Selection", () => {
    it("has selectedRoundId state", () => {
      expect(wrapper.vm.selectedRoundId).toBeNull();
    });

    it("has selectedRound computed", () => {
      expect(wrapper.vm.selectedRound).toBeNull();
    });

    it("can select a round", async () => {
      wrapper.vm.rounds = [{ id: "1", title: "Test Round" } as Record<string, unknown>];
      await wrapper.vm.selectRound(wrapper.vm.rounds[0]);
      expect(wrapper.vm.selectedRoundId).toBe("1");
    });
  });

  describe("Matching Pool Management", () => {
    it("has matchingForm state", () => {
      expect(wrapper.vm.matchingForm).toBeDefined();
      expect(wrapper.vm.matchingForm.amount).toBe("");
    });

    it("has isAddingMatching state", () => {
      expect(wrapper.vm.isAddingMatching).toBe(false);
    });

    it("has addMatchingPool function", () => {
      expect(typeof wrapper.vm.addMatchingPool).toBe("function");
    });
  });

  describe("Round Finalization", () => {
    it("has finalizeForm state", () => {
      expect(wrapper.vm.finalizeForm).toBeDefined();
      expect(wrapper.vm.finalizeForm.projectIds).toBe("");
      expect(wrapper.vm.finalizeForm.matchedAmounts).toBe("");
    });

    it("has isFinalizing state", () => {
      expect(wrapper.vm.isFinalizing).toBe(false);
    });

    it("has finalizeRound function", () => {
      expect(typeof wrapper.vm.finalizeRound).toBe("function");
    });
  });

  describe("Unused Matching Claims", () => {
    it("has isClaimingUnused state", () => {
      expect(wrapper.vm.isClaimingUnused).toBe(false);
    });

    it("has claimUnusedMatching function", () => {
      expect(typeof wrapper.vm.claimUnusedMatching).toBe("function");
    });

    it("has canClaimUnused computed", () => {
      expect(typeof wrapper.vm.canClaimUnused).toBe("boolean");
    });
  });

  describe("Project Registration", () => {
    it("has projectForm state", () => {
      expect(wrapper.vm.projectForm).toBeDefined();
      expect(wrapper.vm.projectForm.name).toBe("");
      expect(wrapper.vm.projectForm.description).toBe("");
      expect(wrapper.vm.projectForm.link).toBe("");
    });

    it("has isRegisteringProject state", () => {
      expect(wrapper.vm.isRegisteringProject).toBe(false);
    });

    it("has registerProject function", () => {
      expect(typeof wrapper.vm.registerProject).toBe("function");
    });
  });

  describe("Projects List", () => {
    it("has projects state", () => {
      expect(wrapper.vm.projects).toEqual([]);
    });

    it("has isRefreshingProjects state", () => {
      expect(wrapper.vm.isRefreshingProjects).toBe(false);
    });
  });

  describe("Status Messages", () => {
    it("has status ref", () => {
      expect(wrapper.vm.status).toBeDefined();
    });

    it("can display status", () => {
      wrapper.vm.status = { msg: "Test message", type: "success" };
      const statusCard = wrapper.find(".neo-card-stub");
      expect(statusCard.exists()).toBe(true);
    });
  });

  describe("Round Actions", () => {
    it("has refreshRounds function", () => {
      expect(typeof wrapper.vm.refreshRounds).toBe("function");
    });

    it("has formatAmount function", () => {
      expect(typeof wrapper.vm.formatAmount).toBe("function");
    });

    it("has roundStatusLabel function", () => {
      expect(typeof wrapper.vm.roundStatusLabel).toBe("function");
    });

    it("has formatSchedule function", () => {
      expect(typeof wrapper.vm.formatSchedule).toBe("function");
    });

    it("has formatAddress function", () => {
      expect(typeof wrapper.vm.formatAddress).toBe("function");
    });
  });

  describe("Project Actions", () => {
    it("has refreshProjects function", () => {
      expect(typeof wrapper.vm.refreshProjects).toBe("function");
    });

    it("has projectStatusClass function", () => {
      expect(typeof wrapper.vm.projectStatusClass).toBe("function");
    });

    it("has projectStatusLabel function", () => {
      expect(typeof wrapper.vm.projectStatusLabel).toBe("function");
    });

    it("has goToContribute function", () => {
      expect(typeof wrapper.vm.goToContribute).toBe("function");
    });

    it("has claimProject function", () => {
      expect(typeof wrapper.vm.claimProject).toBe("function");
    });

    it("has canClaimProject function", () => {
      expect(typeof wrapper.vm.canClaimProject).toBe("function");
    });
  });

  describe("Admin Permissions", () => {
    it("has canManageSelectedRound computed", () => {
      expect(typeof wrapper.vm.canManageSelectedRound).toBe("boolean");
    });

    it("has canFinalizeSelectedRound computed", () => {
      expect(typeof wrapper.vm.canFinalizeSelectedRound).toBe("boolean");
    });
  });

  describe("Contribute Form", () => {
    it("has contributeForm state", () => {
      expect(wrapper.vm.contributeForm).toBeDefined();
      expect(wrapper.vm.contributeForm.amount).toBe("");
    });

    it("has isContributing state", () => {
      expect(wrapper.vm.isContributing).toBe(false);
    });

    it("has contribute function", () => {
      expect(typeof wrapper.vm.contribute).toBe("function");
    });

    it("has cancelContribution function", () => {
      expect(typeof wrapper.vm.cancelContribution).toBe("function");
    });
  });

  describe("History", () => {
    it("has history state", () => {
      expect(wrapper.vm.history).toEqual([]);
    });

    it("has isLoadingHistory state", () => {
      expect(wrapper.vm.isLoadingHistory).toBe(false);
    });

    it("has loadHistory function", () => {
      expect(typeof wrapper.vm.loadHistory).toBe("function");
    });
  });

  describe("Round Status Pills", () => {
    it("renders status pills", () => {
      wrapper.vm.rounds = [{ id: "1", status: "active" } as Record<string, unknown>];
      const statusPill = wrapper.find(".status-pill");
      expect(statusPill.exists()).toBe(true);
    });
  });

  describe("Round Cards", () => {
    it("renders round cards", () => {
      wrapper.vm.rounds = [{ id: "1", title: "Test Round" } as Record<string, unknown>];
      const roundCard = wrapper.find(".round-card");
      expect(roundCard.exists()).toBe(true);
    });

    it("displays round metrics", () => {
      wrapper.vm.rounds = [{ id: "1", title: "Test Round", matchingPool: "100", matchingRemaining: "50", totalContributed: "25", projectCount: 5, assetSymbol: "GAS" } as Record<string, unknown>];
      const metricLabels = wrapper.findAll(".metric-label");
      expect(metricLabels.length).toBeGreaterThan(0);
    });
  });

  describe("Project Cards", () => {
    it("renders project cards when round selected", async () => {
      wrapper.vm.activeTab = "projects";
      wrapper.vm.selectedRound = { id: "1", assetSymbol: "GAS" } as Record<string, unknown>;
      wrapper.vm.projects = [{ id: "p1", name: "Test Project", totalContributed: "10", matchedAmount: "5", contributorCount: 3, owner: "0x123", description: "", link: "" } as Record<string, unknown>];
      await wrapper.vm.$nextTick();
      const projectCard = wrapper.find(".project-card");
      expect(projectCard.exists()).toBe(true);
    });
  });

  describe("Admin Card", () () => {
    it("renders admin card when round selected", async () => {
      wrapper.vm.selectedRound = { id: "1", assetSymbol: "GAS" } as Record<string, unknown>;
      await wrapper.vm.$nextTick();
      const adminCard = wrapper.find(".admin-card");
      expect(adminCard.exists()).toBe(true);
    });
  });
});
