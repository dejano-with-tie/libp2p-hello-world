import EventEmitter from "events";
import {delay, inject, singleton} from "tsyringe";
import Download from "../db/model/download.model";
import {SseIoHandler} from "../gateway/io/handlers/sseIoHandler";
import {DownloadFile} from "../usecase/download-file";

@singleton()
export class AppEventEmitter extends EventEmitter {
  public static readonly DOWNLOAD_QUEUED = 'DOWNLOAD_QUEUED'
  public static readonly DOWNLOAD_COMPLETED = 'DOWNLOAD_COMPLETED'
  public static readonly DOWNLOAD_RESUMED = 'DOWNLOAD_RESUMED'
  public static readonly INTEGRITY_IS_VALID = 'INTEGRITY_IS_VALID'

  constructor(
    @inject(delay(() => SseIoHandler)) private sseHandler: SseIoHandler,
    @inject(delay(() => DownloadFile)) private downloadFile: DownloadFile,
  ) {
    super({});

    this.on(AppEventEmitter.DOWNLOAD_QUEUED, async (data: Download) => {
      await this.sseHandler.sse(AppEventEmitter.DOWNLOAD_QUEUED, data);
    });
    this.on(AppEventEmitter.DOWNLOAD_COMPLETED, async (data: Download) => {
      await this.sseHandler.sse(AppEventEmitter.DOWNLOAD_COMPLETED, data);
    });
    this.on(AppEventEmitter.DOWNLOAD_RESUMED, async (data: Download) => {
      await this.sseHandler.sse(AppEventEmitter.DOWNLOAD_RESUMED, data);
      await downloadFile.download(data.id);
    });
  }

}
