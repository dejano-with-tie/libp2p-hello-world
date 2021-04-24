import fs from "fs";
import Libp2p from "libp2p";
import pipe from "it-pipe";
import lp from "it-length-prefixed";
import {FileInfoResponse} from "./protocol";
import first from 'it-first';
import {FileDomain} from "../domain/file.domain";
import {CidDomain} from "../domain/cid.domain";
import {PeerDomain} from "../domain/libp2p.domain";
import logger from "../logger";

const filter = require('it-filter')

const protobuf = require('protocol-buffers')
// pass a proto file as a buffer/string or pass a parsed protobuf-schema object
const {Request, Response, DownloadResponse} = protobuf(fs.readFileSync('./messages.proto'))

export class ProtocolClient {

  private node: Libp2p;

  constructor(node: Libp2p) {
    this.node = node;
  }

  /**
   * Find providers of given key
   * @param key
   */
  public async* findProviders(key: CidDomain): AsyncIterable<PeerDomain> {
    logger.info(`Searching for providers of '${key.name}'`);
    try {
      yield* pipe(
        this.node.contentRouting.findProviders(key.value, {timeout: 10000}),
        (source: any) => filter(source, this.onlyRemote())
      );
    } catch (e) {
      logger.warn(`No one is providing '${key.name}'`)
      yield* [];
    }
  }

  /**
   * Dials remote peer to find out details about given key
   *
   * @async
   * @param key file
   * @param provider remote peer
   * @returns FileDomain[] details
   */
  public async findFiles(key: CidDomain, provider: PeerDomain): Promise<FileDomain[]> {
    logger.info(`Searching for file '${key.name}' on provider '${provider.id.toB58String()}'`);
    // await new Promise(resolve => setTimeout(resolve, this.randomIntFromInterval(1_000, 20_000)));
    const {stream} = await this.node.dialProtocol(provider.id, '/libp2p/file/1.0.0');
    const request = Request.encode({
      type: Request.Type.INFO,
      info: {name: key.name}
    });
    const files: FileInfoResponse = await this.write(request, stream);
    return files.info.map(file => {
      return new FileDomain(file.id, file.path, file.checksum, file.size, file.mime, file.createdAt, file.updatedAt, {
        id: provider.id,
        multiaddrs: provider.multiaddrs,
        isLocal: false,
      });
    });
  }

  private onlyRemote() {
    return (peer: any) => {
      return !peer.id.equals(this.node.peerId);
    };
  }

  private async write(request: any, stream: any) {
    return await pipe(
      // Source data
      [request],
      // Write to the stream, and pass its output to the next function
      stream,
      lp.decode(),
      // Sink function
      async (source: any) => {
        const buf: any = await first(source)
        // TODO: What if empty?
        if (buf) {
          return Response.decode(buf.slice());
        }
      }
    );
  }

  private randomIntFromInterval(min: number, max: number) {
    const interval = Math.floor(Math.random() * (max - min + 1) + min);
    logger.info(`waiting: ${interval}`);
    return interval;
  }
}
