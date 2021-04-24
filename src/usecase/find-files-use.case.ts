import {FindProviderRequest} from "../gateway/controller/dto/find-provider.request";
import {inject, singleton} from "tsyringe";
import {Config} from "../config";
import {CidDomain} from "../domain/cid.domain";
import logger from "../logger";
import {HashRepository} from "../repository/hash.repository";
import {Node} from "../node";
import {FileService} from "../service/file.service";
import {ProtocolService} from "../libp2p-client/protocol.service";
import {FileDomain} from "../domain/file.domain";

@singleton()
export class FindFilesUseCase {

  constructor(
    @inject("Config") private config: Config,
    @inject("Node") private node: Node,
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
  public async* execute(dto: FindProviderRequest): AsyncIterable<FileDomain[]> {
    const cid = await new CidDomain(dto.query).digest();

    logger.info(`--> searching for [${cid.toString()}]`);

    yield (await this.fileService.find(cid)).map(f => f.toDomain(this.protocolService.me()));
    for await (const files of this.protocolService.findFiles(cid)) {
      yield files;
    }

    logger.info(`<-- searching for [${cid.toString()}]`);
  }
}
