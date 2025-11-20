(params = {}, secrets = {}) => {
  const wallet = params.wallet || secrets.defaultWallet || "";
  const amount = Number(params.amount || 0);
  const destination = params.destination || wallet;
  const scheduleAt = params.scheduleAt || null;

  if (!wallet) {
    throw new Error("wallet parameter (or defaultWallet secret) is required");
  }
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!destination) {
    throw new Error("destination parameter is required");
  }

  const ensure = Devpack.gasBank.ensureAccount({ wallet });
  const balanceBefore = Devpack.gasBank.balance({ wallet });
  const withdraw = Devpack.gasBank.withdraw({
    wallet,
    amount,
    to: destination,
    scheduleAt,
  });
  const recentTransactions = Devpack.gasBank.listTransactions({
    wallet,
    type: "withdrawal",
    limit: 5,
  });

  return Devpack.respond.success({
    wallet,
    destination,
    scheduleAt,
    amount,
    actions: [
      ensure.asResult({ label: "ensure" }),
      balanceBefore.asResult({ label: "balance_before" }),
      withdraw.asResult({ label: "withdraw" }),
      recentTransactions.asResult({ label: "recent_withdrawals" }),
    ],
  });
}
