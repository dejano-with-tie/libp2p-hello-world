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
  public async findFiles(key: CidDomain, peer: PeerDomain): Promise<FileResponse[]> {
    logger.info(`Searching for file '${key.name}' on provider '${peer.id.toB58String()}'`);
    // await new Promise(resolve => setTimeout(resolve, this.randomIntFromInterval(1_000, 20_000)));

    const message = Message.findFiles(key.name);
    return (await this.sendMessage(peer.id, message)).files.map(file => {
      return FileResponse.fromProto(file, peer);
    });
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
    const [first] = (await this.sendMessage(peer.id, message)).files.map(file => {
      return FileResponse.fromProto(file, peer);
    });

    return first;
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
    // return yield* this.rpc.sendMessage(Message.getFileContent(fileId), stream);
    const response: AsyncIterable<Message> = this.rpc.sendMessage(Message.getFileContent(fileId, offset), stream);
    try {
      for await (const chunk of response) {
        yield* this.throwIfError(chunk);
      }
    } finally {
      // ack to close stream
      await pipe([], stream);
    }
  }

  private* throwIfError(message: Message): Generator<Message> {
    if (message.error) {
      // TODO: Need a way to recreate err
      throw error(ErrorCode.PROTOCOL__RESPONSE_ERROR_MESSAGE, message.error);
    }
    yield message;
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

}
