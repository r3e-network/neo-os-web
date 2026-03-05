import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import IndexPage from "./index.vue";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    tabTotal: "Total",
    tabDa: "Da Hongfei",
    tabErik: "Erik Zhang",
    docs: "Docs",
    loading: "Loading...",
    retry: "Retry",
    refreshing: "Refreshing...",
    loadFailed: "Failed to load data",
    title: "Neo Treasury",
    docSubtitle: "Treasury Dashboard",
    docDescription: "Track Neo foundation treasury",
  };
  return translations[key] || key;
};

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: mockT,
  }),
}));

vi.mock("@/utils/treasury", () => ({
  fetchTreasuryData: vi.fn().mockResolvedValue({
    totalUsd: 150000000,
    totalNeo: 10000000,
    totalGas: 50000000,
    lastUpdated: Date.now(),
    prices: { neo: 15, gas: 0.5 },
    categories: [
      { name: "Da Hongfei", neo: 5000000, gas: 25000000, usd: 75000000 },
      { name: "Erik Zhang", neo: 5000000, gas: 25000000, usd: 75000000 },
    ],
  }),
}));

vi.mock("@shared/components", () => ({
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
    props: ["variant", "class"],
  },
  NeoDoc: {
    template: '<div class="neo-doc-stub"><slot /></div>',
    props: ["title", "subtitle", "description", "steps", "features"],
  },
  AppIcon: {
    template: '<span class="app-icon-stub" />',
    props: ["name", "size", "class"],
  },
  ChainWarning: {
    template: '<div class="chain-warning-stub" />',
  },
}));

describe("Neo Treasury Index Page", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    wrapper = mount(IndexPage, {
      global: {
        stubs: {
          TotalSummaryCard: {
            template: '<div class="total-summary-card-stub" />',
            props: ["totalUsd", "totalNeo", "totalGas", "lastUpdated", "t"],
          },
          PriceGrid: {
            template: '<div class="price-grid-stub" />',
            props: ["prices"],
          },
          FoundersList: {
            template: '<div class="founders-list-stub" />',
            props: ["categories", "t"],
          },
          FounderDetail: {
            template: '<div class="founder-detail-stub" />',
            props: ["category", "prices", "t"],
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

    it("renders app container", () => {
      const appContainer = wrapper.find(".app-container");
      expect(appContainer.exists()).toBe(true);
    });
  });

  describe("Navigation Tabs", () => {
    it("has Total tab", () => {
      expect(wrapper.vm.navTabs[0].id).toBe("total");
    });

    it("has Da tab", () => {
      expect(wrapper.vm.navTabs[1].id).toBe("da");
    });

    it("has Erik tab", () => {
      expect(wrapper.vm.navTabs[2].id).toBe("erik");
    });

    it("has Docs tab", () => {
      expect(wrapper.vm.navTabs[3].id).toBe("docs");
    });
  });

  describe("Tab State", () => {
    it("defaults to total tab", () => {
      expect(wrapper.vm.activeTab).toBe("total");
    });

    it("can switch to da tab", async () => {
      await wrapper.vm.goToFounder("Da Hongfei");
      expect(wrapper.vm.activeTab).toBe("da");
    });

    it("can switch to erik tab", async () => {
      await wrapper.vm.goToFounder("Erik Zhang");
      expect(wrapper.vm.activeTab).toBe("erik");
    });
  });

  describe("Data Loading", () => {
    it("has loadData function", () => {
      expect(typeof wrapper.vm.loadData).toBe("function");
    });

    it("has loading state", () => {
      expect(wrapper.vm.loading).toBeDefined();
    });

    it("has error state", () => {
      expect(wrapper.vm.error).toBeDefined();
    });

    it("has data state", () => {
      expect(wrapper.vm.data).toBeDefined();
    });
  });

  describe("Status Messages", () => {
    it("has status ref", () => {
      expect(wrapper.vm.status).toBeDefined();
    });

    it("can display success status", () => {
      wrapper.vm.status = { msg: "Success", type: "success" };
      const statusCard = wrapper.find(".neo-card-stub");
      expect(statusCard.exists()).toBe(true);
    });
  });

  describe("Cache Management", () => {
    it("has cache key constant", () => {
      expect(wrapper.vm.CACHE_KEY).toBe("neo_treasury_cache");
    });
  });

  describe("Doc Steps", () => {
    it("computes doc steps", () => {
      const steps = wrapper.vm.docSteps;
      expect(Array.isArray(steps)).toBe(true);
    });
  });

  describe("Doc Features", () => {
    it("computes doc features", () => {
      const features = wrapper.vm.docFeatures;
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBe(3);
    });
  });

  describe("Category Computations", () => {
    it("computes DA category", () => {
      const daCategory = wrapper.vm.daCategory;
      expect(daCategory?.name).toBe("Da Hongfei");
    });

    it("computes Erik category", () => {
      const erikCategory = wrapper.vm.erikCategory;
      expect(erikCategory?.name).toBe("Erik Zhang");
    });
  });

  describe("Navigation Functions", () => {
    it("has goToFounder function", () => {
      expect(typeof wrapper.vm.goToFounder).toBe("function");
    });

    it("navigates to DA founder", async () => {
      await wrapper.vm.goToFounder("Da Hongfei");
      expect(wrapper.vm.activeTab).toBe("da");
    });

    it("navigates to Erik founder", async () => {
      await wrapper.vm.goToFounder("Erik Zhang");
      expect(wrapper.vm.activeTab).toBe("erik");
    });
  });

  describe("Loading State", () => {
    it("shows loading overlay initially", () => {
      const loadingOverlay = wrapper.find(".loading-overlay");
      expect(loadingOverlay.exists()).toBe(true);
    });

    it("shows soft loading indicator", () => {
      const softLoading = wrapper.find(".soft-loading");
      expect(softLoading.exists()).toBe(true);
    });
  });

  describe("Error State", () => {
    it("can display error", async () => {
      wrapper.vm.error = "Test error";
      await wrapper.vm.$nextTick();
      const errorContainer = wrapper.find(".error-container");
      expect(errorContainer.exists()).toBe(true);
    });

    it("has retry button", async () => {
      wrapper.vm.error = "Test error";
      await wrapper.vm.$nextTick();
      const retryButton = wrapper.find(".neo-button-stub");
      expect(retryButton.exists()).toBe(true);
    });
  });

  describe("Responsive State", () => {
    it("calculates window width", () => {
      expect(wrapper.vm.windowWidth).toBeDefined();
    });

    it("determines mobile breakpoint", () => {
      expect(typeof wrapper.vm.isMobile).toBe("boolean");
    });

    it("determines desktop breakpoint", () => {
      expect(typeof wrapper.vm.isDesktop).toBe("boolean");
    });
  });

  describe("Resize Handler", () => {
    it("has resize handler", () => {
      expect(typeof wrapper.vm.handleResize).toBe("function");
    });
  });

  describe("Sub-components Rendering", () => {
    it("renders TotalSummaryCard", () => {
      const component = wrapper.findComponent({ name: "TotalSummaryCard" });
      expect(component.exists()).toBe(true);
    });

    it("renders PriceGrid", () => {
      const component = wrapper.findComponent({ name: "PriceGrid" });
      expect(component.exists()).toBe(true);
    });

    it("renders FoundersList", () => {
      const component = wrapper.findComponent({ name: "FoundersList" });
      expect(component.exists()).toBe(true);
    });

    it("renders FounderDetail when on founder tab", async () => {
      await wrapper.vm.goToFounder("Da Hongfei");
      await wrapper.vm.$nextTick();
      const component = wrapper.findComponent({ name: "FounderDetail" });
      expect(component.exists()).toBe(true);
    });
  });

  describe("Data Persistence", () => {
    it("loads data on mount", async () => {
      await wrapper.vm.loadData();
      expect(wrapper.vm.data).toBeDefined();
      expect(wrapper.vm.data?.totalUsd).toBe(150000000);
    });

    it("clears error on successful load", async () => {
      wrapper.vm.error = "Previous error";
      await wrapper.vm.loadData();
      expect(wrapper.vm.error).toBe("");
    });

    it("sets loading state correctly", async () => {
      wrapper.vm.loading = false;
      wrapper.vm.loadData();
      expect(wrapper.vm.loading).toBe(true);
    });
  });
});
