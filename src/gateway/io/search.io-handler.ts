import {Socket} from "socket.io";
import {IoEvent, IoHandler} from "./io-handler";
import {FindFilesUsecase} from "../../usecase/find-files.usecase";
import {FindProviderRequest} from "../http/controller/dto/find-provider.request";
import {error, ErrorCode} from "../exception/error.codes";
import {inject, injectable} from "tsyringe";
import {FileResponse} from "../http/controller/dto/file.response";
import {CidDomain, PeerDomain} from "../../protocol/model";
import {ProtocolService} from "../../protocol/protocol.service";

/**
 * Socket.io handler for all events starting with 'search*'
 */
@injectable()
export class SearchIoHandler extends IoHandler {
  constructor(
    @inject("Socket[]") sockets: Socket[],
    private findFilesUseCase: FindFilesUsecase,
    private protocolService: ProtocolService
  ) {
    super(sockets);
  }

  async details(event: IoEvent<FindProviderRequest>): Promise<void> {
    const filesByProvider: AsyncIterable<FileResponse[] | PeerDomain> = await this.findFilesUseCase.execute(event.content);
    for await(const files of filesByProvider) {
      this.emit(event.id, files);
    }
    this.emit(event.id, [], true);
  }

  async providers(event: IoEvent<FindProviderRequest>): Promise<void> {
    const cid = await new CidDomain(event.content.query).digest();
    for await(const provider of this.protocolService.findProviders(cid)) {
      this.emit(event.id, provider);
    }
    this.emit(event.id, [], true);
  }

  async files(_: IoEvent<any>): Promise<void> {
    throw error(ErrorCode.NOT_IMPLEMENTED);
  }

}
