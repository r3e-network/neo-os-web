import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import IndexPage from "./index.vue";

const mockInvokeContract = vi.fn().mockResolvedValue({ txid: "0xabc" });
const mockGetContractAddress = vi.fn().mockResolvedValue("0x123");
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockAddress = ref("NX_TEST");

vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: mockAddress,
    connect: mockConnect,
    chainType: ref("neo-n3"),
    switchToAppChain: vi.fn(),
    getContractAddress: mockGetContractAddress,
    invokeContract: mockInvokeContract,
    invokeRead: vi.fn().mockResolvedValue({ stack: [{ value: "0", type: "Integer" }] }),
  }),
  waitForSDK: vi.fn().mockResolvedValue({
    invoke: vi.fn().mockResolvedValue({ stack: [{ value: "0" }] }),
  }),
}));

vi.mock("@shared/utils/i18n", () => ({
  createT: (translations: Record<string, { en: string }>) => (key: string) => translations[key]?.en || key,
}));

vi.mock("@shared/utils/format", () => ({
  formatNumber: (n: number, d = 2) => Number(n).toFixed(d),
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
    props: ["size", "variant", "loading"],
  },
  NeoInput: {
    name: "NeoInput",
    template: '<input class="neo-input" />',
    props: ["modelValue"],
  },
  NeoDoc: {
    name: "NeoDoc",
    template: '<div class="neo-doc">Documentation</div>',
    props: ["title", "subtitle", "description", "steps", "features"],
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Compound Capsule MiniApp", () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("rejects non-integer NEO amounts", async () => {
    wrapper = mount(IndexPage);
    await flushPromises();
    await nextTick();

    wrapper.vm.amount = "1.25";
    await wrapper.vm.createCapsule();

    expect(wrapper.vm.status.msg).toBe("Enter a whole-number NEO amount");
    expect(mockInvokeContract).not.toHaveBeenCalled();
  });

  it("invokes createCapsule with correct lock days", async () => {
    wrapper = mount(IndexPage);
    await flushPromises();
    await nextTick();

    wrapper.vm.amount = "10";
    wrapper.vm.selectedPeriod = 30;
    await wrapper.vm.createCapsule();

    expect(mockInvokeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptHash: "0x123",
        operation: "createCapsule",
        args: [
          { type: "Hash160", value: "NX_TEST" },
          { type: "Integer", value: "10" },
          { type: "Integer", value: "30" },
        ],
      }),
    );
    expect(wrapper.vm.status.msg).toBe("Capsule created");
    expect(wrapper.vm.amount).toBe("");
  });
});
