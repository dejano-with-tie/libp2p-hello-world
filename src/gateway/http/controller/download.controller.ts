import express from "express";
import {singleton} from "tsyringe";
import {DownloadRequest, toEntity} from "./dto/download.request";
import {DownloadRepository} from "../../../repository/download.repository";
import {AddDownloadUsecase} from "../../../usecase/add-download.usecase";

@singleton()
export class DownloadController {

  constructor(
    private queueFileForDownloadUsecase: AddDownloadUsecase,
    private downloadRepository: DownloadRepository
  ) {
  }

  queue = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const payload = req.body as DownloadRequest;
    await this.queueFileForDownloadUsecase.execute(toEntity(payload), payload.override);
    res.json({});
  }

  getAll = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const response = (await this.downloadRepository.find()).map(download => ({
      path: download.downloadPath,
      // TODO: Progress
      progress: 0,
      size: download.remoteFileSize,
      status: download.status
    }));

    res.json(response);
  }
}
