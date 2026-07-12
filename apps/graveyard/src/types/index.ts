export interface HistoryItem {
  id: string;
  hash: string;
  time: string;
  forgotten?: boolean;
  memoryType?: number;
  /**
   * Optional epitaph attached through addEpitaph. No Graveyard deposit is used,
   * though the signed Neo invocation can still incur a network fee. Read from
   * getMemoryDetails; "" when none is set.
   */
  epitaph?: string;
}
