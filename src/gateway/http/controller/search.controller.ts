import express from "express";
import {singleton} from "tsyringe";
import {FindFilesUsecase} from "../../../usecase/find-files.usecase";
import {FindProviderRequest} from "./dto/find-provider.request";
import {collect} from "streaming-iterables";
import {ErrorCode, error} from "../../exception/error.codes";
import {FileResponse} from "./dto/file.response";

@singleton()
export class SearchController {

  private findFilesUseCase: FindFilesUsecase;

  constructor(findFilesUseCase: FindFilesUsecase) {
    this.findFilesUseCase = findFilesUseCase;
  }

  search = async (req: express.Request, res: express.Response, next: any) => {
    const dto: FindProviderRequest = {query: req.params['query']};
    if (!dto || !dto.query) {
      throw error(ErrorCode.BAD_REQUEST);
    }
    const filesByProvider: AsyncIterable<FileResponse[]> = await this.findFilesUseCase.execute(dto);
    const response = await collect(filesByProvider);
    console.log(response);
    res.json(response);
  }
}
