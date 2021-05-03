import EventEmitter from "events";
import {delay, inject, singleton} from "tsyringe";
import Download from "../db/model/download.model";
import {SseIoHandler} from "../gateway/io/handlers/sseIoHandler";
import {DownloadFile} from "../usecase/download-file";
import {delayW} from "../utils";

export enum AppEventId {
  MONITOR = 'monitor',
  CONTEXT = 'context',
  DOWNLOAD_QUEUED = 'download:status:queued',
  DOWNLOAD_COMPLETED = 'download:status:completed',
  DOWNLOAD_RESUMED = 'download:status:resumed',
}

@singleton()
export class AppEventEmitter extends EventEmitter {

  private context = {};

  constructor(
    @inject(delay(() => SseIoHandler)) private sseHandler: SseIoHandler,
    @inject(delay(() => DownloadFile)) private downloadFile: DownloadFile,
  ) {
    super({});
    this.on(AppEventId.DOWNLOAD_RESUMED, async (data: Download) => {
      await this.sseHandler.sse(AppEventId.DOWNLOAD_RESUMED, data);
      await downloadFile.download(data.id);
    });
  }

  // @ts-ignore
  async emit(event: string | symbol, ...args): boolean {
    if (event == AppEventId.MONITOR) {
      this.sseHandler.sse(event, args);
    }

    if (event == AppEventId.CONTEXT) {
      this.context = {...this.context, ...args[0]};
      await this.emitContext();
    }
    return super.emit(event, ...args);
  }

  public async emitContext() {
    await delayW(() => this.sseHandler.sse(AppEventId.CONTEXT, this.context))
  }
}
