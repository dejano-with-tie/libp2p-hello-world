import {EntityRepository, Not, Repository} from "typeorm";
import Download, {DownloadStatus} from "../model/download.model";

@EntityRepository(Download)
export class DownloadRepository extends Repository<Download> {

  findOneByChecksum(remoteFileChecksum: string): Promise<Download | undefined> {
    return this.findOne({remoteFileChecksum});
  }

  findOneByChecksumAndInProgress(remoteFileChecksum: string): Promise<Download | undefined> {
    return this.findOne({
      where: {
        remoteFileChecksum,
        status: Not(DownloadStatus.COMPLETED)
      }
    });
  }
}
