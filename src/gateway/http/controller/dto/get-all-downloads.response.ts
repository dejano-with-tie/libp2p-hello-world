import {DownloadStatus} from "../../../../models/download.model";

export interface GetAllDownloadsResponse {
  path: string;
  progress: number;
  size: number;
  status: DownloadStatus;
}
