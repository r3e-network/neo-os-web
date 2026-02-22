/**
 * Voting Components
 * Specialized components for voting templates
 */

export type VotingOption = {
  id: string;
  label: string;
  votes: string;
  percentage: number;
};

export type VotingData = {
  options: VotingOption[];
  totalVotes: string;
  quorum: string;
  quorumMet: boolean;
  endDate?: string;
  isFinalized: boolean;
  userVoted?: string;
};

type VotingProgressProps = {
  data: VotingData;
  onVoteSelect?: (optionId: string) => void;
  selectedOption?: string;
  votingEnabled?: boolean;
};

export function VotingProgress({ data, onVoteSelect, selectedOption, votingEnabled = true }: VotingProgressProps) {
  const quorumPercentage = data.quorum ? (parseFloat(data.totalVotes) / parseFloat(data.quorum)) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Quorum Progress */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Quorum Progress</span>
          <span className={`text-sm font-semibold ${data.quorumMet ? "text-emerald-500" : "text-gray-900 dark:text-white"}`}>
            {data.totalVotes} / {data.quorum}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${data.quorumMet ? "bg-emerald-500" : "bg-neo"}`}
            style={{ width: `${Math.min(quorumPercentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {data.quorumMet ? "✓ Quorum reached" : `${quorumPercentage.toFixed(1)}% of quorum`}
        </p>
      </div>

      {/* Voting Options */}
      <div className="space-y-2">
        {data.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={!votingEnabled || data.isFinalized || !!data.userVoted}
            onClick={() => onVoteSelect?.(option.id)}
            className={`w-full text-left rounded-xl border p-4 transition-all ${
              selectedOption === option.id
                ? "border-neo bg-neo/5"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
            } ${!votingEnabled || data.isFinalized || data.userVoted ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {data.userVoted === option.id && (
                  <span className="text-neo">✓</span>
                )}
                <span className="font-semibold text-gray-900 dark:text-white">{option.label}</span>
              </div>
              <span className="text-lg font-bold text-neo">{option.percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-neo transition-all duration-300"
                style={{ width: `${option.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {option.votes} votes
            </p>
          </button>
        ))}
      </div>

      {/* Finalized Status */}
      {data.isFinalized && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-900/20 p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            ✓ Voting Finalized
          </p>
        </div>
      )}

      {/* User Voted Status */}
      {data.userVoted && !data.isFinalized && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-900/70 dark:bg-sky-900/20 p-4">
          <p className="text-sm text-sky-800 dark:text-sky-200">
            You voted for: <strong>{data.options.find((o) => o.id === data.userVoted)?.label}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

type VotingStatsProps = {
  totalVotes: string;
  totalVoters: number;
  timeRemaining?: string;
  votingPower?: string;
};

export function VotingStats({ totalVotes, totalVoters, timeRemaining, votingPower }: VotingStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Total Votes</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalVotes}</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Total Voters</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalVoters.toLocaleString()}</p>
      </div>
      {votingPower && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Your Voting Power</p>
          <p className="text-lg font-bold text-neo">{votingPower}</p>
        </div>
      )}
      {timeRemaining && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Time Remaining</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{timeRemaining}</p>
        </div>
      )}
    </div>
  );
}

type DelegationInfoProps = {
  delegatedTo?: string;
  delegatedFrom: Array<{ address: string; amount: string }>;
  totalDelegated: string;
  onDelegate?: () => void;
  onUndelegate?: () => void;
};

export function DelegationInfo({ delegatedTo, delegatedFrom, totalDelegated, onDelegate, onUndelegate }: DelegationInfoProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Delegation</h4>

      {delegatedTo ? (
        <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">You delegated to:</p>
          <p className="font-mono text-sm text-neo">{delegatedTo}</p>
          <button
            type="button"
            onClick={onUndelegate}
            className="mt-2 text-xs text-red-500 hover:text-red-600"
          >
            Undelegate
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDelegate}
          className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Delegate Voting Power
        </button>
      )}

      {delegatedFrom.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Delegated to you ({totalDelegated} total)
          </p>
          <div className="space-y-1">
            {delegatedFrom.slice(0, 3).map((d) => (
              <div key={d.address} className="flex justify-between text-xs">
                <span className="font-mono text-gray-600 dark:text-gray-400">{d.address.slice(0, 8)}...{d.address.slice(-6)}</span>
                <span className="text-gray-900 dark:text-white">{d.amount}</span>
              </div>
            ))}
            {delegatedFrom.length > 3 && (
              <p className="text-xs text-gray-400">+{delegatedFrom.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
