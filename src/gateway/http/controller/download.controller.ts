import express from "express";
import {singleton} from "tsyringe";
import {DownloadRequest, toEntity} from "./dto/download.request";
import {DownloadRepository} from "../../../db/repository/download.repository";
import {DownloadStatus} from "../../../db/model/download.model";
import {DeleteDownloadRequest, DownloadActionRequest} from "./dto/download-action.request";
import {DownloadService} from "../../../service/download.service";
import {error, ErrorCode} from "../../exception/error.codes";
import {DownloadFile} from "../../../usecase/download-file";

@singleton()
export class DownloadController {

  constructor(
    private downloadFile: DownloadFile,
    private downloadRepository: DownloadRepository,
    private downloadService: DownloadService,
  ) {
  }

  queue = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const payload = req.body as DownloadRequest;
    await this.downloadFile.queue(toEntity(payload), payload.override);
    res.json({});
  }

  getAll = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const response = (await this.downloadRepository.find()).map(download => ({
      id: download.id,
      path: download.downloadPath,
      progress: download.progress(),
      size: download.remoteFileSize,
      status: DownloadStatus[download.status]
    }));

    res.json(response);
  }

  changeState = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const payload = req.body as DownloadActionRequest;
    const request: DownloadActionRequest = {id: Number.parseInt(req.params['id']), action: payload.action};

    if (!request.id || !request.action) {
      throw error(ErrorCode.BAD_REQUEST);
    }

    const state = await this.downloadService.action(request);
    res.json(state);
  }

  delete = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const payload = req.body as DeleteDownloadRequest;
    const request: DeleteDownloadRequest = {id: Number.parseInt(req.params['id']), fromFs: payload.fromFs};

    if (!request.id || request.fromFs == undefined) {
      throw error(ErrorCode.BAD_REQUEST);
    }

    await this.downloadService.delete(request);
    res.json({});
  }

}
