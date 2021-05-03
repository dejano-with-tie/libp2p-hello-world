import {DownloadRepository} from "../db/repository/download.repository";
import {delay, inject, singleton} from "tsyringe";
import Download, {DownloadStatus} from "../db/model/download.model";
import {error, ErrorCode} from "../gateway/exception/error.codes";
import {ProtocolClient} from "../protocol/protocol.client";
import {DownloadState, fromRemoteId} from "../protocol/model";
import {FileService} from "./file.service";
import {AppEventEmitter, AppEventId} from "./app-event.emitter";
import {
  DeleteDownloadRequest,
  DownloadAction,
  DownloadActionRequest
} from "../gateway/http/controller/dto/download-action.request";
import {FileResponse} from "../gateway/http/controller/dto/file.response";

@singleton()
export class DownloadService {

  // TODO: Download Component
  public activeDownloads = new Map<number, DownloadState>();

  constructor(
    private downloadRepository: DownloadRepository,
    private protocolClient: ProtocolClient,
    private fileService: FileService,
    @inject(delay(() => AppEventEmitter)) private appEventEmitter: AppEventEmitter
  ) {
  }

  public async getAll(): Promise<Download[]> {
    // TODO: If in progress, update offset by reading file size on file system
    return this.downloadRepository.find();
  }

  public async updateStatus(dl: Download, status: DownloadStatus): Promise<Download> {
    dl.status = status;
    return await this.downloadRepository.save(dl);
  }

  public async* download(id: number): AsyncIterable<DownloadState> {
    const toDl = await this.findOne(id);
    const file = await this.fileService.createWriteStream(toDl.downloadPath, toDl.status == DownloadStatus.PENDING ? 'w' : 'a');

    const state = {
      id: toDl.id,
      percentage: toDl.progress(),
      offset: toDl.offset,
      status: DownloadStatus[DownloadStatus.IN_PROGRESS]
    };
    await this.updateWithState(state, toDl);
    const progress = this.track(state, toDl.remoteFileSize);

    const stream = await this.protocolClient.getFileContent(fromRemoteId(toDl.remotePeerId), toDl.remoteFileId, state.offset);
    this.activeDownloads.set(id, state);
    try {
      for await (const chunk of stream) {
        if (this.activeDownloads.get(id)?.status == DownloadStatus.PAUSED) {
          state.status = DownloadStatus.PAUSED;
          return;
        }
        await file.write(chunk.content);
        yield* progress(chunk);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (state.offset == toDl.remoteFileSize) {
        state.status = DownloadStatus.COMPLETED_UNVERIFIED;
        this.activeDownloads.delete(state.id);
      }
      if (state.status !== DownloadStatus.PAUSED && state.offset != toDl.remoteFileSize) {
        state.status = DownloadStatus.FAILED;
      }

      await this.updateWithState(state, toDl);
      yield state;
      // TODO: Integrity check
    }

  }

  public async queue(download: Download, override: boolean): Promise<Download> {
    let file: FileResponse;
    try {
      file = await this.protocolClient.getFile(fromRemoteId(download.remotePeerId), download.remoteFileId);
    } catch (e) {
      throw error(ErrorCode.PEER_UNREACHABLE, e);
    }

    const existInDb = await this.downloadRepository.findOneByChecksumAndInProgress(file.checksum);
    if (existInDb && !override) {
      throw error(ErrorCode.DOWNLOAD_IN_PROGRESS);
    }

    if (existInDb) {
      await this.downloadRepository.delete(existInDb.id);
      await this.fileService.deleteFromFs(existInDb.downloadPath);
    }

    download.downloadPath = await this.fileService.uniquePath(file.path);
    download.remoteFileChecksum = file.checksum;
    download.remoteFileSize = file.size;
    return await this.downloadRepository.save(download);
  }

  public async findOne(downloadFileId: number): Promise<Download> {
    const download = await this.downloadRepository.findOne(downloadFileId)
    if (!download) {
      throw error(ErrorCode.RESOURCE_NOT_FOUND, downloadFileId);
    }

    return download;
  }

  public async action(request: DownloadActionRequest) {
    // TODO: Same shit as handler (map stuff)
    if (request.action == DownloadAction.RESUME) {
      return this.resume(request.id);
    }

    if (request.action == DownloadAction.PAUSE) {
      return this.pause(request.id);
    }

    throw error(ErrorCode.ILLEGAL_STATE);
  }

  public async pause(id: number): Promise<DownloadState> {
    // const dl = await this.findOne(id);
    //
    // if (dl.status != DownloadStatus.IN_PROGRESS) {
    //   throw error(ErrorCode.ILLEGAL_STATE);
    // }

    const state = this.activeDownloads.get(id);
    if (!state) {
      throw error(ErrorCode.ILLEGAL_STATE);
    }

    if (state.status != DownloadStatus.IN_PROGRESS) {
      throw error(ErrorCode.ILLEGAL_STATE);
    }

    state.status = DownloadStatus.PAUSED;
    // await this.updateWithState(state, dl);
    return state;
  }

  public async resume(id: number): Promise<DownloadState> {
    const dl = await this.findOne(id);

    if (dl.status != DownloadStatus.PAUSED) {
      throw error(ErrorCode.ILLEGAL_STATE);
    }

    const state = {
      id: dl.id,
      status: DownloadStatus.IN_PROGRESS,
      offset: dl.offset,
      percentage: dl.progress()
    };
    this.activeDownloads.set(id, state);

    await this.updateWithState(state, dl);
    this.appEventEmitter.emit(AppEventId.DOWNLOAD_RESUMED, dl, `Resume download for ${dl.downloadPath}`);
    return state;
  }

  async delete(request: DeleteDownloadRequest) {
    const dl = await this.findOne(request.id);
    await this.downloadRepository.remove(dl);
    if (request.fromFs) {
      await this.fileService.deleteFromFs(dl.downloadPath);
    }
  }

  private track(progress: DownloadState, totalSize: number) {
    let prevPercentage = 0;
    return async function* (chunk: any): AsyncIterable<DownloadState> {
      progress.offset += chunk.content.length;
      progress.percentage = Math.floor((progress.offset / totalSize) * 100);
      if (prevPercentage !== progress.percentage) {
        yield progress;
        prevPercentage = progress.percentage;
      }
    }
  }

  private async updateWithState(progress: DownloadState, dl: Download) {
    dl.offset = progress.offset;
    dl.status = progress.status;
    await this.downloadRepository.save(dl);
  }
}
