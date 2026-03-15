export interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

export interface UploadItem {
  id: string;
  dataUrl: string;
  size: number;
}
