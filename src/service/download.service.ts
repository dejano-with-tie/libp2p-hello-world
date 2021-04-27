import {DownloadRepository} from "../repository/download.repository";
import {inject, singleton} from "tsyringe";
import Download, {DownloadStatus} from "../models/download.model";
import {error, ErrorCode} from "../gateway/exception/error.codes";
import {ProtocolService} from "../libp2p-client/protocol.service";
import {ProtocolClient} from "../libp2p-client/protocol.client";
import {remotePeer} from "../domain/libp2p.domain";
import {FileService} from "./file.service";
import {Config} from "../config";

@singleton()
export class DownloadService {

  constructor(
    private downloadRepository: DownloadRepository,
    private protocolService: ProtocolService,
    private protocolClient: ProtocolClient,
    private fileService: FileService,
    @inject("Config") private config: Config,
  ) {
  }

  public async getAll(): Promise<Download[]> {
    return this.downloadRepository.find();
  }

  public async updateStatus(id: number, status: DownloadStatus): Promise<Download> {
    const dl = await this.findOne(id);
    if (DownloadStatus.INTEGRITY_VALID == status) {
      dl.integrityIsValid();
    }

    return await this.downloadRepository.save(dl);
  }

  public async queue(download: Download, override: boolean): Promise<Download> {
    const file = await this.protocolClient.getFile(remotePeer(download.remotePeerId), download.remoteFileId);
    const existInDb = await this.downloadRepository.findOneByChecksumAndInProgress(file.checksum);
    if (existInDb && !override) {
      throw error(ErrorCode.DOWNLOAD_IN_PROGRESS);
    }

    // TODO: Check if it exist in file system

    if (existInDb) {
      await this.downloadRepository.delete(existInDb.id);
      await this.fileService.deleteFromFs(existInDb.downloadPath);
    }

    download.downloadPath = await this.fileService.uniquePath(file.path, this.config.file.downloadDirPath);
    return await this.downloadRepository.save(download);
  }

  async findOne(downloadFileId: number): Promise<Download> {
    const file = await this.downloadRepository.findOne(downloadFileId)
    if (!file) {
      throw error(ErrorCode.RESOURCE_NOT_FOUND, downloadFileId);
    }

    return file;
  }
}
