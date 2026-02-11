import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface StakingStats {
  apy: string;
  total_staked_formatted: string;
}

interface StakingCardProps {
  onStake?: (amount: string) => void;
}

export function StakingCard({ onStake }: StakingCardProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StakingStats>({ apy: "8.5", total_staked_formatted: "12.5M" });

  useEffect(() => {
    fetch("/api/neoburger/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const userBalance = "100";

  const handleStake = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      onStake?.(amount);
      // Redirect to NeoBurger MiniApp
      window.location.href = `/app/miniapp-neoburger?stake=${amount}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-700 p-6 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold">Stake NEO, Earn GAS</h3>
        <span className="rounded-full bg-white/20 px-3 py-1 text-sm">via NeoBurger</span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-white/10 p-3">
          <div className="text-2xl font-bold">{stats.apy}%</div>
          <div className="text-sm text-green-100">Current APY</div>
        </div>
        <div className="rounded-lg bg-white/10 p-3">
          <div className="text-2xl font-bold">{stats.total_staked_formatted}</div>
          <div className="text-sm text-green-100">Total Staked</div>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-sm text-green-100">Amount to Stake (NEO)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min="1"
            className="flex-1 rounded-lg bg-white/20 px-4 py-2 text-white placeholder-green-200"
          />
          <button
            onClick={() => setAmount(userBalance)}
            className="rounded-lg bg-white/20 px-3 py-2 text-sm hover:bg-white/30"
          >
            MAX
          </button>
        </div>
        <div className="mt-1 text-sm text-green-200">Balance: {userBalance} NEO</div>
      </div>

      <Button
        onClick={handleStake}
        disabled={loading || !amount}
        className="w-full bg-white text-green-600 hover:bg-green-50"
      >
        {loading ? "Processing..." : "Stake Now"}
      </Button>

      <p className="mt-3 text-center text-xs text-green-200">Powered by NeoBurger liquid staking</p>
    </div>
  );
}
