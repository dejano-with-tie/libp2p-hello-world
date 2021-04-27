import EventEmitter from "events";
import {delay, inject, singleton} from "tsyringe";
import {FileIntegrityCheckUsecase} from "../usecase/file-integrity-check.usecase";
import Download, {DownloadStatus} from "../models/download.model";
import {DownloadFileFromPeerUsecase} from "../usecase/download-file-from-peer.usecase";
import {DownloadIoHandler} from "../gateway/io/download.io-handler";
import {wrapIoEvent} from "../gateway/io";

@singleton()
export class AppEventEmitter extends EventEmitter {
  public static readonly DOWNLOAD_QUEUED = 'DOWNLOAD_QUEUED'
  public static readonly INTEGRITY_IS_VALID = 'INTEGRITY_IS_VALID'

  constructor(
    @inject(delay(() => FileIntegrityCheckUsecase)) private fileIntegrityCheckUsecase: FileIntegrityCheckUsecase,
    // @inject(delay(() => DownloadFileFromPeerUsecase)) private downloadFileFromPeer: DownloadFileFromPeerUsecase,
    @inject(delay(() => DownloadIoHandler)) private downloadIoHandler: DownloadIoHandler,
  ) {
    super({});
    this.on(AppEventEmitter.DOWNLOAD_QUEUED, async (data: Download) => {
      await fileIntegrityCheckUsecase.execute(data.id);
    });

    this.on(AppEventEmitter.INTEGRITY_IS_VALID, async (data: Download) => {
      if (data.status == DownloadStatus.INTEGRITY_VALID) {
        await downloadIoHandler.progress(wrapIoEvent('download', data.id));
        // const progress = downloadFileFromPeer.execute(data.id);
        // for await(const r of progress) {
        //   console.log(r);
        // }
      }
    });

  }

  delay = (ms: number) => new Promise(_ => setTimeout(_, ms));


}
