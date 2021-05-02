import {DownloadStatus} from "../../../../db/model/download.model";

export interface GetAllDownloadsResponse {
  path: string;
  progress: number;
  size: number;
  status: DownloadStatus;
}
