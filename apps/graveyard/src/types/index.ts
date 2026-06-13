export interface HistoryItem {
  id: string;
  hash: string;
  time: string;
  forgotten?: boolean;
  memoryType?: number;
  /**
   * Optional epitaph attached to a buried memory via addEpitaph (a free,
   * non-deposit call). Read from getMemoryDetails; "" when none is set.
   */
  epitaph?: string;
}
