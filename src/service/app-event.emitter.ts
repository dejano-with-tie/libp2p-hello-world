import EventEmitter from "events";
import {delay, inject, singleton} from "tsyringe";
import Download, {DownloadStatus} from "../db/model/download.model";
import {DownloadIoHandler} from "../gateway/io/download.io-handler";
import {wrapIoEvent} from "../gateway/io/io-handler";

@singleton()
export class AppEventEmitter extends EventEmitter {
  public static readonly DOWNLOAD_QUEUED = 'DOWNLOAD_QUEUED'
  public static readonly DOWNLOAD_RESUMED = 'DOWNLOAD_RESUMED'
  public static readonly INTEGRITY_IS_VALID = 'INTEGRITY_IS_VALID'

  constructor(
    @inject(delay(() => DownloadIoHandler)) private downloadIoHandler: DownloadIoHandler,
  ) {
    super({});
    this.on(AppEventEmitter.DOWNLOAD_QUEUED, async (data: Download) => {
      if (data.status == DownloadStatus.PENDING) {
        await downloadIoHandler.progress(wrapIoEvent('download', data.id));
        // const progress = downloadFileFromPeer.execute(data.id);
        // for await(const r of progress) {
        //   console.log(r);
        // }
      }
    });

    this.on(AppEventEmitter.DOWNLOAD_RESUMED, async (data: Download) => {
      await downloadIoHandler.progress(wrapIoEvent('download', data.id));
    });
  }

  delay = (ms: number) => new Promise(_ => setTimeout(_, ms));


}
