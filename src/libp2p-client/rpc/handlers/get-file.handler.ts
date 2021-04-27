import logger from "../../../logger";
import fs from "fs";
import PeerId from "peer-id";
import {File, Message} from "../../proto/proto";
import {error, ErrorCode} from "../../../gateway/exception/error.codes";
import {singleton} from "tsyringe";
import {FileRepository} from "../../../repository/file.repository";

@singleton()
export class GetFileHandler {

  constructor(private fileRepository: FileRepository) {
  }

  public async handle(peer: PeerId, message: Message): Promise<Message> {
    // TODO: Duplicate in find-file.handler.ts, move to file service
    if (!message.fileId) {
      throw error(ErrorCode.PROTOCOL__RECEIVED_INVALID_MESSAGE, message);
    }

    const file = await this.fileRepository.findOne(message.fileId);
    if (!file || !file.pathIsValid) {
      throw error(ErrorCode.RESOURCE_NOT_FOUND, {fileId: message.fileId});
    }

    const isValid = fs.existsSync(file.path);
    if (!isValid) {
      logger.info(`Invalid file: ${file.path}`);
      // TODO: Update db
    }

    const response = new Message(Message.TYPES.GET_FILE);
    response.files = [new File(
      file.id,
      file.path,
      file.mime,
      file.checksum,
      file.size,
      file.createdAt.toString(),
      file.updatedAt.toString(),
    )];

    return response;
  }
}
