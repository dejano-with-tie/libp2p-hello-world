import {Socket} from "socket.io";
import {IoHandler} from "./io-handler";
import {FindFilesUsecase} from "../../usecase/find-files.usecase";
import {FindProviderRequest} from "../http/controller/dto/find-provider.request";
import {FileDomain} from "../../domain/file.domain";
import {IoEvent, wrapIoEvent} from "./index";
import {error, ErrorCode} from "../exception/error.codes";
import {delay, inject, injectable, singleton} from "tsyringe";

/**
 * Socket.io handler for all events starting with 'search*'
 */
@injectable()
export class SearchIoHandler extends IoHandler {
  constructor(
    @inject(delay(() => Socket))socket: Socket,
    private findFilesUseCase: FindFilesUsecase
  ) {
    super(socket);
  }

  async search(event: IoEvent<FindProviderRequest>): Promise<void> {
    const filesByProvider: AsyncIterable<FileDomain[]> = await this.findFilesUseCase.execute(event.content);
    for await(const files of filesByProvider) {
      this.socket.emit(event.id, wrapIoEvent(event.id, files));
    }
    this.socket.emit(event.id, {...event, ...{done: true}});
  }

  async providers(_: IoEvent<FindProviderRequest>): Promise<void> {
    throw error(ErrorCode.NOT_IMPLEMENTED);
  }

  async files(_: IoEvent<any>): Promise<void> {
    throw error(ErrorCode.NOT_IMPLEMENTED);
  }

}
