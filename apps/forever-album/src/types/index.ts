export interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

export interface UploadItem {
  id: string;
  dataUrl: string;
  /** Raw file byte size (file.size). */
  size: number;
  /** Length of the data-URL payload that is actually written on-chain. */
  payloadBytes: number;
}
