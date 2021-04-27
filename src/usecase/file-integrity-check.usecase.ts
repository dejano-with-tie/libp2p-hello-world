import {delay, inject, singleton} from "tsyringe";
import {AppEventEmitter} from "../service/app-event.emitter";
import {DownloadService} from "../service/download.service";
import {DownloadStatus} from "../models/download.model";

@singleton()
export class FileIntegrityCheckUsecase {

  constructor(
    private downloadService: DownloadService,
    @inject(delay(() => AppEventEmitter)) private appEventEmitter: AppEventEmitter,
  ) {
  }

  public async execute(downloadId: number) {
    // TODO: Validate by calling remote peer
    const download = await this.downloadService.updateStatus(downloadId, DownloadStatus.INTEGRITY_VALID);
    this.appEventEmitter.emit(AppEventEmitter.INTEGRITY_IS_VALID, download);
  }
}
