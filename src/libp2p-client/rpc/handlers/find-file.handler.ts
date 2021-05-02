import logger from "../../../logger";
import fs from "fs";
import PeerId from "peer-id";
import * as proto from "../../proto/proto";
import {error, ErrorCode} from "../../../gateway/exception/error.codes";
import {HashRepository} from "../../../repository/hash.repository";
import {singleton} from "tsyringe";
import {CidDomain} from "../../model";
import Hash from "../../../models/hash.model";
import File from "../../../models/file.model";

@singleton()
export class FindFileHandler {

  constructor(private hashRepository: HashRepository) {
  }

  public async handle(peer: PeerId, message: proto.Message): Promise<proto.Message> {
    if (!message.query) {
      throw error(ErrorCode.PROTOCOL__RECEIVED_INVALID_MESSAGE, message);
    }

    const cid = await new CidDomain(message.query).digest();

    const hashes: Hash | undefined = await this.hashRepository.findOneByCid(cid.toString());
    if (!hashes?.files?.length) {
      throw error(ErrorCode.RESOURCE_NOT_FOUND, cid);
    }

    const validFiles: File[] = hashes.files.filter(file => fs.existsSync(file.path));
    hashes.files.filter(file => !validFiles.includes(file)).forEach(file => {
      logger.info(`Invalid file: ${file.path}`);
      // TODO: Update db
    });

    const response = new proto.Message(proto.Message.TYPES.FIND_FILE);
    response.files = validFiles.map(file => new proto.File(
      file.id,
      file.advertisedPath(),
      file.mime,
      file.checksum,
      file.size,
      file.createdAt.toString(),
      file.updatedAt.toString(),
      )
    );

    return response;
  }
}
