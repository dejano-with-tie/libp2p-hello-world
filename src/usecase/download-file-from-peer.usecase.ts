import {singleton} from "tsyringe";
import logger from "../logger";
import {DownloadService} from "../service/download.service";
import {ProtocolService} from "../libp2p-client/protocol.service";
import {DownloadProgress} from "../domain/download.domain";

@singleton()
export class DownloadFileFromPeerUsecase {

  constructor(
    private downloadService: DownloadService,
    private protocolService: ProtocolService
  ) {
  }

  public async* execute(downloadId: number): AsyncIterable<DownloadProgress> {
    logger.info(`DownloadFileFromPeerUsecase ${downloadId}`);
    const download = await this.downloadService.findOne(downloadId);
    yield* this.protocolService.download(download);
    // dlService.get()
    // protocolservice.startDownload(f)
    // for each chunk yield
    // TODO: For each chunk, should emit via socket
  }
}
