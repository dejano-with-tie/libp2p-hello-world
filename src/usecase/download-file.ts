import {delay, inject, singleton} from "tsyringe";
import {Config} from "../config";
import {DownloadService} from "../service/download.service";
import {AppEventEmitter, AppEventId} from "../service/app-event.emitter";
import Download from "../db/model/download.model";
import {IoEventId} from "../gateway/io/model";
import logger from "../logger";
import {SseIoHandler} from "../gateway/io/handlers/sseIoHandler";

@singleton()
export class DownloadFile {

  constructor(
    @inject("Config") private config: Config,
    @inject(delay(() => DownloadService)) private downloadService: DownloadService,
    private sse: SseIoHandler,
    @inject(delay(() => AppEventEmitter)) private appEventEmitter: AppEventEmitter
  ) {
  }

  public async queue(download: Download, override: boolean) {
    const dl = await this.downloadService.queue(download, override);
    this.appEventEmitter.emit(AppEventId.DOWNLOAD_QUEUED, download, `file ${download.downloadPath} queued`);
    // non blocking
    this.download(dl.id).catch((e) => {
      logger.error(e);
    });
  }

  public async download(id: number) {
    const progress = await this.downloadService.download(id);
    for await(const chunk of progress) {
      await this.sse.sse(IoEventId.DOWNLOAD, chunk);
    }
    await this.sse.sseEnd(IoEventId.DOWNLOAD, []);
  }
}
