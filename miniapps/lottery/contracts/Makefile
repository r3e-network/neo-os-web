CONTRACT_NAME := MiniAppLottery
ROOT_DIR := $(abspath $(CURDIR)/../../..)
CONTRACT_DIR := $(CURDIR)
BUILD_DIR := $(ROOT_DIR)/contracts/build

DEVPACK_FILES := \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/ServiceInterfaces.cs \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/MiniAppBase.cs \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/MiniAppGameBase.cs \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/MiniAppServiceBase.cs \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/MiniAppTimeLockBase.cs \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/MiniAppComputeBase.cs \
	$(ROOT_DIR)/contracts/MiniApp.DevPack/MiniAppGameComputeBase.cs

SRC_FILES := $(wildcard $(CONTRACT_DIR)/*.cs)
NEF_FILE := $(BUILD_DIR)/$(CONTRACT_NAME).nef
MANIFEST_FILE := $(BUILD_DIR)/$(CONTRACT_NAME).manifest.json
NCCS_BIN := $(HOME)/.dotnet/tools/nccs

.PHONY: compile build clean

compile:
	@set -e; \
	mkdir -p "$(BUILD_DIR)"; \
	TMP_DIR="$(BUILD_DIR)/.tmp-$(CONTRACT_NAME)"; \
	rm -rf "$$TMP_DIR"; mkdir -p "$$TMP_DIR"; \
	"$(NCCS_BIN)" $(DEVPACK_FILES) $(SRC_FILES) -o "$$TMP_DIR"; \
	mv "$$TMP_DIR"/*.nef "$(BUILD_DIR)/" 2>/dev/null || true; \
	mv "$$TMP_DIR"/*.manifest.json "$(BUILD_DIR)/" 2>/dev/null || true; \
	rm -rf "$$TMP_DIR"; \
	if [ -f "$(NEF_FILE)" ]; then echo "Built: $(NEF_FILE)"; else echo "Error: compilation failed"; exit 1; fi

build: compile

clean:
	rm -f "$(NEF_FILE)" "$(MANIFEST_FILE)"
	rm -rf "$(BUILD_DIR)/.tmp-*"
