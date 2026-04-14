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
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">Quorum Progress</span>
          <span className={`text-sm font-semibold ${data.quorumMet ? "text-emerald-500" : "text-gray-900"}`}>
            {data.totalVotes} / {data.quorum}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${data.quorumMet ? "bg-emerald-500" : "bg-neo"}`}
            style={{ width: `${Math.min(quorumPercentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
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
                : "border-gray-200 bg-white hover:border-gray-300"
            } ${!votingEnabled || data.isFinalized || data.userVoted ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {data.userVoted === option.id && (
                  <span className="text-neo">✓</span>
                )}
                <span className="font-semibold text-gray-900">{option.label}</span>
              </div>
              <span className="text-lg font-bold text-neo">{option.percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-neo transition-all duration-300"
                style={{ width: `${option.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {option.votes} votes
            </p>
          </button>
        ))}
      </div>

      {/* Finalized Status */}
      {data.isFinalized && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            ✓ Voting Finalized
          </p>
        </div>
      )}

      {/* User Voted Status */}
      {data.userVoted && !data.isFinalized && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm text-sky-800">
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
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-500">Total Votes</p>
        <p className="text-lg font-bold text-gray-900">{totalVotes}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-500">Total Voters</p>
        <p className="text-lg font-bold text-gray-900">{totalVoters.toLocaleString()}</p>
      </div>
      {votingPower && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Your Voting Power</p>
          <p className="text-lg font-bold text-neo">{votingPower}</p>
        </div>
      )}
      {timeRemaining && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Time Remaining</p>
          <p className="text-lg font-bold text-gray-900">{timeRemaining}</p>
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
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Delegation</h4>

      {delegatedTo ? (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <p className="text-sm text-gray-500">You delegated to:</p>
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
          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-100"
        >
          Delegate Voting Power
        </button>
      )}

      {delegatedFrom.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-2">
            Delegated to you ({totalDelegated} total)
          </p>
          <div className="space-y-1">
            {delegatedFrom.slice(0, 3).map((d) => (
              <div key={d.address} className="flex justify-between text-xs">
                <span className="font-mono text-gray-600">{d.address.slice(0, 8)}...{d.address.slice(-6)}</span>
                <span className="text-gray-900">{d.amount}</span>
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
