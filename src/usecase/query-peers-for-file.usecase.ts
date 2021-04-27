import {ProtocolService} from "../libp2p-client/protocol.service";
import {FindProviderRequest} from "../gateway/http/controller/dto/find-provider.request";
import {CidDomain} from "../domain/cid.domain";
import {PeerDomain} from "../domain/libp2p.domain";
import {singleton} from "tsyringe";

@singleton()
export class QueryPeersForFileUsecase {
  constructor(
    private protocolService: ProtocolService
  ) {
  }

  public async* execute(dto: FindProviderRequest): AsyncIterable<PeerDomain> {
    const cid = await new CidDomain(dto.query).digest();
    return this.protocolService.findProviders(cid)
  }

}
