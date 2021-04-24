import {injectable} from "tsyringe";
import {FileRepository} from "../repository/file.repository";
import {HashRepository} from "../repository/hash.repository";
import Hash from "../models/hash.model";
import {CidDomain} from "../domain/cid.domain";
import File from "../models/file.model";

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
}
