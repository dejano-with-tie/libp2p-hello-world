import {Message} from "../../proto/proto";
import {FindFileHandler} from "./find-file.handler";
import {error, ErrorCode} from "../../../gateway/exception/error.codes";
import {singleton} from "tsyringe";
import {GetFileHandler} from "./get-file.handler";
import {GetFileContentHandler} from "./get-file-content.handler";

@singleton()
export class MessageHandler {
  private handlers = new Map<any, any>();

  constructor(
    private findFileHandler: FindFileHandler,
    private getFileHandler: GetFileHandler,
    private getFileContentHandler: GetFileContentHandler
  ) {
    this.handlers.set(Message.TYPES.FIND_FILE, findFileHandler);
    this.handlers.set(Message.TYPES.GET_FILE, getFileHandler);
    this.handlers.set(Message.TYPES.GET_FILE_CONTENT, getFileContentHandler);
  }

  public getHandler(type: any) {
    if (!this.handlers.has(type)) {
      throw error(ErrorCode.PROTOCOL__UNKNOWN_MESSAGE_HANDLER, type);
    }

    return this.handlers.get(type);
  }
}
