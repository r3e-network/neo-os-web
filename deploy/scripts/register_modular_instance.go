//go:build scripts

package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

type moduleRegistration struct {
	ModuleID              string          `json:"module_id"`
	Version               string          `json:"version"`
	ContractHash          string          `json:"contract_hash"`
	Binding               string          `json:"binding"`
	Config                json.RawMessage `json:"config"`
	InitSchemaHash        string          `json:"init_schema_hash"`
	OperationSchemaHash   string          `json:"operation_schema_hash"`
	RiskProfile           string          `json:"risk_profile"`
	CompatibilityMetadata json.RawMessage `json:"compatibility_metadata"`
	Active                bool            `json:"active"`
}

type recipeRegistration struct {
	RecipeID              string          `json:"recipe_id"`
	Version               string          `json:"version"`
	ModuleRefs            json.RawMessage `json:"module_refs"`
	RequiredFields        json.RawMessage `json:"required_fields"`
	OperationSchema       json.RawMessage `json:"operation_schema"`
	AllowedRuntimeMode    string          `json:"allowed_runtime_mode"`
	RouterTemplateID      string          `json:"router_template_id"`
	CompatibilityMetadata json.RawMessage `json:"compatibility_metadata"`
	Active                bool            `json:"active"`
}

type instanceRegistration struct {
	InstanceID     string          `json:"instance_id"`
	AppID          string          `json:"app_id"`
	RecipeID       string          `json:"recipe_id"`
	RecipeVersion  string          `json:"recipe_version"`
	RuntimeMode    string          `json:"runtime_mode"`
	Owner          string          `json:"owner"`
	Operator       string          `json:"operator"`
	Developer      string          `json:"developer"`
	RouterContract string          `json:"router_contract"`
	ModuleBindings json.RawMessage `json:"module_bindings"`
	ConfigHash     string          `json:"config_hash"`
	FrontendRef    string          `json:"frontend_ref"`
}

type modularRegistrationPlan struct {
	Name                 string               `json:"name"`
	DefinitionPath       string               `json:"definition_path"`
	RPCURL               string               `json:"rpc_url"`
	ModuleRegistryHash   string               `json:"module_registry_hash"`
	RecipeRegistryHash   string               `json:"recipe_registry_hash"`
	InstanceRegistryHash string               `json:"instance_registry_hash"`
	AppRegistryHash      string               `json:"app_registry_hash"`
	LinkRegistries       bool                 `json:"link_registries"`
	Modules              []moduleRegistration `json:"modules"`
	Recipe               recipeRegistration   `json:"recipe"`
	Instance             instanceRegistration `json:"instance"`
}

type appDefinition struct {
	AppID               string         `json:"app_id"`
	Name                string         `json:"name"`
	Version             string         `json:"version"`
	ContractComposition map[string]any `json:"contract_composition"`
}

func main() {
	planPath := flag.String("plan", "", "Path to modular registration plan JSON")
	dryRun := flag.Bool("dry-run", false, "Print actions without broadcasting transactions")
	validateOnly := flag.Bool("validate-only", false, "Validate plan and exit before signer or RPC setup")
	flag.Parse()

	if strings.TrimSpace(*planPath) == "" {
		fmt.Println("usage: go run -tags=scripts deploy/scripts/register_modular_instance.go --plan deploy/config/modular-neopay.shared.example.json [--dry-run] [--validate-only]")
		os.Exit(1)
	}

	plan, err := loadPlan(*planPath)
	if err != nil {
		fmt.Printf("❌ load plan failed: %v\n", err)
		os.Exit(1)
	}

	if err := enrichPlanFromDefinition(plan, *planPath); err != nil {
		fmt.Printf("❌ enrich plan failed: %v\n", err)
		os.Exit(1)
	}
	if err := validatePlan(plan); err != nil {
		fmt.Printf("❌ invalid modular plan:\n%s\n", err)
		os.Exit(1)
	}
	if *validateOnly {
		printPlanSummary(plan)
		fmt.Println("\n✅ modular registration plan validation passed")
		return
	}

	rpcURL := strings.TrimSpace(plan.RPCURL)
	if rpcURL == "" {
		rpcURL = strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	}
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	fmt.Printf("Plan: %s\n", plan.Name)
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Definition: %s\n", plan.DefinitionPath)
	fmt.Printf("ModuleRegistry: %s\n", plan.ModuleRegistryHash)
	fmt.Printf("RecipeRegistry: %s\n", plan.RecipeRegistryHash)
	fmt.Printf("InstanceRegistry: %s\n", plan.InstanceRegistryHash)
	fmt.Printf("DryRun: %v\n\n", *dryRun)

	moduleRegistry, err := parseUint160(plan.ModuleRegistryHash)
	if err != nil {
		fmt.Printf("❌ invalid module registry hash: %v\n", err)
		os.Exit(1)
	}
	recipeRegistry, err := parseUint160(plan.RecipeRegistryHash)
	if err != nil {
		fmt.Printf("❌ invalid recipe registry hash: %v\n", err)
		os.Exit(1)
	}
	instanceRegistry, err := parseUint160(plan.InstanceRegistryHash)
	if err != nil {
		fmt.Printf("❌ invalid instance registry hash: %v\n", err)
		os.Exit(1)
	}

	if _, err := parseUint160OrAddress(plan.Instance.Owner); err != nil {
		exitTx("parse owner", err)
	}
	if _, err := parseOptionalUint160OrAddress(plan.Instance.Operator); err != nil {
		exitTx("parse operator", err)
	}
	if _, err := parseUint160OrAddress(plan.Instance.Developer); err != nil {
		exitTx("parse developer", err)
	}
	if _, err := parseOptionalUint160OrAddress(plan.Instance.RouterContract); err != nil {
		exitTx("parse router contract", err)
	}

	var act *actor.Actor
	if !*dryRun {
		wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
		if wif == "" {
			wif = strings.TrimSpace(os.Getenv("NEO_WIF"))
		}
		if wif == "" {
			fmt.Println("❌ NEO_TESTNET_WIF or NEO_WIF required")
			os.Exit(1)
		}

		privKey, err := keys.NewPrivateKeyFromWIF(wif)
		if err != nil {
			fmt.Printf("❌ invalid WIF: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Deployer: %s\n", address.Uint160ToString(privKey.GetScriptHash()))
		ctx := context.Background()
		rpcTimeout := resolveRPCTimeout()
		fmt.Printf("RPC timeout: %s\n\n", rpcTimeout)
		client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{
			DialTimeout:    rpcTimeout,
			RequestTimeout: rpcTimeout,
		})
		if err != nil {
			fmt.Printf("❌ RPC connect failed: %v\n", err)
			os.Exit(1)
		}

		acc := wallet.NewAccountFromPrivateKey(privKey)
		act, err = actor.NewSimple(client, acc)
		if err != nil {
			fmt.Printf("❌ actor creation failed: %v\n", err)
			os.Exit(1)
		}
	}

	if plan.LinkRegistries {
		if err := maybeSendCall(*dryRun, act, recipeRegistry, "setModuleRegistry", moduleRegistry); err != nil {
			exitTx("link recipe -> module", err)
		}
		if err := maybeSendCall(*dryRun, act, instanceRegistry, "setRecipeRegistry", recipeRegistry); err != nil {
			exitTx("link instance -> recipe", err)
		}
		if err := maybeSendCall(*dryRun, act, instanceRegistry, "setModuleRegistry", moduleRegistry); err != nil {
			exitTx("link instance -> module", err)
		}
		if strings.TrimSpace(plan.AppRegistryHash) != "" {
			appRegistry, err := parseUint160(plan.AppRegistryHash)
			if err != nil {
				exitTx("parse app registry", err)
			}
			if err := maybeSendCall(*dryRun, act, instanceRegistry, "setAppRegistry", appRegistry); err != nil {
				exitTx("link instance -> app", err)
			}
		}
	}

	for _, module := range plan.Modules {
		contractHash, err := parseUint160(module.ContractHash)
		if err != nil {
			exitTx("parse module contract hash", err)
		}
		if err := maybeSendCall(
			*dryRun,
			act,
			moduleRegistry,
			"upsertModule",
			module.ModuleID,
			module.Version,
			contractHash,
			mustDecodeOptionalHex(module.InitSchemaHash),
			mustDecodeOptionalHex(module.OperationSchemaHash),
			module.RiskProfile,
			normalizeJSONBytes(module.CompatibilityMetadata),
			module.Active,
		); err != nil {
			exitTx("upsert module "+module.ModuleID, err)
		}
	}

	if err := maybeSendCall(
		*dryRun,
		act,
		recipeRegistry,
		"upsertRecipe",
		plan.Recipe.RecipeID,
		plan.Recipe.Version,
		normalizeJSONBytes(plan.Recipe.ModuleRefs),
		normalizeJSONBytes(plan.Recipe.RequiredFields),
		normalizeJSONBytes(plan.Recipe.OperationSchema),
		plan.Recipe.AllowedRuntimeMode,
		plan.Recipe.RouterTemplateID,
		normalizeJSONBytes(plan.Recipe.CompatibilityMetadata),
		plan.Recipe.Active,
	); err != nil {
		exitTx("upsert recipe", err)
	}

	owner, err := parseUint160OrAddress(plan.Instance.Owner)
	if err != nil {
		exitTx("parse owner", err)
	}
	operator, err := parseOptionalUint160OrAddress(plan.Instance.Operator)
	if err != nil {
		exitTx("parse operator", err)
	}
	developer, err := parseUint160OrAddress(plan.Instance.Developer)
	if err != nil {
		exitTx("parse developer", err)
	}
	router, err := parseOptionalUint160OrAddress(plan.Instance.RouterContract)
	if err != nil {
		exitTx("parse router contract", err)
	}

	if err := maybeSendCall(
		*dryRun,
		act,
		instanceRegistry,
		"registerInstance",
		plan.Instance.InstanceID,
		plan.Instance.AppID,
		plan.Instance.RecipeID,
		plan.Instance.RecipeVersion,
		plan.Instance.RuntimeMode,
		owner,
		operator,
		developer,
		router,
		normalizeJSONBytes(plan.Instance.ModuleBindings),
		mustDecodeOptionalHex(plan.Instance.ConfigHash),
		plan.Instance.FrontendRef,
	); err != nil {
		exitTx("register instance", err)
	}

	if err := initializeSharedModules(*dryRun, act, plan); err != nil {
		exitTx("initialize shared modules", err)
	}
	if err := maybeSendCall(
		*dryRun,
		act,
		instanceRegistry,
		"setInstanceStatus",
		plan.Instance.InstanceID,
		1,
		false,
	); err != nil {
		exitTx("activate instance", err)
	}

	fmt.Println("\n✅ modular registration plan completed")
}

func printPlanSummary(plan *modularRegistrationPlan) {
	fmt.Printf("Plan: %s\n", plan.Name)
	fmt.Printf("Definition: %s\n", plan.DefinitionPath)
	fmt.Printf("Recipe: %s@%s\n", plan.Recipe.RecipeID, plan.Recipe.Version)
	fmt.Printf("Instance: %s (app=%s)\n", plan.Instance.InstanceID, plan.Instance.AppID)
	fmt.Printf("Runtime: %s\n", plan.Instance.RuntimeMode)
	fmt.Printf("Modules: %d\n", len(plan.Modules))
	for _, module := range plan.Modules {
		fmt.Printf("  - %s@%s binding=%s contract=%s\n", module.ModuleID, module.Version, module.Binding, module.ContractHash)
	}
}

func loadPlan(planPath string) (*modularRegistrationPlan, error) {
	bytes, err := os.ReadFile(planPath)
	if err != nil {
		return nil, err
	}
	var plan modularRegistrationPlan
	if err := json.Unmarshal(bytes, &plan); err != nil {
		return nil, err
	}
	return &plan, nil
}

func validatePlan(plan *modularRegistrationPlan) error {
	if plan == nil {
		return fmt.Errorf("- plan required")
	}

	issues := make([]string, 0)
	addIssue := func(format string, args ...any) {
		issues = append(issues, fmt.Sprintf("- "+format, args...))
	}

	requireString := func(label, value string) {
		if strings.TrimSpace(value) == "" {
			addIssue("%s required", label)
		}
	}
	validateAddress := func(label, value string, optional bool) {
		raw := strings.TrimSpace(value)
		if raw == "" {
			if !optional {
				addIssue("%s required", label)
			}
			return
		}
		if _, err := parseUint160OrAddress(raw); err != nil {
			addIssue("%s invalid: %v", label, err)
		}
	}
	validateHash160 := func(label, value string, optional bool) {
		raw := strings.TrimSpace(value)
		if raw == "" {
			if !optional {
				addIssue("%s required", label)
			}
			return
		}
		if _, err := parseUint160(raw); err != nil {
			addIssue("%s invalid: %v", label, err)
		}
	}

	validateHash160("module_registry_hash", plan.ModuleRegistryHash, false)
	validateHash160("recipe_registry_hash", plan.RecipeRegistryHash, false)
	validateHash160("instance_registry_hash", plan.InstanceRegistryHash, false)
	validateHash160("app_registry_hash", plan.AppRegistryHash, !plan.LinkRegistries)
	requireString("instance.instance_id", plan.Instance.InstanceID)
	requireString("instance.app_id", plan.Instance.AppID)
	requireString("instance.recipe_id", plan.Instance.RecipeID)
	requireString("instance.recipe_version", plan.Instance.RecipeVersion)
	requireString("instance.runtime_mode", plan.Instance.RuntimeMode)
	validateAddress("instance.owner", plan.Instance.Owner, false)
	validateAddress("instance.operator", plan.Instance.Operator, true)
	validateAddress("instance.developer", plan.Instance.Developer, false)
	validateAddress("instance.router_contract", plan.Instance.RouterContract, true)

	switch strings.TrimSpace(plan.Instance.RuntimeMode) {
	case "shared", "template", "router", "custom":
	case "":
	default:
		addIssue("instance.runtime_mode must be one of shared/template/router/custom")
	}

	requireString("recipe.recipe_id", plan.Recipe.RecipeID)
	requireString("recipe.version", plan.Recipe.Version)
	if plan.Instance.RecipeID != "" && plan.Recipe.RecipeID != "" && plan.Instance.RecipeID != plan.Recipe.RecipeID {
		addIssue("instance.recipe_id %q does not match recipe.recipe_id %q", plan.Instance.RecipeID, plan.Recipe.RecipeID)
	}
	if plan.Instance.RecipeVersion != "" && plan.Recipe.Version != "" && plan.Instance.RecipeVersion != plan.Recipe.Version {
		addIssue("instance.recipe_version %q does not match recipe.version %q", plan.Instance.RecipeVersion, plan.Recipe.Version)
	}
	if allowed := strings.TrimSpace(plan.Recipe.AllowedRuntimeMode); allowed != "" && strings.TrimSpace(plan.Instance.RuntimeMode) != "" && allowed != plan.Instance.RuntimeMode {
		addIssue("instance.runtime_mode %q does not match recipe.allowed_runtime_mode %q", plan.Instance.RuntimeMode, allowed)
	}

	moduleKeys := make(map[string]moduleRegistration, len(plan.Modules))
	moduleBindings := make(map[string]moduleRegistration, len(plan.Modules))
	for index, module := range plan.Modules {
		prefix := fmt.Sprintf("modules[%d]", index)
		if strings.TrimSpace(module.ModuleID) == "" {
			addIssue("%s.module_id required", prefix)
		}
		if strings.TrimSpace(module.Version) == "" {
			addIssue("%s.version required", prefix)
		}
		validateHash160(prefix+".contract_hash", module.ContractHash, false)
		if strings.TrimSpace(module.Binding) == "" {
			addIssue("%s.binding required", prefix)
		}
		key := fmt.Sprintf("%s@%s", module.ModuleID, module.Version)
		if module.ModuleID != "" && module.Version != "" {
			if _, ok := moduleKeys[key]; ok {
				addIssue("duplicate module registration %s", key)
			} else {
				moduleKeys[key] = module
			}
		}
		if module.Binding != "" {
			if existing, ok := moduleBindings[module.Binding]; ok {
				addIssue("duplicate module binding %q for %s and %s", module.Binding, existing.ModuleID, module.ModuleID)
			} else {
				moduleBindings[module.Binding] = module
			}
		}
	}

	recipeRefs, err := decodeJSONArray(plan.Recipe.ModuleRefs)
	if err != nil {
		addIssue("decode recipe.module_refs: %v", err)
	}
	if strings.TrimSpace(plan.Instance.RuntimeMode) == "shared" && len(recipeRefs) == 0 {
		addIssue("shared runtime requires recipe.module_refs")
	}

	requiredBindings := map[string]struct{}{}
	recipeBindings := map[string]string{}
	for i, item := range recipeRefs {
		ref := asObject(item)
		moduleID := strings.TrimSpace(asString(ref["module_id"]))
		version := strings.TrimSpace(asString(ref["version"]))
		binding := strings.TrimSpace(asString(ref["binding"]))
		if moduleID == "" || version == "" || binding == "" {
			addIssue("recipe.module_refs[%d] requires module_id/version/binding", i)
			continue
		}
		if existing, ok := recipeBindings[binding]; ok && existing != fmt.Sprintf("%s@%s", moduleID, version) {
			addIssue("recipe.module_refs[%d] reuses binding %q for %s but it already points to %s", i, binding, fmt.Sprintf("%s@%s", moduleID, version), existing)
		}
		recipeBindings[binding] = fmt.Sprintf("%s@%s", moduleID, version)
		key := fmt.Sprintf("%s@%s", moduleID, version)
		mod, ok := moduleKeys[key]
		if !ok {
			addIssue("recipe.module_refs[%d] references unknown module %s", i, key)
			continue
		}
		if mod.Binding != binding {
			addIssue("recipe.module_refs[%d] binding %q does not match module binding %q", i, binding, mod.Binding)
		}
		requiredBindings[binding] = struct{}{}
	}

	requiredFields, err := decodeJSONObject(plan.Recipe.RequiredFields)
	if err != nil {
		addIssue("decode recipe.required_fields: %v", err)
	}
	for _, binding := range asStringArray(requiredFields["module_bindings"]) {
		requiredBindings[binding] = struct{}{}
	}

	instanceBindings, err := decodeJSONObject(plan.Instance.ModuleBindings)
	if err != nil {
		addIssue("decode instance.module_bindings: %v (expected object keyed by binding, not array)", err)
	}
	if len(requiredBindings) > 0 && len(instanceBindings) == 0 {
		addIssue("instance.module_bindings required for recipe %s", plan.Recipe.RecipeID)
	}
	for binding := range requiredBindings {
		entry, ok := instanceBindings[binding]
		if !ok {
			addIssue("instance.module_bindings missing required binding %q", binding)
			continue
		}
		obj := asObject(entry)
		moduleID := strings.TrimSpace(asString(obj["module_id"]))
		version := strings.TrimSpace(asString(obj["version"]))
		if moduleID == "" || version == "" {
			addIssue("instance.module_bindings[%s] requires module_id/version", binding)
			continue
		}
		key := fmt.Sprintf("%s@%s", moduleID, version)
		mod, ok := moduleKeys[key]
		if !ok {
			addIssue("instance.module_bindings[%s] references unknown module %s", binding, key)
			continue
		}
		if mod.Binding != binding {
			addIssue("instance.module_bindings[%s] does not match module binding %q", binding, mod.Binding)
		}
	}
	for binding := range instanceBindings {
		if _, ok := requiredBindings[binding]; !ok {
			addIssue("instance.module_bindings contains unexpected binding %q not declared by recipe", binding)
		}
	}

	if hash := strings.TrimSpace(strings.TrimPrefix(plan.Instance.ConfigHash, "0x")); hash != "" {
		if len(hash) != 64 {
			addIssue("instance.config_hash must be 32-byte hex when provided")
		} else if _, err := hex.DecodeString(hash); err != nil {
			addIssue("instance.config_hash invalid hex: %v", err)
		}
	}

	hasFundingVault := false
	hasStreamVesting := false
	for _, module := range plan.Modules {
		if module.ModuleID == "module.funding_vault" {
			hasFundingVault = true
		}
		if module.ModuleID == "module.stream_vesting" {
			hasStreamVesting = true
		}
	}
	if hasStreamVesting && !hasFundingVault {
		addIssue("module.stream_vesting requires module.funding_vault in the same registration plan")
	}

	if len(issues) > 0 {
		return fmt.Errorf(strings.Join(issues, "\n"))
	}
	return nil
}

func enrichPlanFromDefinition(plan *modularRegistrationPlan, planPath string) error {
	if strings.TrimSpace(plan.DefinitionPath) == "" {
		return nil
	}
	defPath := plan.DefinitionPath
	if !filepath.IsAbs(defPath) {
		defPath = filepath.Join(filepath.Dir(planPath), "..", "..", defPath)
	}
	bytes, err := os.ReadFile(filepath.Clean(defPath))
	if err != nil {
		return err
	}
	var def appDefinition
	if err := json.Unmarshal(bytes, &def); err != nil {
		return err
	}
	plan.DefinitionPath = filepath.Clean(defPath)
	if plan.Name == "" {
		plan.Name = def.Name
	}
	if plan.Instance.AppID == "" {
		plan.Instance.AppID = def.AppID
	}

	composition := def.ContractComposition
	if len(composition) == 0 {
		return nil
	}

	if plan.Instance.ConfigHash == "" {
		hash, err := stableJSONHashHex(composition)
		if err != nil {
			return err
		}
		plan.Instance.ConfigHash = hash
	}
	if plan.Instance.RuntimeMode == "" {
		plan.Instance.RuntimeMode = strings.TrimSpace(asString(composition["mode"]))
	}
	if recipe := asObject(composition["recipe"]); len(recipe) > 0 {
		if plan.Instance.RecipeID == "" {
			plan.Instance.RecipeID = strings.TrimSpace(asString(recipe["recipe_id"]))
		}
		if plan.Instance.RecipeVersion == "" {
			plan.Instance.RecipeVersion = strings.TrimSpace(asString(recipe["version"]))
		}
		if plan.Recipe.RecipeID == "" {
			plan.Recipe.RecipeID = plan.Instance.RecipeID
		}
		if plan.Recipe.Version == "" {
			plan.Recipe.Version = plan.Instance.RecipeVersion
		}
	}
	if len(plan.Recipe.ModuleRefs) == 0 {
		if modules := asArray(composition["modules"]); len(modules) > 0 {
			refs := make([]map[string]string, 0, len(modules))
			for _, item := range modules {
				mod := asObject(item)
				moduleID := strings.TrimSpace(asString(mod["module_id"]))
				version := strings.TrimSpace(asString(mod["version"]))
				binding := strings.TrimSpace(asString(mod["binding"]))
				if moduleID == "" || version == "" || binding == "" {
					continue
				}
				refs = append(refs, map[string]string{
					"module_id": moduleID,
					"version":   version,
					"binding":   binding,
				})
			}
			if len(refs) > 0 {
				encoded, _ := json.Marshal(refs)
				plan.Recipe.ModuleRefs = encoded
			}
		}
	}
	if len(plan.Recipe.RequiredFields) == 0 {
		requiredFields := map[string]any{}
		if bindings := asObject(composition["module_bindings"]); len(bindings) > 0 {
			keys := make([]string, 0, len(bindings))
			for key := range bindings {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			requiredFields["module_bindings"] = keys
		}
		if permissions := asObject(composition["instance_permissions"]); len(permissions) > 0 {
			keys := make([]string, 0, len(permissions))
			for key := range permissions {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			requiredFields["instance_permissions"] = keys
		}
		if len(requiredFields) > 0 {
			encoded, _ := json.Marshal(requiredFields)
			plan.Recipe.RequiredFields = encoded
		}
	}
	if plan.Recipe.AllowedRuntimeMode == "" {
		plan.Recipe.AllowedRuntimeMode = strings.TrimSpace(asString(composition["mode"]))
	}
	if len(plan.Instance.ModuleBindings) == 0 {
		if bindings := asObject(composition["module_bindings"]); len(bindings) > 0 {
			encoded, _ := json.Marshal(bindings)
			plan.Instance.ModuleBindings = encoded
		} else if modules := composition["modules"]; modules != nil {
			encoded, err := deriveBindingMapFromModules(modules)
			if err != nil {
				return err
			}
			plan.Instance.ModuleBindings = encoded
		}
	}
	if len(plan.Modules) == 0 {
		if modules := asArray(composition["modules"]); len(modules) > 0 {
			for _, item := range modules {
				mod := asObject(item)
				plan.Modules = append(plan.Modules, moduleRegistration{
					ModuleID:    strings.TrimSpace(asString(mod["module_id"])),
					Version:     strings.TrimSpace(asString(mod["version"])),
					Binding:     strings.TrimSpace(asString(mod["binding"])),
					Config:      mustJSONRaw(mod["config"]),
					Active:      true,
					RiskProfile: strings.TrimSpace(asString(mod["risk_profile"])),
				})
			}
		}
	}
	return nil
}

func deriveBindingMapFromModules(value any) (json.RawMessage, error) {
	modules := asArray(value)
	if len(modules) == 0 {
		return nil, nil
	}
	bindings := make(map[string]map[string]string, len(modules))
	for index, item := range modules {
		module := asObject(item)
		binding := strings.TrimSpace(asString(module["binding"]))
		moduleID := strings.TrimSpace(asString(module["module_id"]))
		version := strings.TrimSpace(asString(module["version"]))
		if binding == "" {
			return nil, fmt.Errorf("contract_composition.modules[%d] missing binding; cannot derive instance.module_bindings", index)
		}
		if moduleID == "" || version == "" {
			return nil, fmt.Errorf("contract_composition.modules[%d] missing module_id/version; cannot derive instance.module_bindings", index)
		}
		if _, exists := bindings[binding]; exists {
			return nil, fmt.Errorf("contract_composition.modules reuses binding %q; cannot derive instance.module_bindings", binding)
		}
		bindings[binding] = map[string]string{
			"module_id": moduleID,
			"version":   version,
		}
	}
	encoded, err := json.Marshal(bindings)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(encoded), nil
}

func decodeJSONObject(raw json.RawMessage) (map[string]any, error) {
	if len(raw) == 0 {
		return map[string]any{}, nil
	}
	var value map[string]any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func decodeJSONArray(raw json.RawMessage) ([]any, error) {
	if len(raw) == 0 {
		return []any{}, nil
	}
	var value []any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func maybeSendCall(dryRun bool, act *actor.Actor, contract util.Uint160, operation string, args ...any) error {
	if dryRun {
		fmt.Printf("[dry-run] %s %s\n", contract.StringLE(), operation)
		return nil
	}
	txHash, _, err := act.SendCall(contract, operation, args...)
	if err != nil {
		return err
	}
	fmt.Printf("📤 %s -> %s (%s)\n", operation, contract.StringLE(), txHash.StringLE())
	time.Sleep(2 * time.Second)
	return nil
}

func resolveRPCTimeout() time.Duration {
	if raw := os.Getenv("NEO_RPC_TIMEOUT_SECONDS"); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
	}
	return 30 * time.Second
}

func initializeSharedModules(dryRun bool, act *actor.Actor, plan *modularRegistrationPlan) error {
	if strings.TrimSpace(plan.Instance.RuntimeMode) != "shared" {
		return nil
	}

	moduleHashes := make(map[string]util.Uint160)
	for _, module := range plan.Modules {
		if strings.TrimSpace(module.ContractHash) == "" {
			continue
		}
		hash, err := parseUint160(module.ContractHash)
		if err != nil {
			return fmt.Errorf("parse hash for %s: %w", module.ModuleID, err)
		}
		moduleHashes[module.ModuleID] = hash
	}

	fundingVaultHash, hasFundingVault := moduleHashes["module.funding_vault"]
	streamVestingHash, hasStreamVesting := moduleHashes["module.stream_vesting"]
	owner, err := parseUint160OrAddress(plan.Instance.Owner)
	if err != nil {
		return fmt.Errorf("parse instance owner: %w", err)
	}

	for _, module := range plan.Modules {
		switch module.ModuleID {
		case "module.funding_vault":
			operator := util.Uint160{}
			if hasStreamVesting {
				operator = streamVestingHash
			}
			if err := maybeSendCall(
				dryRun,
				act,
				fundingVaultHash,
				"initializeInstance",
				plan.Instance.InstanceID,
				owner,
				operator,
				normalizeJSONBytes(module.Config),
			); err != nil {
				return fmt.Errorf("initialize funding vault: %w", err)
			}
		case "module.stream_vesting":
			if !hasFundingVault {
				return fmt.Errorf("module.stream_vesting requires module.funding_vault hash")
			}
			if err := maybeSendCall(
				dryRun,
				act,
				streamVestingHash,
				"initializeInstance",
				plan.Instance.InstanceID,
				owner,
				util.Uint160{},
				fundingVaultHash,
				normalizeJSONBytes(module.Config),
			); err != nil {
				return fmt.Errorf("initialize stream vesting: %w", err)
			}
		}
	}

	return nil
}

func stableJSONHashHex(v any) (string, error) {
	payload, err := stableJSON(v)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:]), nil
}

func stableJSON(v any) (string, error) {
	var b strings.Builder
	if err := writeJSON(&b, v); err != nil {
		return "", err
	}
	return b.String(), nil
}

func writeJSON(b *strings.Builder, v any) error {
	switch val := v.(type) {
	case nil:
		b.WriteString("null")
	case map[string]any:
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			kj, _ := json.Marshal(k)
			b.Write(kj)
			b.WriteByte(':')
			if err := writeJSON(b, val[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	case []any:
		b.WriteByte('[')
		for i, item := range val {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeJSON(b, item); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	default:
		enc, err := json.Marshal(val)
		if err != nil {
			return err
		}
		b.Write(enc)
	}
	return nil
}

func parseUint160(value string) (util.Uint160, error) {
	raw := strings.TrimSpace(strings.TrimPrefix(value, "0x"))
	return util.Uint160DecodeStringLE(raw)
}

func parseUint160OrAddress(value string) (util.Uint160, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return util.Uint160{}, fmt.Errorf("value required")
	}
	if strings.HasPrefix(raw, "N") {
		return address.StringToUint160(raw)
	}
	return parseUint160(raw)
}

func parseOptionalUint160OrAddress(value string) (util.Uint160, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return util.Uint160{}, nil
	}
	return parseUint160OrAddress(raw)
}

func mustDecodeOptionalHex(value string) []byte {
	raw := strings.TrimSpace(strings.TrimPrefix(value, "0x"))
	if raw == "" {
		return []byte{}
	}
	bytes, err := hex.DecodeString(raw)
	if err != nil {
		fmt.Printf("❌ invalid hex bytes: %v\n", err)
		os.Exit(1)
	}
	return bytes
}

func normalizeJSONBytes(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte{}
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		fmt.Printf("❌ invalid JSON blob: %v\n", err)
		os.Exit(1)
	}
	stable, err := stableJSON(value)
	if err != nil {
		fmt.Printf("❌ canonicalize JSON blob failed: %v\n", err)
		os.Exit(1)
	}
	return []byte(stable)
}

func mustJSONRaw(value any) json.RawMessage {
	if value == nil {
		return nil
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		fmt.Printf("❌ encode json blob failed: %v\n", err)
		os.Exit(1)
	}
	return json.RawMessage(encoded)
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}

func asObject(value any) map[string]any {
	obj, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return obj
}

func asArray(value any) []any {
	arr, ok := value.([]any)
	if !ok {
		return []any{}
	}
	return arr
}

func asStringArray(value any) []string {
	arr := asArray(value)
	if len(arr) == 0 {
		return []string{}
	}
	result := make([]string, 0, len(arr))
	for _, item := range arr {
		text := strings.TrimSpace(asString(item))
		if text == "" {
			continue
		}
		result = append(result, text)
	}
	return result
}

func exitTx(label string, err error) {
	fmt.Printf("❌ %s failed: %v\n", label, err)
	os.Exit(1)
}
