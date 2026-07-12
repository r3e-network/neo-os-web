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
  /** Length of the device-local data-URL payload before optional encryption. */
  payloadBytes: number;
}
