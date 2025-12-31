/**
 * ExecutionList Component
 *
 * Displays real-time execution history with live updates.
 */

import { useExecutionStatus, type Execution } from "@/hooks/useExecutionStatus";
import { ExecutionStatusBadge } from "./ExecutionStatusBadge";

interface ExecutionListProps {
  appId?: string;
  userAddress?: string;
  limit?: number;
}

export function ExecutionList({ appId, userAddress, limit = 10 }: ExecutionListProps) {
  const { executions, isConnected, error } = useExecutionStatus({ appId, userAddress });

  const displayExecutions = executions.slice(0, limit);

  if (error) {
    return <div className="p-4 text-red-500 dark:text-red-400 text-sm">Failed to load executions: {error.message}</div>;
  }

  return (
    <div className="space-y-2">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`} />
        {isConnected ? "Live" : "Connecting..."}
      </div>

      {/* Execution list */}
      {displayExecutions.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No executions yet</div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {displayExecutions.map((exec) => (
            <ExecutionItem key={exec.request_id} execution={exec} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutionItem({ execution }: { execution: Execution }) {
  const timeAgo = getTimeAgo(execution.created_at);

  return (
    <div className="py-3 flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{execution.method}</span>
          <ExecutionStatusBadge status={execution.status} />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {execution.request_id.slice(0, 8)}... • {timeAgo}
        </div>
      </div>
      {execution.tx_hash && (
        <a
          href={`https://explorer.neo.org/tx/${execution.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          View TX
        </a>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
