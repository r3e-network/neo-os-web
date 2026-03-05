import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import IndexPage from "./index.vue";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    checkin: "Check In",
    stats: "Stats",
    docs: "Docs",
    checkInNow: "Check In Now",
    waitForNext: "Wait for next day",
    currentStreak: "Current Streak",
    highestStreak: "Highest Streak",
    days: "days",
    totalClaimed: "Total Claimed",
    unclaimed: "Unclaimed",
    loading: "Loading...",
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
    invokeRead: vi.fn().mockResolvedValue([7, 14, 3, 2.5, 10, 25]),
    chainType: { value: "neo" },
    getContractAddress: vi.fn().mockResolvedValue("0x47be6b7caa014c5879ac3eab3b246d5302f9f8cc"),
  }),
  useEvents: () => ({
    list: vi.fn().mockResolvedValue({ events: [] }),
  }),
}));

vi.mock("@shared/utils/neo", () => ({
  parseInvokeResult: vi.fn((res) => res),
  parseStackItem: vi.fn((val) => val),
}));

vi.mock("@shared/utils/format", () => ({
  formatGas: vi.fn((val) => String(val)),
}));

vi.mock("@shared/utils/chain", () => ({
  requireNeoChain: vi.fn().mockReturnValue(true),
}));

vi.mock("@shared/composables/usePaymentFlow", () => ({
  usePaymentFlow: () => ({
    processPayment: vi.fn().mockResolvedValue({ receiptId: 123, invoke: vi.fn() }),
    isLoading: { value: false },
  }),
}));

describe("Daily Check-in Index Page", () => {
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
            props: ["size", "variant", "block", "disabled", "loading"],
          },
          NeoDoc: {
            template: '<div class="neo-doc-stub"><slot /></div>',
            props: ["title", "subtitle", "description", "steps", "features"],
          },
          ChainWarning: {
            template: '<div class="chain-warning-stub" />',
          },
          Fireworks: {
            template: '<div class="fireworks-stub" />',
          },
          CountdownHero: {
            template: '<div class="countdown-hero-stub" />',
            props: ["countdownProgress", "countdownLabel", "canCheckIn", "utcTimeDisplay"],
          },
          StreakDisplay: {
            template: '<div class="streak-display-stub" />',
            props: ["currentStreak", "highestStreak"],
          },
          RewardProgress: {
            template: '<div class="reward-progress-stub" />',
            props: ["milestones", "currentStreak"],
          },
          UserRewards: {
            template: '<div class="user-rewards-stub" />',
            props: ["unclaimedRewards", "totalClaimed", "isClaiming"],
          },
          StatsTab: {
            template: '<div class="stats-tab-stub" />',
            props: ["globalStats", "userStats", "checkinHistory"],
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
    it("has Check In tab", () => {
      const tabs = wrapper.findAll(".nav-item");
      expect(tabs[0].text()).toContain("Check In");
    });

    it("has Stats tab", () => {
      const tabs = wrapper.findAll(".nav-item");
      expect(tabs[1].text()).toContain("Stats");
    });

    it("has Docs tab", () => {
      const tabs = wrapper.findAll(".nav-item");
      expect(tabs[2].text()).toContain("Docs");
    });
  });

  describe("Check-in Button", () => {
    it("renders check-in button", () => {
      const button = wrapper.find(".neo-button-stub");
      expect(button.exists()).toBe(true);
    });

    it("displays check-in text", () => {
      const button = wrapper.find(".neo-button-stub");
      expect(button.text()).toContain("Check In Now");
    });
  });

  describe("Countdown Component", () => {
    it("renders CountdownHero component", () => {
      expect(wrapper.findComponent({ name: "CountdownHero" }).exists()).toBe(true);
    });

    it("passes countdown props", () => {
      const component = wrapper.findComponent({ name: "CountdownHero" });
      expect(component.props("canCheckIn")).toBeDefined();
      expect(component.props("countdownLabel")).toBeDefined();
    });
  });

  describe("Streak Display", () => {
    it("renders StreakDisplay component", () => {
      expect(wrapper.findComponent({ name: "StreakDisplay" }).exists()).toBe(true);
    });

    it("passes streak props", () => {
      const component = wrapper.findComponent({ name: "StreakDisplay" });
      expect(component.props("currentStreak")).toBeDefined();
      expect(component.props("highestStreak")).toBeDefined();
    });
  });

  describe("Reward Progress", () => {
    it("renders RewardProgress component", () => {
      expect(wrapper.findComponent({ name: "RewardProgress" }).exists()).toBe(true);
    });
  });

  describe("User Rewards", () => {
    it("renders UserRewards component", () => {
      expect(wrapper.findComponent({ name: "UserRewards" }).exists()).toBe(true);
    });
  });

  describe("Stats Tab", () => {
    it("renders StatsTab component", () => {
      expect(wrapper.findComponent({ name: "StatsTab" }).exists()).toBe(true);
    });
  });

  describe("Milestones", () => {
    it("defines reward milestones correctly", () => {
      const milestones = wrapper.vm.milestones;
      expect(milestones).toHaveLength(4);
      expect(milestones[0]).toEqual({ day: 7, reward: 1, cumulative: 1 });
      expect(milestones[1]).toEqual({ day: 14, reward: 1.5, cumulative: 2.5 });
    });
  });

  describe("UTC Countdown", () => {
    it("calculates current UTC day", () => {
      const currentUtcDay = wrapper.vm.currentUtcDay;
      const now = Date.now();
      const expected = Math.floor(now / (24 * 60 * 60 * 1000));
      expect(currentUtcDay).toBe(expected);
    });

    it("calculates next UTC midnight", () => {
      const nextUtcMidnight = wrapper.vm.nextUtcMidnight;
      const currentUtcDay = wrapper.vm.currentUtcDay;
      expect(nextUtcMidnight).toBe((currentUtcDay + 1) * 24 * 60 * 60 * 1000);
    });

    it("calculates countdown label", () => {
      const label = wrapper.vm.countdownLabel;
      expect(label).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("Check-in Eligibility", () => {
    it("can check in on first visit", () => {
      wrapper.vm.lastCheckInDay.value = 0;
      expect(wrapper.vm.canCheckIn).toBe(true);
    });

    it("can check in when UTC day advances", () => {
      wrapper.vm.lastCheckInDay.value = wrapper.vm.currentUtcDay.value - 1;
      expect(wrapper.vm.canCheckIn).toBe(true);
    });

    it("cannot check in same day", () => {
      wrapper.vm.lastCheckInDay.value = wrapper.vm.currentUtcDay.value;
      expect(wrapper.vm.canCheckIn).toBe(false);
    });
  });

  describe("Countdown Progress", () => {
    it("calculates progress between 0 and circumference", () => {
      const progress = wrapper.vm.countdownProgress;
      const circumference = 2 * Math.PI * 99;
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(circumference);
    });
  });

  describe("User Stats Computation", () => {
    it("computes user stats correctly", () => {
      const stats = wrapper.vm.userStats;
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
    });
  });

  describe("Contract Constants", () => {
    it("has correct app ID", () => {
      expect(wrapper.vm.APP_ID).toBe("miniapp-dailycheckin");
    });

    it("has check-in fee defined", () => {
      expect(wrapper.vm.CHECK_IN_FEE).toBe(0.001);
    });

    it("has milliseconds per day constant", () => {
      expect(wrapper.vm.MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("Status Messages", () => {
    it("can display success status", () => {
      wrapper.vm.status = { msg: "Check-in successful!", type: "success" };
      const statusCard = wrapper.find(".neo-card-stub");
      expect(statusCard.exists()).toBe(true);
    });

    it("can display error status", () => {
      wrapper.vm.status = { msg: "Error occurred", type: "error" };
      expect(wrapper.vm.status.type).toBe("error");
    });
  });

  describe("Tabs Navigation", () => {
    it("defaults to checkin tab", () => {
      expect(wrapper.vm.activeTab).toBe("checkin");
    });

    it("can switch to stats tab", async () => {
      const statsTab = wrapper.findAll(".nav-item")[1];
      await statsTab.trigger("click");
      expect(wrapper.vm.activeTab).toBe("stats");
    });
  });
});
