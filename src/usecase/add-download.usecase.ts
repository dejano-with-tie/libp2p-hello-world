import {delay, inject, singleton} from "tsyringe";
import {Config} from "../config";
import {DownloadRepository} from "../repository/download.repository";
import {DownloadService} from "../service/download.service";
import {DownloadRequest} from "../gateway/http/controller/dto/download.request";
import {AppEventEmitter} from "../service/app-event.emitter";
import {DownloadDomain} from "../domain/download.domain";
import Download from "../models/download.model";

@singleton()
export class AddDownloadUsecase {

  constructor(
    @inject("Config") private config: Config,
    private downloadService: DownloadService,
    @inject(delay(() => AppEventEmitter)) private appEventEmitter: AppEventEmitter
  ) {
  }

  public async execute(download: Download, override: boolean) {
    await this.downloadService.queue(download, override);
    // this.appEventEmitter.emit(AppEventEmitter.DOWNLOAD_QUEUED, download);
  }
}
