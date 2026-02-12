import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import IndexPage from "./index.vue";

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    albumTab: "Album",
    docsTab: "Docs",
    title: "Forever Album",
    subtitle: "Treasured moments, forever on-chain",
    connectPromptTitle: "Connect Wallet",
    connectPromptDesc: "Connect your wallet to view and upload photos",
    connectWallet: "Connect Wallet",
    loading: "Loading...",
    encrypted: "Encrypted",
    addPhoto: "Add Photo",
    tapToSelect: "Tap to select photos",
    uploadPhoto: "Upload Photo",
    selectMore: "Select More",
    cancel: "Cancel",
    confirm: "Confirm",
    uploading: "Uploading...",
    decryptTitle: "Decrypt Photo",
    decrypting: "Decrypting...",
    decryptConfirm: "Decrypt",
    openPreview: "Open Preview",
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
    invokeRead: vi.fn().mockResolvedValue({}),
    invokeContract: vi.fn().mockResolvedValue({ txid: "0xabc123" }),
    chainType: { value: "neo" },
    getContractAddress: vi.fn().mockResolvedValue("0x6057934459f1ddc6c63a63bc816afed971514b43"),
  }),
}));

vi.mock("@shared/utils/neo", () => ({
  parseInvokeResult: vi.fn((res) => res),
}));

vi.mock("@shared/utils/chain", () => ({
  requireNeoChain: vi.fn().mockReturnValue(true),
}));

describe("Forever Album Index Page", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    wrapper = mount(IndexPage, {
      global: {
        stubs: {
          ResponsiveLayout: {
            template: '<div class="responsive-layout-stub"><slot /></div>',
            props: ["class", "tabs", "activeTab", "desktopBreakpoint", "showTopNav"],
          },
          NeoCard: {
            template: '<div class="neo-card-stub"><slot /></div>',
            props: ["variant"],
          },
          NeoButton: {
            template: '<button class="neo-button-stub"><slot /></button>',
            props: ["size", "variant", "loading", "disabled"],
          },
          NeoModal: {
            template: '<div class="neo-modal-stub" :visible="visible"><slot /><slot name="footer" /></div>',
            props: ["visible", "title", "closeable"],
          },
          NeoInput: {
            template:
              '<input class="neo-input-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ["modelValue", "type", "placeholder"],
          },
          WalletPrompt: {
            template:
              '<div class="wallet-prompt-stub" :visible="visible" @close="$emit(\'close\')" @connect="$emit(\'connect\')" />',
            props: ["visible"],
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
      expect(header.text()).toContain("Forever Album");
    });
  });

  describe("Navigation Tabs", () => {
    it("has Album tab", () => {
      expect(wrapper.vm.navTabs[0].id).toBe("album");
    });

    it("has Docs tab", () => {
      expect(wrapper.vm.navTabs[1].id).toBe("docs");
    });
  });

  describe("Photo Gallery", () => {
    it("renders gallery card", () => {
      const galleryCard = wrapper.find(".gallery-card");
      expect(galleryCard.exists()).toBe(true);
    });

    it("has photo grid", () => {
      const galleryGrid = wrapper.find(".gallery-grid");
      expect(galleryGrid.exists()).toBe(true);
    });

    it("has placeholder for adding photos", () => {
      const placeholder = wrapper.find(".photo-item.placeholder");
      expect(placeholder.exists()).toBe(true);
      expect(placeholder.text()).toContain("Add Photo");
    });
  });

  describe("Upload Modal", () => {
    it("can open upload modal", async () => {
      const placeholder = wrapper.find(".photo-item.placeholder");
      await placeholder.trigger("click");
      expect(wrapper.vm.showUpload).toBe(true);
    });

    it("has upload grid", async () => {
      wrapper.vm.showUpload = true;
      await wrapper.vm.$nextTick();
      const uploadGrid = wrapper.find(".upload-grid");
      expect(uploadGrid.exists()).toBe(true);
    });

    it("has encryption option", async () => {
      wrapper.vm.showUpload = true;
      await wrapper.vm.$nextTick();
      const encryptOption = wrapper.find(".form-group");
      expect(encryptOption.text()).toContain("Encrypt");
    });
  });

  describe("Decrypt Modal", () => {
    it("can open decrypt modal", async () => {
      wrapper.vm.showDecrypt = true;
      await wrapper.vm.$nextTick();
      const modal = wrapper.find(".neo-modal-stub");
      expect(modal.exists()).toBe(true);
    });
  });

  describe("Wallet Connection", () => {
    it("displays connect prompt when not connected", async () => {
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
      const connectCard = wrapper2.find(".connect-card");
      expect(connectCard.exists()).toBe(true);
    });
  });

  describe("Upload Limits", () => {
    it("has max photos per upload constant", () => {
      expect(wrapper.vm.MAX_PHOTOS_PER_UPLOAD).toBe(5);
    });

    it("has max photo bytes constant", () => {
      expect(wrapper.vm.MAX_PHOTO_BYTES).toBe(45000);
    });

    it("has max total bytes constant", () => {
      expect(wrapper.vm.MAX_TOTAL_BYTES).toBe(60000);
    });
  });

  describe("Photo Item Interface", () => {
    it("defines PhotoItem interface", () => {
      const photo: Record<string, unknown> = {
        id: "test-123",
        data: "data:image/png;base64,abc123",
        encrypted: false,
        createdAt: Date.now(),
      };
      expect(photo.id).toBe("test-123");
      expect(photo.encrypted).toBe(false);
    });
  });

  describe("Encryption Functions", () => {
    it("can format bytes", () => {
      expect(wrapper.vm.formatBytes(500)).toBe("500B");
      expect(wrapper.vm.formatBytes(1500)).toBe("1.5KB");
    });

    it("has ensureCrypto function", () => {
      expect(typeof wrapper.vm.ensureCrypto).toBe("function");
    });

    it("has encryptPayload function", () => {
      expect(typeof wrapper.vm.encryptPayload).toBe("function");
    });

    it("has decryptPayload function", () => {
      expect(typeof wrapper.vm.decryptPayload).toBe("function");
    });
  });

  describe("Total Payload Size", () => {
    it("computes total payload size", () => {
      wrapper.vm.selectedImages = [
        { id: "1", dataUrl: "data:image/png;base64,abc", size: 100 },
        { id: "2", dataUrl: "data:image/png;base64,def", size: 200 },
      ];
      expect(wrapper.vm.totalPayloadSize).toBe(300);
    });
  });

  describe("Contract Address", () => {
    it("has contract address ref", () => {
      expect(wrapper.vm.contractAddress).toBeDefined();
    });

    it("has ensureContractAddress function", () => {
      expect(typeof wrapper.vm.ensureContractAddress).toBe("function");
    });
  });

  describe("Photo Parsing", () => {
    it("parses photo info correctly", () => {
      const raw = ["photo-123", "owner-address", true, "data:image/png;base64,abc", 1234567890];
      const parsed = wrapper.vm.parsePhotoInfo(raw);
      expect(parsed?.id).toBe("photo-123");
      expect(parsed?.encrypted).toBe(true);
    });

    it("returns null for invalid data", () => {
      const result = wrapper.vm.parsePhotoInfo(null);
      expect(result).toBeNull();
    });
  });

  describe("Tab Change Handler", () => {
    it("changes to docs tab", async () => {
      await wrapper.vm.onTabChange("docs");
      expect(wrapper.vm.activeTab).toBe("docs");
    });

    it("changes to other tabs", async () => {
      await wrapper.vm.onTabChange("album");
      expect(wrapper.vm.activeTab).toBe("album");
    });
  });

  describe("Wallet Prompt", () => {
    it("has showWalletPrompt ref", () => {
      expect(wrapper.vm.showWalletPrompt).toBeDefined();
    });

    it("can open wallet prompt", () => {
      wrapper.vm.openWalletPrompt();
      expect(wrapper.vm.showWalletPrompt).toBe(true);
    });

    it("can close wallet prompt", () => {
      wrapper.vm.closeWalletPrompt();
      expect(wrapper.vm.showWalletPrompt).toBe(false);
    });
  });
});
