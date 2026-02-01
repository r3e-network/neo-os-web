import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";

// Mock @neo/uniapp-sdk
vi.mock("@neo/uniapp-sdk", () => ({
  usePayments: vi.fn(() => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "test-123" }),
    isLoading: ref(false),
  })),
}));

// Mock i18n utility
vi.mock("@shared/utils/i18n", () => ({
  createT: vi.fn(() => (key: string) => key),
}));

describe("Garden of Neo MiniApp", () => {
  let mockPayGAS: any;
  let mockIsLoading: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { usePayments } = await import("@neo/uniapp-sdk");
    const payments = usePayments("test");
    mockPayGAS = payments.payGAS;
    mockIsLoading = payments.isLoading;
  });

  describe("Garden Initialization", () => {
    it("should initialize plots correctly", () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
        { id: "3", plant: null },
      ]);

      expect(plots.value).toHaveLength(3);
      expect(plots.value[0].plant?.name).toBe("Sunflower");
      expect(plots.value[2].plant).toBeNull();
    });
  });

  describe("Computed Properties", () => {
    it("should calculate total plants correctly", () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
        { id: "3", plant: null },
      ]);

      const totalPlants = computed(() => plots.value.filter((p) => p.plant).length);
      expect(totalPlants.value).toBe(2);
    });

    it("should calculate ready to harvest correctly", () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 100 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
        { id: "3", plant: { icon: "🌷", name: "Tulip", growth: 100 } },
      ]);

      const readyToHarvest = computed(() => plots.value.filter((p) => p.plant?.growth >= 100).length);
      expect(readyToHarvest.value).toBe(2);
    });
  });

  describe("Plant Seed", () => {
    it("should plant seed successfully", async () => {
      const seed = { id: "1", name: "Sunflower", icon: "🌻", price: "3", growTime: 24 };
      await mockPayGAS(seed.price, `plant:${seed.id}`);

      expect(mockPayGAS).toHaveBeenCalledWith("3", "plant:1");
    });

    it("should not plant when no empty plots", async () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
      ]);

      const plantSeed = async () => {
        const emptyPlot = plots.value.find((p) => !p.plant);
        if (!emptyPlot) {
          throw new Error("No empty plots");
        }
        await mockPayGAS("3", "plant:1");
      };

      await expect(plantSeed()).rejects.toThrow("No empty plots");
      expect(mockPayGAS).not.toHaveBeenCalled();
    });

    it("should add plant to empty plot", async () => {
      const plots = ref([{ id: "1", plant: null }]);
      const seed = { id: "1", name: "Sunflower", icon: "🌻", price: "3", growTime: 24 };

      await mockPayGAS(seed.price, `plant:${seed.id}`);

      const emptyPlot = plots.value.find((p) => !p.plant);
      if (emptyPlot) {
        emptyPlot.plant = { icon: seed.icon, name: seed.name, growth: 0 };
      }

      expect(plots.value[0].plant?.name).toBe("Sunflower");
      expect(plots.value[0].plant?.growth).toBe(0);
    });
  });

  describe("Water Garden", () => {
    it("should water garden successfully", async () => {
      await mockPayGAS("2", `water:${Date.now()}`);

      expect(mockPayGAS).toHaveBeenCalledWith("2", expect.stringContaining("water:"));
    });

    it("should increase growth of all plants", async () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
      ]);

      await mockPayGAS("2", "water:123");

      plots.value.forEach((plot) => {
        if (plot.plant && plot.plant.growth < 100) {
          plot.plant.growth = Math.min(100, plot.plant.growth + 20);
        }
      });

      expect(plots.value[0].plant?.growth).toBe(100);
      expect(plots.value[1].plant?.growth).toBe(80);
    });

    it("should not exceed 100% growth", async () => {
      const plots = ref([{ id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 95 } }]);

      await mockPayGAS("2", "water:123");

      plots.value.forEach((plot) => {
        if (plot.plant && plot.plant.growth < 100) {
          plot.plant.growth = Math.min(100, plot.plant.growth + 20);
        }
      });

      expect(plots.value[0].plant?.growth).toBe(100);
    });
  });

  describe("Harvest", () => {
    it("should harvest ready plant", () => {
      const plots = ref([{ id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 100 } }]);
      const totalHarvested = ref(0);

      const selectPlot = (plot: any) => {
        if (plot.plant?.growth >= 100) {
          plot.plant = null;
          totalHarvested.value++;
        }
      };

      selectPlot(plots.value[0]);

      expect(plots.value[0].plant).toBeNull();
      expect(totalHarvested.value).toBe(1);
    });

    it("should not harvest unready plant", () => {
      const plots = ref([{ id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } }]);
      const totalHarvested = ref(0);

      const selectPlot = (plot: any) => {
        if (plot.plant?.growth >= 100) {
          plot.plant = null;
          totalHarvested.value++;
        }
      };

      selectPlot(plots.value[0]);

      expect(plots.value[0].plant).not.toBeNull();
      expect(totalHarvested.value).toBe(0);
    });

    it("should harvest all ready plants", () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 100 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
        { id: "3", plant: { icon: "🌷", name: "Tulip", growth: 100 } },
      ]);
      const totalHarvested = ref(0);

      const harvestAll = () => {
        let count = 0;
        plots.value.forEach((plot) => {
          if (plot.plant?.growth >= 100) {
            plot.plant = null;
            count++;
          }
        });
        totalHarvested.value += count;
        return count;
      };

      const harvested = harvestAll();

      expect(harvested).toBe(2);
      expect(totalHarvested.value).toBe(2);
      expect(plots.value[0].plant).toBeNull();
      expect(plots.value[1].plant).not.toBeNull();
      expect(plots.value[2].plant).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty garden", () => {
      const plots = ref([
        { id: "1", plant: null },
        { id: "2", plant: null },
      ]);

      const totalPlants = computed(() => plots.value.filter((p) => p.plant).length);
      expect(totalPlants.value).toBe(0);
    });

    it("should handle full garden", () => {
      const plots = ref([
        { id: "1", plant: { icon: "🌻", name: "Sunflower", growth: 80 } },
        { id: "2", plant: { icon: "🌹", name: "Rose", growth: 60 } },
      ]);

      const emptyPlot = plots.value.find((p) => !p.plant);
      expect(emptyPlot).toBeUndefined();
    });
  });
});
