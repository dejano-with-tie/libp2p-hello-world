import fs from "fs";
import Libp2p from "libp2p";
import pipe from "it-pipe";
import * as lengthPrefixed from "it-length-prefixed";
import {FileDomain} from "../domain/file.domain";
import {CidDomain} from "../domain/cid.domain";
import {PeerDomain} from "../domain/libp2p.domain";
import logger from "../logger";
import {ErrorCode} from "../gateway/exception/error.codes";
import PeerId from "peer-id";
import {singleton} from "tsyringe";
import {Message} from "./proto/proto";
import {Rpc} from "./rpc";
import {oneOnly} from "../utils";
import map from "it-map";

const filter = require('it-filter')

const protobuf = require('protocol-buffers')
// pass a proto file as a buffer/string or pass a parsed protobuf-schema object
const {Request, Response, DownloadResponse} = protobuf(fs.readFileSync('./messages.proto'))

@singleton()
export class ProtocolClient {

  public downloadsInProgress = new Map<number, any>();
  private readonly _protocol = '/libp2p/enutt/1.0.0';

  constructor(private node: Libp2p, private rpc: Rpc) {
    this.node = node;
    this.handleIncoming = this.handleIncoming.bind(this);
    this.node.handle(this._protocol, this.handleIncoming);
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
   * Dials remote peer to find files for given key
   *
   * @async
   * @param key (file name)
   * @param peer
   * @returns FileDomain[] files
   */
  public async findFiles(key: CidDomain, peer: PeerDomain): Promise<FileDomain[]> {
    logger.info(`Searching for file '${key.name}' on provider '${peer.id.toB58String()}'`);
    // await new Promise(resolve => setTimeout(resolve, this.randomIntFromInterval(1_000, 20_000)));

    const message = Message.findFiles(key.name);
    return (await this.sendMessage(peer.id, message)).files.map(file => {
      return file.toDomain(peer);
    });
  }

  /**
   * Dials remote peer to fetch file details
   * @param peer
   * @param fileId
   * @returns FileDomain file
   */
  public async getFile(peer: PeerDomain, fileId: number): Promise<FileDomain> {
    logger.info(`Searching for file '${fileId}' on provider '${peer.id.toB58String()}'`);
    const message = Message.getFile(fileId);
    const [first] = (await this.sendMessage(peer.id, message)).files.map(file => {
      return file.toDomain(peer);
    });

    return first;
  }

  /**
   * Dials remote peer to get raw bytes of given file id
   * @param peer
   * @param fileId
   * @param processId
   * @return Message containing raw bytes
   */
  public async* getFileContent(peer: PeerDomain, fileId: number, processId: number): AsyncIterable<Message> {
    this.downloadsInProgress.set(processId, {});
    // note: dial protocol trhows exception
    const stream = (await this.node?.dialProtocol(peer.id, this._protocol)).stream;
    try {
      return yield* this.rpc.sendMessage(Message.getFileContent(fileId), stream);
    } catch (e) {
      console.log(e);
      if (e.code == ErrorCode.DOWNLOAD_PAUSE.toString()) {
        console.log(ErrorCode.DOWNLOAD_PAUSE);
      }
    } finally {
      // ack to close stream
      await pipe([], stream);
    }
  }

  private async sendMessage(peer: PeerId, message: Message): Promise<Message> {
    logger.info(`Sending message ${message.type}; to ${peer.toB58String()}`);
    // await new Promise(resolve => setTimeout(resolve, this.randomIntFromInterval(1_000, 20_000)));

    const {stream} = await this.node.dialProtocol(peer, this._protocol);
    const response = await oneOnly<Message>(this.rpc.sendMessage(message, stream));
    if (response.error) {
      // TODO throw or let it be?
      logger.error(`Got error message; ${response.error}`);
    }
    return response;
  }

  private async handleIncoming({connection, stream}: ({ connection: any, stream: any })) {
    const peerId = connection.remotePeer;
    logger.info('handle incoming message from: %s', peerId.toB58String())
    const that = this;

    await pipe(
      stream,
      lengthPrefixed.decode(),
      // Tbh this looks overly complicated
      // Are there really chunks of source or I could grab the first one?
      (source: AsyncIterable<Uint8Array>) => (async function* () {
        for await (const chunk of source) {
          const message = Message.deserialize(chunk.slice());
          const response = await that.rpc.handleMessage(peerId, message);
          yield* map(response, (chunk) => chunk.serialize());
        }
      })(),
      lengthPrefixed.encode(),
      stream
    )
  }

  private onlyRemote() {
    return (peer: any) => {
      return !peer.id.equals(this.node.peerId);
    };
  }

}
