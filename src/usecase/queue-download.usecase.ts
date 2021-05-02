import {delay, inject, singleton} from "tsyringe";
import {Config} from "../config";
import {DownloadService} from "../service/download.service";
import {AppEventEmitter} from "../service/app-event.emitter";
import Download from "../db/model/download.model";

@singleton()
export class QueueDownloadUsecase {

  constructor(
    @inject("Config") private config: Config,
    private downloadService: DownloadService,
    @inject(delay(() => AppEventEmitter)) private appEventEmitter: AppEventEmitter
  ) {
  }

  public async execute(download: Download, override: boolean) {
    await this.downloadService.queue(download, override);
    this.appEventEmitter.emit(AppEventEmitter.DOWNLOAD_QUEUED, download);
  }
}
