import {DownloadStatusDomain} from "./download-status.domain";
import {FileDomain} from "./file.domain";

export class DownloadDomain {
  id: number;
  remoteFile: FileDomain;
  progress: number;
  status: DownloadStatusDomain;
  downloadPath: string;

  constructor(id: number, remoteFile: FileDomain, progress: number, status: DownloadStatusDomain, downloadPath: string) {
    this.id = id;
    this.remoteFile = remoteFile;
    this.progress = progress;
    this.status = status;
    this.downloadPath = downloadPath;
  }
}

export interface DownloadProgress {
  progress: number,
  /**
   * size in bytes
   */
  size: number
}
