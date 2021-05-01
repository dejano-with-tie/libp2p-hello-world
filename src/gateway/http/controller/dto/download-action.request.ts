export interface DownloadActionRequest {
  id: number;
  action: DownloadAction;
}

export enum DownloadAction {
  PAUSE = 'PAUSE',
  RESUME = 'RESUME'
}

export interface DeleteDownloadRequest {
  id: number;
  fromFs: boolean;
}
