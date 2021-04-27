import {injectable} from "tsyringe";
import {FileRepository} from "../repository/file.repository";
import {HashRepository} from "../repository/hash.repository";
import Hash from "../models/hash.model";
import {CidDomain} from "../domain/cid.domain";
import File from "../models/file.model";
import * as fs from "fs";
import * as fspath from "path";
import logger from "../logger";

const fsu = require('fsu');


@injectable()
export class FileService {

  constructor(private fileRepository: FileRepository, private hashRepository: HashRepository) {
  }

  async getByCid(cid: CidDomain): Promise<Hash | undefined> {
    return this.hashRepository.findOneByCid(cid.toString())
  }

  async find(cid: CidDomain): Promise<File[]> {

    const local = await this.hashRepository.findOneByCid(cid.toString());
    if (!local) {
      return [];
    }

    return local.files;
  }

  async deleteFromFs(path: string) {
    try {
      await fs.promises.unlink(path);
    } catch (e) {
      // ignore
      logger.error(e);
    }
  }

  async uniquePath(path: string, downloadPath: string): Promise<string> {
    const ext = fspath.extname(path);
    const filename = fspath.basename(path, ext);
    const pathWithName = fspath.join(downloadPath, filename);
    const {unique} = await fsu.openUnique(`${pathWithName} (#).${ext}`);
    return unique;
  }
}
