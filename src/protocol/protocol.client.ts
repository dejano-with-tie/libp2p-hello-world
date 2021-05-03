import Libp2p from "libp2p";
import pipe from "it-pipe";
import * as lengthPrefixed from "it-length-prefixed";
import {CidDomain, PeerDomain} from "./model";
import logger from "../logger";
import {error, ErrorCode} from "../gateway/exception/error.codes";
import PeerId from "peer-id";
import {delay, inject, singleton} from "tsyringe";
import {Message} from "./proto/proto";
import {Rpc} from "./rpc";
import {oneOnly} from "../utils";
import map from "it-map";
import {FileResponse} from "../gateway/http/controller/dto/file.response";
import Connection from "libp2p-interfaces/src/connection/connection";
import pTimeout from "p-timeout";
import {transform} from "streaming-iterables";

const filter = require('it-filter')

@singleton()
export class ProtocolClient {

  private readonly _protocol = '/libp2p/enutt/1.0.0';

  constructor(
    @inject(delay(() => Libp2p)) private node: Libp2p,
    private rpc: Rpc
  ) {
    this.node = node;
    this.handleIncoming = this.handleIncoming.bind(this);
    this.node.handle(this._protocol, this.handleIncoming);
  }

  public async provide(key: CidDomain) {
    await this.node.contentRouting.provide(key.value);
  }

  /**
   * Find providers of given key
   * @param key
   */
  public async* findProviders(key: CidDomain): AsyncIterable<PeerDomain> {
    logger.info(`Searching for providers of '${key.name}'`);
    try {
      yield* pipe(
        this.node.contentRouting.findProviders(key.value, {timeout: 10e3}),
        (source: any) => map(source, this.isRelayed()),
        (source: any) => filter(source, this.onlyRemote())
      );
    } catch (e) {
      logger.warn(`No one is providing '${key.name}'`)
      yield* [];
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
    const files: AsyncIterableIterator<FileResponse[]> = pipe(
      this.findProviders(key),
      transform(1000, (peer: PeerDomain) => {
        return this.findFilesOnPeer(key, peer)
      })
    )

    for await (const file of files) {
      yield file;
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
  public async findFilesOnPeer(key: CidDomain, peer: PeerDomain): Promise<FileResponse[]> {
    logger.info(`Searching for file '${key.name}' on provider '${peer.id.toB58String()}'`);
    // await new Promise(resolve => setTimeout(resolve, this.randomIntFromInterval(1_000, 20_000)));

    const message = Message.findFiles(key.name);
    try {
      return (await this.pTimeoutSendMessage(peer.id, message)).files.map(file => {
        peer = this.isRelayed()(peer);
        return FileResponse.fromProto(file, peer);
      });
    } catch (e) {
      console.error(e);
      return Promise.resolve([FileResponse.unreachable(peer)]);
    }
  }

  /**
   * Dials remote peer to fetch file details
   * @param peer
   * @param fileId
   * @returns FileDomain file
   */
  public async getFile(peer: PeerDomain, fileId: number): Promise<FileResponse> {
    logger.info(`Searching for file '${fileId}' on provider '${peer.id.toB58String()}'`);
    const message = Message.getFile(fileId);
    try {
      return (await this.sendMessage(peer.id, message)).files.map(file => {
        return FileResponse.fromProto(file, peer);
      })[0];
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Dials remote peer to get raw bytes of given file id
   * @param peer
   * @param fileId
   * @param offset
   * @return Message containing raw bytes
   */
  public async* getFileContent(peer: PeerDomain, fileId: number, offset: number = 0): AsyncIterable<Message> {
    // note: dial protocol throws exception
    const stream = (await this.node?.dialProtocol(peer.id, this._protocol)).stream;
    const response: AsyncIterable<Message> = this.rpc.sendMessage(Message.getFileContent(fileId, offset), stream);
    try {
      for await (const chunk of response) {
        yield* this.throwIfErrorResponse(chunk);
      }
    } finally {
      // ack to close stream
      await pipe([], stream);
    }
  }

  private* throwIfErrorResponse(message: Message): Generator<Message> {
    if (message.error) {
      // TODO: Need a way to recreate err
      throw error(ErrorCode.PROTOCOL__RESPONSE_ERROR_MESSAGE, message.error);
    }
    yield message;
  }

  private async pTimeoutSendMessage(peer: PeerId, message: Message): Promise<Message> {
    return pTimeout(
      this.sendMessage(peer, message),
      2e3
    )
  }

  private async sendMessage(peer: PeerId, message: Message): Promise<Message> {
    logger.info(`Sending message ${message.type}; to ${peer.toB58String()}`);

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

  private isRelayed() {
    return (peer: PeerDomain) => {
      const conn: Connection | null = this.node.connectionManager.get(peer.id)
      if (conn) {
        peer.relayedConn = conn.remoteAddr.toString().indexOf('p2p-circuit') > -1 || (conn.localAddr?.toString()?.indexOf('p2p-circuit') || 0) > -1;
      }
      return peer;
    };
  }

}
