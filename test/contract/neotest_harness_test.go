package contract

import (
	"testing"

	"github.com/nspcc-dev/neo-go/pkg/neotest"
	neotestchain "github.com/nspcc-dev/neo-go/pkg/neotest/chain"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/stretchr/testify/require"
)

type neoTestContractHarness struct {
	executor *neotest.Executor
	invoker  *neotest.ContractInvoker
	deployer neotest.Signer
}

func deployContractNeotest(t *testing.T, contractName string, data any) *neoTestContractHarness {
	t.Helper()
	SkipIfNoCompiledContracts(t)

	nefPath, manifestPath, err := FindContractArtifacts(contractName)
	require.NoError(t, err)

	bc, validator := neotestchain.NewSingle(t)
	executor := neotest.NewExecutor(t, bc, validator, validator)
	contract := neotest.ReadNEF(t, validator.ScriptHash(), nefPath, manifestPath)
	executor.DeployContract(t, contract, data)

	return &neoTestContractHarness{
		executor: executor,
		invoker:  executor.ValidatorInvoker(contract.Hash),
		deployer: validator,
	}
}

func (h *neoTestContractHarness) deployerHash() util.Uint160 {
	return h.deployer.ScriptHash()
}

func (h *neoTestContractHarness) requireAdminEqualsDeployer(t *testing.T) {
	t.Helper()
	h.requireHash160Equals(t, "admin", h.deployerHash())
}

func (h *neoTestContractHarness) requireHash160Equals(t *testing.T, method string, expected util.Uint160) {
	t.Helper()

	h.invoker.InvokeAndCheck(t, func(t testing.TB, stack []stackitem.Item) {
		require.Len(t, stack, 1)
		actual := requireUint160(t, stack[0])
		require.Equal(t, expected, actual)
	}, method)
}

func (h *neoTestContractHarness) requireStringArrayContains(t *testing.T, method string, minLen int, values ...string) {
	t.Helper()

	h.invoker.InvokeAndCheck(t, func(t testing.TB, stack []stackitem.Item) {
		require.Len(t, stack, 1)
		items := requireArray(t, stack[0])
		require.GreaterOrEqual(t, len(items), minLen)

		found := make(map[string]bool, len(values))
		for _, value := range values {
			found[value] = false
		}
		for _, item := range items {
			text := requireString(t, item)
			if _, ok := found[text]; ok {
				found[text] = true
			}
		}
		for _, value := range values {
			require.True(t, found[value], "missing %q in %s() result", value, method)
		}
	}, method)
}

func (h *neoTestContractHarness) invokeVoid(t *testing.T, method string, args ...any) {
	t.Helper()
	h.invoker.Invoke(t, stackitem.Null{}, method, args...)
}

func (h *neoTestContractHarness) invokeFault(t *testing.T, message, method string, args ...any) {
	t.Helper()
	h.invoker.InvokeFail(t, message, method, args...)
}

func (h *neoTestContractHarness) requireLotteryStateZeroed(t *testing.T) {
	t.Helper()

	h.invoker.InvokeAndCheck(t, func(t testing.TB, stack []stackitem.Item) {
		require.Len(t, stack, 1)
		fields := requireArray(t, stack[0])
		require.Len(t, fields, 3)

		isDrawn, err := fields[0].TryBool()
		require.NoError(t, err)
		require.False(t, isDrawn)

		totalTickets := requireInteger(t, fields[1])
		require.Zero(t, totalTickets.Sign())

		prizePool := requireInteger(t, fields[2])
		require.Zero(t, prizePool.Sign())
	}, "getLotteryState")
}

func requireUint160(t testing.TB, item stackitem.Item) util.Uint160 {
	t.Helper()

	value, err := item.TryBytes()
	require.NoError(t, err)

	hash, err := util.Uint160DecodeBytesBE(value)
	require.NoError(t, err)
	return hash
}

func requireArray(t testing.TB, item stackitem.Item) []stackitem.Item {
	t.Helper()

	value, ok := item.Value().([]stackitem.Item)
	require.True(t, ok, "expected array-like stack item, got %T", item.Value())
	return value
}

func requireString(t testing.TB, item stackitem.Item) string {
	t.Helper()

	value, err := item.TryBytes()
	require.NoError(t, err)
	return string(value)
}

func requireInteger(t testing.TB, item stackitem.Item) interface{ Sign() int } {
	t.Helper()

	value, err := item.TryInteger()
	require.NoError(t, err)
	return value
}
