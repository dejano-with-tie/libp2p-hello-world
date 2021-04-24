import {Socket} from "socket.io";
import {IoHandler} from "./io-handler";
import {FindFilesUseCase} from "../../usecase/find-files-use.case";
import {FindProviderRequest} from "../controller/dto/find-provider.request";
import {FileDomain} from "../../domain/file.domain";
import {IoEvent, wrapIoEvent} from "./index";
import {ErrorCode, throwError} from "../exception/error.codes";

/**
 * Socket.io handler for all events starting with 'search*'
 */
export class SearchIoHandler extends IoHandler {
  constructor(socket: Socket, private findFiles: FindFilesUseCase) {
    super(socket);
  }

  async search(event: IoEvent<FindProviderRequest>): Promise<void> {
    const filesByProvider: AsyncIterable<FileDomain[]> = await this.findFiles.execute(event.content);
    for await(const files of filesByProvider) {
      this.socket.emit(event.id, wrapIoEvent(event.id, files));
    }
    this.socket.emit(event.id, {...event, ...{done: true}});
  }

  async providers(_: IoEvent<FindProviderRequest>): Promise<void> {
    throwError(ErrorCode.NOT_IMPLEMENTED);
  }

  async files(_: IoEvent<any>): Promise<void> {
    throwError(ErrorCode.NOT_IMPLEMENTED);
  }

}
