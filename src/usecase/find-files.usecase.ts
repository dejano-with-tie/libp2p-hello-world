import {FindProviderRequest} from "../gateway/http/controller/dto/find-provider.request";
import {inject, singleton} from "tsyringe";
import {Config} from "../config";
import logger from "../logger";
import {HashRepository} from "../repository/hash.repository";
import {FileService} from "../service/file.service";
import {ProtocolService} from "../libp2p-client/protocol.service";
import {CidDomain} from "../libp2p-client/model";
import {FileResponse} from "../gateway/http/controller/dto/file.response";

@singleton()
export class FindFilesUsecase {

  constructor(
    @inject("Config") private config: Config,
    private hashRepository: HashRepository,
    private fileService: FileService,
    private protocolService: ProtocolService,
  ) {
  }

  /**
   * Queries DHT for given query (filename).
   * @param dto
   * @returns yields array of files from each provider (peer)
   */
  public async* execute(dto: FindProviderRequest): AsyncIterable<FileResponse[]> {
    const cid = await new CidDomain(dto.query).digest();

    logger.info(`--> searching for [${cid.toString()}]`);

    yield (await this.fileService.find(cid)).map(f => FileResponse.fromModel(f, this.protocolService.me()));
    for await (const files of this.protocolService.findFiles(cid)) {
      yield files;
    }

    logger.info(`<-- searching for [${cid.toString()}]`);
  }
}
