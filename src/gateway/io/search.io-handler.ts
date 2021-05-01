import {Socket} from "socket.io";
import {IoEvent, IoHandler, wrapIoEvent} from "./io-handler";
import {FindFilesUsecase} from "../../usecase/find-files.usecase";
import {FindProviderRequest} from "../http/controller/dto/find-provider.request";
import {error, ErrorCode} from "../exception/error.codes";
import {delay, inject, injectable} from "tsyringe";
import {FileResponse} from "../http/controller/dto/file.response";

/**
 * Socket.io handler for all events starting with 'search*'
 */
@injectable()
export class SearchIoHandler extends IoHandler {
  constructor(
    @inject("Socket[]") sockets: Socket[],
    private findFilesUseCase: FindFilesUsecase
  ) {
    super(sockets);
  }

  async search(event: IoEvent<FindProviderRequest>): Promise<void> {
    const filesByProvider: AsyncIterable<FileResponse[]> = await this.findFilesUseCase.execute(event.content);
    for await(const files of filesByProvider) {
      this.emit(event.id, files);
    }
    this.emit(event.id, [], true);
  }

  async providers(_: IoEvent<FindProviderRequest>): Promise<void> {
    throw error(ErrorCode.NOT_IMPLEMENTED);
  }

  async files(_: IoEvent<any>): Promise<void> {
    throw error(ErrorCode.NOT_IMPLEMENTED);
  }

}
