import {Socket} from "socket.io";
import {FindFilesUsecase} from "../../../usecase/find-files.usecase";
import {FindProviderRequest} from "../../http/controller/dto/find-provider.request";
import {inject, injectable} from "tsyringe";
import {FileResponse} from "../../http/controller/dto/file.response";
import {PeerDomain} from "../../../protocol/model";
import {emitOnEach} from "./index";
import {IoEvent} from "../model";

/**
 * Socket.io handler for all search events
 */
@injectable()
export class SearchIoHandler {
  constructor(
    @inject("Socket[]") private sockets: Socket[],
    private findFilesUseCase: FindFilesUsecase
  ) {
  }

  async handle(event: IoEvent<FindProviderRequest>): Promise<void> {
    const filesByProvider: AsyncIterable<FileResponse[] | PeerDomain> = await this.findFilesUseCase.execute(event.content);
    for await(const files of filesByProvider) {
      emitOnEach(this.sockets, event.id, files);
    }
    emitOnEach(this.sockets, event.id, [], true);
  }

}
