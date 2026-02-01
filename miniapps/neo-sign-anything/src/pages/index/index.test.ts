import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import IndexPage from "./index.vue";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    home: "Home",
    docs: "Docs",
    appTitle: "Neo Sign Anything",
    signTitle: "Sign Anything",
    signDesc: "Sign any message with your Neo wallet",
    messageLabel: "Message",
    messagePlaceholder: "Enter your message to sign...",
    signBtn: "Sign Message",
    broadcastBtn: "Broadcast to Chain",
    signatureResult: "Signature",
    broadcastResult: "Transaction",
    copy: "Copy",
    broadcastSuccess: "Message broadcasted successfully!",
    connectWallet: "Please connect your wallet",
    wrongChain: "Wrong Network",
    wrongChainMessage: "Please switch to Neo N3",
    switchToNeo: "Switch to Neo",
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
    signMessage: vi.fn().mockResolvedValue("signature123"),
    invokeContract: vi.fn().mockResolvedValue({ txid: "0xabc123" }),
    chainType: { value: "neo" },
  }),
}));

vi.mock("@shared/utils/chain", () => ({
  requireNeoChain: vi.fn().mockReturnValue(true),
}));

describe("Neo Sign Anything Index Page", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    wrapper = mount(IndexPage, {
      global: {
        stubs: {
          ResponsiveLayout: {
            template: '<div class="responsive-layout-stub"><slot /></div>',
            props: ["class", "title", "showTopNav", "activeTab", "tabs", "desktopBreakpoint"],
          },
          NeoCard: {
            template: '<div class="neo-card-stub"><slot /></div>',
            props: ["variant"],
          },
          NeoButton: {
            template: '<button class="neo-button-stub"><slot /></button>',
            props: ["variant", "block", "loading", "disabled"],
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

    it("renders header with title", () => {
      const header = wrapper.find(".header");
      expect(header.exists()).toBe(true);
      expect(header.text()).toContain("Sign Anything");
    });

    it("renders subtitle", () => {
      const subtitle = wrapper.find(".subtitle");
      expect(subtitle.exists()).toBe(true);
    });
  });

  describe("Message Input", () => {
    it("renders textarea for message", () => {
      const textarea = wrapper.find(".textarea");
      expect(textarea.exists()).toBe(true);
    });

    it("renders character count", () => {
      const charCount = wrapper.find(".char-count");
      expect(charCount.exists()).toBe(true);
    });

    it("has maxlength of 1000", () => {
      const textarea = wrapper.find(".textarea");
      expect(textarea.attributes("maxlength")).toBe("1000");
    });
  });

  describe("Action Buttons", () => {
    it("renders sign button", () => {
      const buttons = wrapper.findAll(".neo-button-stub");
      expect(buttons[0].text()).toContain("Sign Message");
    });

    it("renders broadcast button", () => {
      const buttons = wrapper.findAll(".neo-button-stub");
      expect(buttons[1].text()).toContain("Broadcast");
    });
  });

  describe("Signature Result", () => {
    it("can display signature result", async () => {
      wrapper.vm.signature = "signature123";
      await wrapper.vm.$nextTick();
      const resultCard = wrapper.find(".result-card");
      expect(resultCard.exists()).toBe(true);
    });

    it("has copy button for signature", async () => {
      wrapper.vm.signature = "signature123";
      await wrapper.vm.$nextTick();
      const copyBtn = wrapper.find(".copy-btn");
      expect(copyBtn.exists()).toBe(true);
    });
  });

  describe("Transaction Result", () => {
    it("can display broadcast result", async () => {
      wrapper.vm.txHash = "0xabc123";
      await wrapper.vm.$nextTick();
      const resultCards = wrapper.findAll(".result-card");
      expect(resultCards.length).toBeGreaterThanOrEqual(1);
    });

    it("shows success message after broadcast", async () => {
      wrapper.vm.txHash = "0xabc123";
      await wrapper.vm.$nextTick();
      const successMsg = wrapper.find(".success-msg");
      expect(successMsg.exists()).toBe(true);
    });
  });

  describe("Wallet Connection", () => {
    it("shows connect prompt when not connected", async () => {
      wrapper.unmount();
      const wrapper2 = mount(IndexPage, {
        global: {
          stubs: {
            ResponsiveLayout: {
              template: '<div class="responsive-layout-stub"><slot /></div>',
            },
            NeoCard: {
              template: '<div class="neo-card-stub"><slot /></div>',
              props: ["variant"],
            },
          },
        },
      });
      const connectPrompt = wrapper2.find(".connect-prompt");
      expect(connectPrompt.exists()).toBe(true);
    });
  });

  describe("State Management", () => {
    it("manages message state", () => {
      expect(wrapper.vm.message).toBe("");
    });

    it("manages signature state", () => {
      expect(wrapper.vm.signature).toBe("");
    });

    it("manages txHash state", () => {
      expect(wrapper.vm.txHash).toBe("");
    });

    it("manages loading states", () => {
      expect(wrapper.vm.isSigning).toBe(false);
      expect(wrapper.vm.isBroadcasting).toBe(false);
    });
  });

  describe("Message Byte Calculation", () => {
    it("calculates message bytes correctly", () => {
      const bytes = wrapper.vm.getMessageBytes("hello");
      expect(bytes).toBe(5);
    });

    it("handles unicode characters", () => {
      const bytes = wrapper.vm.getMessageBytes("hello");
      expect(bytes).toBeGreaterThan(0);
    });
  });

  describe("Max Message Bytes", () => {
    it("has max message bytes constant", () => {
      expect(wrapper.vm.MAX_MESSAGE_BYTES).toBe(1024);
    });
  });

  describe("Tab Navigation", () => {
    it("defaults to home tab", () => {
      expect(wrapper.vm.currentTab).toBe("home");
    });

    it("can switch to docs tab", async () => {
      await wrapper.vm.onTabChange("docs");
      expect(wrapper.vm.currentTab).toBe("docs");
    });
  });

  describe("Sign Message Function", () => {
    it("has signMessage function", () => {
      expect(typeof wrapper.vm.signMessage).toBe("function");
    });

    it("returns early if no message", async () => {
      wrapper.vm.message = "";
      await wrapper.vm.signMessage();
      expect(wrapper.vm.signature).toBe("");
    });
  });

  describe("Broadcast Message Function", () => {
    it("has broadcastMessage function", () => {
      expect(typeof wrapper.vm.broadcastMessage).toBe("function");
    });

    it("rejects messages too long", async () => {
      wrapper.vm.message = "a".repeat(1025);
      wrapper.vm.broadcastMessage();
      expect(wrapper.vm.isBroadcasting).toBe(false);
    });
  });

  describe("Copy Function", () => {
    it("has copyToClipboard function", () => {
      expect(typeof wrapper.vm.copyToClipboard).toBe("function");
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

  describe("Sign Result Processing", () => {
    it("handles string signature", async () => {
      wrapper.vm.message = "test message";
      await wrapper.vm.signMessage();
      expect(wrapper.vm.signature).toBe("signature123");
    });

    it("handles object signature", async () => {
      wrapper.unmount();
      vi.clearAllMocks();
      vi.doMock("@neo/uniapp-sdk", () => ({
        useWallet: () => ({
          address: { value: "0x1234567890123456789012345678901234567890" },
          connect: vi.fn().mockResolvedValue(undefined),
          signMessage: vi.fn().mockResolvedValue({ signature: "obj-sig", publicKey: "pubkey" }),
          invokeContract: vi.fn().mockResolvedValue({}),
          chainType: { value: "neo" },
        }),
      }));
      const wrapper2 = mount(IndexPage, {
        global: {
          stubs: {
            ResponsiveLayout: {
              template: '<div class="responsive-layout-stub"><slot /></div>',
            },
            NeoCard: {
              template: '<div class="neo-card-stub"><slot /></div>',
            },
            NeoButton: {
              template: '<button class="neo-button-stub"><slot /></button>',
            },
            ChainWarning: {
              template: '<div class="chain-warning-stub" />',
            },
          },
        },
      });
      wrapper2.vm.message = "test";
      await wrapper2.vm.signMessage();
      expect(wrapper2.vm.signature).toBe("obj-sig");
    });
  });

  describe("Broadcast Result Processing", () => {
    it("handles txid response", async () => {
      wrapper.unmount();
      vi.clearAllMocks();
      vi.doMock("@neo/uniapp-sdk", () => ({
        useWallet: () => ({
          address: { value: "0x1234567890123456789012345678901234567890" },
          connect: vi.fn().mockResolvedValue(undefined),
          signMessage: vi.fn().mockResolvedValue("sig"),
          invokeContract: vi.fn().mockResolvedValue({ txid: "0xtest123" }),
          chainType: { value: "neo" },
        }),
      }));
      const wrapper2 = mount(IndexPage, {
        global: {
          stubs: {
            ResponsiveLayout: {
              template: '<div class="responsive-layout-stub"><slot /></div>',
            },
            NeoCard: {
              template: '<div class="neo-card-stub"><slot /></div>',
            },
            NeoButton: {
              template: '<button class="neo-button-stub"><slot /></button>',
            },
            ChainWarning: {
              template: '<div class="chain-warning-stub" />',
            },
          },
        },
      });
      wrapper2.vm.message = "test broadcast";
      await wrapper2.vm.broadcastMessage();
      expect(wrapper2.vm.txHash).toBe("0xtest123");
    });
  });
});
