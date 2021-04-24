import {injectable} from "tsyringe";
import {CidDomain} from "../domain/cid.domain";
import Libp2p from "libp2p";
import {ProtocolClient} from "./protocol.client";
import {PeerDomain} from "../domain/libp2p.domain";
import {pipeline, transform} from "streaming-iterables";
import pipe from "it-pipe";
import {FileDomain} from "../domain/file.domain";

const filter = require('it-filter')

@injectable()
export class ProtocolService {

  private node: Libp2p;

  constructor(node: Libp2p, private protocolClient: ProtocolClient) {
    this.node = node;
  }

  public me(): PeerDomain {
    return {
      id: this.node.peerId,
      multiaddrs: this.node.multiaddrs,
      isLocal: true
    }
  }

  /**
   * Queries the network in parallel for given key (filename).
   *
   * First queries the network to find out which peers have the given key.
   * Secondly, queries each remote peer about key details.
   * Second operation is executed in parallel.
   *
   * @param key content-addressed identifier (filename)
   * @returns yields array of files from each provider (peer)
   */
  public async* findFiles(key: CidDomain): AsyncGenerator<FileDomain[]> {
    const files: AsyncIterableIterator<FileDomain[]> = pipe(
      this.findProviders(key),
      transform(1000, (peer: PeerDomain) => {
        return this.protocolClient.findFiles(key, peer)
      })
    )

    for await (const file of files) {
      yield file;
    }
  }

  public findProviders(cid: CidDomain): AsyncIterable<PeerDomain> {
    return this.protocolClient.findProviders(cid);
  }
}
