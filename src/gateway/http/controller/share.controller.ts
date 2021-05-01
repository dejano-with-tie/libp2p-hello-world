import express from "express";
import {singleton} from "tsyringe";
import {FileRepository} from "../../../repository/file.repository";
import {GetAllSharedResponse} from "./dto/get-all-shared.response";
import path from "path";

@singleton()
export class ShareController {

  constructor(
    private fileRepository: FileRepository,
  ) {
  }

  shared = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    const published = await this.fileRepository.find({relations: ['directory']})
    const shared: GetAllSharedResponse[] = published.map(f => {
      const filename = path.basename(f.path);
      const ext = path.extname(f.path);
      const pathWithoutSharedDir = path.relative(f.directory.path, f.path);
      return ({
        path: f.path,
        name: filename,
        ext: ext,
        mime: f.mime,
        size: f.size,
        checksum: f.checksum,
        advertisedPath: path.join(f.directory.advertisedPath, pathWithoutSharedDir)
      });
    })
    res.json(shared);
  }
}
