import logger from "../../../logger";
import fs from "fs";
import PeerId from "peer-id";
import {Message} from "../../proto/proto";
import {error, ErrorCode} from "../../../gateway/exception/error.codes";
import {singleton} from "tsyringe";
import {FileRepository} from "../../../repository/file.repository";

@singleton()
export class GetFileContentHandler {

  constructor(private fileRepository: FileRepository) {
  }

  public async* handle(peer: PeerId, message: Message) {
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

    const response = new Message(Message.TYPES.GET_FILE_CONTENT);
    // for resume, use options = {start: offset}
    const readStream = fs.createReadStream(file.path, {});
    for await (const chunk of readStream) {
      response.content = chunk;
      yield response;
    }
  }
}
