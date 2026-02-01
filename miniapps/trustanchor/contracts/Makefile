CONTRACT_NAME := MiniAppTrustAnchor
ROOT_DIR := $(abspath $(CURDIR)/../../..)
CONTRACT_DIR := $(CURDIR)
BUILD_DIR := $(ROOT_DIR)/contracts/build

SRC_FILES := $(wildcard $(CONTRACT_DIR)/*.cs)
NEF_FILE := $(BUILD_DIR)/$(CONTRACT_NAME).nef
MANIFEST_FILE := $(BUILD_DIR)/$(CONTRACT_NAME).manifest.json

NCCS_BIN := $(HOME)/.dotnet/tools/nccs

.PHONY: compile build clean

compile:
	@set -e; \
	echo "Compiling $(CONTRACT_NAME)..."; \
	mkdir -p "$(BUILD_DIR)"; \
	TMP_DIR="$(BUILD_DIR)/.tmp-$(CONTRACT_NAME)"; \
	rm -rf "$$TMP_DIR"; mkdir -p "$$TMP_DIR"; \
	"$(NCCS_BIN)" $(SRC_FILES) -o "$$TMP_DIR"; \
	if ! ls "$$TMP_DIR"/*.nef >/dev/null 2>&1; then \
		echo "Error: compilation failed (no .nef output)"; exit 1; \
	fi; \
	mv "$$TMP_DIR"/*.nef "$(BUILD_DIR)/"; \
	if ls "$$TMP_DIR"/*.manifest.json >/dev/null 2>&1; then \
		mv "$$TMP_DIR"/*.manifest.json "$(BUILD_DIR)/"; \
	fi; \
	rm -rf "$$TMP_DIR"; \
	echo "Built: $(NEF_FILE)"

build: compile

clean:
	rm -f "$(NEF_FILE)" "$(MANIFEST_FILE)"
	rm -rf "$(BUILD_DIR)/.tmp-*"
