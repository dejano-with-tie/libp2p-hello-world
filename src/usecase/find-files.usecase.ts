import {FindProviderRequest} from "../gateway/http/controller/dto/find-provider.request";
import {inject, singleton} from "tsyringe";
import {Config} from "../config";
import logger from "../logger";
import {HashRepository} from "../db/repository/hash.repository";
import {FileService} from "../service/file.service";
import {CidDomain, PeerDomain} from "../protocol/model";
import {FileResponse} from "../gateway/http/controller/dto/file.response";
import {Node} from "../node";
import {ProtocolClient} from "../protocol/protocol.client";

@singleton()
export class FindFilesUsecase {

  constructor(
    @inject("Config") private config: Config,
    private hashRepository: HashRepository,
    private fileService: FileService,
    private protocolClient: ProtocolClient,
    private node: Node,
  ) {
  }

  /**
   * Queries DHT for given query (filename).
   * @param dto
   * @returns yields array of files from each provider (peer)
   */
  public async* execute(dto: FindProviderRequest): AsyncIterable<FileResponse[] | PeerDomain> {
    const cid = await new CidDomain(dto.query).digest();

    logger.info(`--> searching for [${cid.toString()}]`);

    yield (await this.fileService.find(cid)).map(f => FileResponse.fromModel(f, this.node.me()));
    for await (const files of this.protocolClient.findFiles(cid)) {
      yield files;
    }

    logger.info(`<-- searching for [${cid.toString()}]`);
  }
}
