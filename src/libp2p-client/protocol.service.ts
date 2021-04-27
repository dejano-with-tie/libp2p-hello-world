import {injectable, singleton} from "tsyringe";
import {CidDomain} from "../domain/cid.domain";
import Libp2p from "libp2p";
import {ProtocolClient} from "./protocol.client";
import {PeerDomain, remotePeer} from "../domain/libp2p.domain";
import {transform} from "streaming-iterables";
import pipe from "it-pipe";
import {FileDomain} from "../domain/file.domain";
import Download from "../models/download.model";
import fs from "fs";
import {DownloadProgress} from "../domain/download.domain";
import PeerId from "peer-id";

const pair = require('it-pair')

const filter = require('it-filter')

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

  public async fileInfo(peer: PeerDomain, fileId: number) {
    return this.protocolClient.getFile(peer, fileId);
  }

  public findProviders(cid: CidDomain): AsyncIterable<PeerDomain> {
    return this.protocolClient.findProviders(cid);
  }

  public async* download(download: Download): AsyncIterable<DownloadProgress> {
    // TODO: Line below recreates file (appends to file?)
    const out = fs.createWriteStream(download.downloadPath, {flags: 'a'});
    this.downloadsInProgress.set(1, {status: 'inprogress'});
    const peer = remotePeer(download.remotePeerId);
    const stream = await this.protocolClient.getFileContent(peer, download.remoteFileId, download.id);
    const track = this.progress(download.remoteFileSize, download.id);

    for await (const chunk of stream) {
      await out.write(chunk.content);
      yield* track(chunk);
    }
    return 'done';
    // this.downloadEvent.on('pause', (b: any) => {
    //   console.log('got pause');
    // });
  }

  private progress(totalSize: number, id: number) {
    let size = 0;
    let prevProgress = 0;
    let client = this.protocolClient;
    return async function* (chunk: any): AsyncIterable<DownloadProgress> {
      size += chunk.content.length;
      const progress = Math.floor((size / totalSize) * 100);
      if (prevProgress !== progress) {
        yield {
          size,
          progress
        };
        if (progress > 3) {
          client.downloadsInProgress.delete(id);
        }
        prevProgress = progress;
      }
    }
  }
}
