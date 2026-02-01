import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import IndexPage from "./index.vue";

vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    chainType: ref("neo-n3"),
    switchToAppChain: vi.fn(),
  }),
}));

vi.mock("@shared/utils/i18n", () => ({
  createT: (translations: Record<string, { en: string }>) => (key: string) => translations[key]?.en || key,
}));

vi.mock("@shared/components", () => ({
  AppLayout: {
    name: "AppLayout",
    template: '<div class="app-layout"><slot /></div>',
    props: ["title", "showTopNav", "tabs", "activeTab"],
  },
  NeoCard: {
    name: "NeoCard",
    template: '<div class="neo-card"><slot /></div>',
    props: ["title", "variant"],
  },
  NeoButton: {
    name: "NeoButton",
    template: '<button class="neo-button"><slot /></button>',
    props: ["size", "variant", "disabled"],
  },
  NeoDoc: {
    name: "NeoDoc",
    template: '<div class="neo-doc">Documentation</div>',
    props: ["title", "subtitle", "description", "steps", "features"],
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("GrantShare MiniApp", () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    delete (globalThis as any).uni;
  });

  it("renders proposals from GrantShares API", async () => {
    const encodedTitle = Buffer.from("Test Proposal").toString("base64");
    (globalThis as any).uni = {
      request: ({ success }: { success: (data: any) => void }) =>
        success({
          data: {
            total: 1,
            items: [
              {
                offchain_id: "offchain-1",
                onchain_id: 12,
                title: encodedTitle,
                state: "Active",
                proposer: "NX_TEST",
                votes_amount_accept: 5,
                votes_amount_reject: 2,
                discussion_url: "https://example.com",
                offchain_creation_timestamp: "2024-01-01T00:00:00Z",
                offchain_comments_count: 3,
              },
            ],
          },
        }),
    };

    wrapper = mount(IndexPage);
    await flushPromises();
    await nextTick();

    const titles = wrapper.findAll(".grant-title-glass");
    expect(titles).toHaveLength(1);
    expect(titles[0].text()).toBe("Test Proposal");
    expect(wrapper.find(".grant-badge-glass").text()).toBe("Active");
    expect(wrapper.text()).toContain("For 5");
    expect(wrapper.text()).toContain("Against 2");
    expect(wrapper.text()).toContain("Comments 3");
  });

  it("shows error state when API fails", async () => {
    (globalThis as any).uni = {
      request: ({ fail }: { fail: (err: Error) => void }) => fail(new Error("Network error")),
    };

    wrapper = mount(IndexPage);
    await flushPromises();
    await nextTick();

    expect(wrapper.find(".empty-text").text()).toBe("Unable to load proposals");
  });
});
