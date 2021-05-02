import {singleton} from "tsyringe";
import Libp2p from "libp2p";
import {ProtocolClient} from "./protocol.client";
import {CidDomain, PeerDomain} from "./model";
import {transform} from "streaming-iterables";
import pipe from "it-pipe";
import {FileResponse} from "../gateway/http/controller/dto/file.response";

@singleton()
export class ProtocolService {

  private node: Libp2p;
  private downloadsInProgress: Map<number, any>;

  constructor(node: Libp2p, private protocolClient: ProtocolClient) {
    this.node = node;
    this.downloadsInProgress = new Map();
  }

  public me(): PeerDomain {
    return {
      id: this.node.peerId,
      multiaddrs: this.node.multiaddrs,
      relayedConn: false,
      isLocal: true,
      reachable: true
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
  public async* findFiles(key: CidDomain): AsyncGenerator<FileResponse[]> {
    // TODO Prolly move it to file service or protocol client
    const files: AsyncIterableIterator<FileResponse[]> = pipe(
      this.protocolClient.findProviders(key),
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
