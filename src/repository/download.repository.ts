import {EntityRepository, Not, Repository} from "typeorm";
import Download, {DownloadStatus} from "../models/download.model";

@EntityRepository(Download)
export class DownloadRepository extends Repository<Download> {

  findOneByChecksum(remoteFileChecksum: string): Promise<Download | undefined> {
    return this.findOne({remoteFileChecksum});
  }

  findOneByChecksumAndInProgress(remoteFileChecksum: string): Promise<Download | undefined> {
    return this.findOne({
      where: {
        pathIsValid: true,
        remoteFileChecksum,
        status: Not(DownloadStatus.COMPLETED)
      }
    });
  }
}
