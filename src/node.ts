import Libp2p from 'libp2p';
import logger from './logger';
import PeerId from "peer-id";
import EventEmitter from 'events';
import {Protocol} from './libp2p-client/protocol';
import {Config} from "./config";
import util from 'util';
import {Db} from "./models";
import CID from "cids";
import {DownloadStatus} from "./models/download.model";
import {ProtocolService} from "./libp2p-client/protocol.service";
import {container} from "tsyringe";
import {ProtocolClient} from "./libp2p-client/protocol.client";
import WritableStream = NodeJS.WritableStream;

const sleep = util.promisify(setTimeout);

export interface DownloadRequest {
  remotePeerId: string,
  remoteFileId: number,
  remoteFileChecksum: string,
  remoteFileSize: number,
  downloadPath: string,
}

// curl -H ''

export class Node {
  public eventEmitter: EventEmitter = new EventEmitter();
  public downloadEvent: EventEmitter = new EventEmitter();
  // @ts-ignore
  public libp2p: Libp2p;
  public readonly config: Config;
  // @ts-ignore
  private protocol: Protocol;
  private db: Db;

  private constructor(config: Config, db: Db) {

    this.config = config;
    this.db = db;
    if (this.config.libp2p.config?.relay?.hop.enabled) {
      logger.info('Node acting as relay');
    }
  }

  public static run = async (config: Config, db: Db): Promise<Node> => {
    const node = new Node(config, db);
    node.libp2p = await Libp2p.create(node.config.libp2p);
    await node.start();
    const protocolClient = new ProtocolClient(node.libp2p);
    container.register<Node>('Node', {useValue: node});
    container.register(ProtocolClient, {useValue: protocolClient});
    container.register(ProtocolService, {useValue: new ProtocolService(node.libp2p, protocolClient)});

    node.protocol = new Protocol(node.libp2p, db, node.downloadEvent);
    logger.info(`Node ID: ${node.libp2p.peerId.toB58String()}`);
    logger.debug('libp2p is listening on the following addresses: ', node.libp2p.transportManager.getAddrs());
    logger.debug('libp2p is advertising the following addresses: ', node.libp2p.multiaddrs);

    const events = new Map<string, any | EventEmitter>([
      ['peer:connect', node.libp2p.connectionManager],
      ['peer:disconnect', node.libp2p.connectionManager],
      ['peer:discovery', node.libp2p],
      ['peer', node.libp2p.peerStore],
      ['loggable', node.libp2p],
    ]);
    node.propagateEvents(events);

    return node;
  }

  public async stop() {
    await this.libp2p.stop();
  }

  public async publish(filePath: string): Promise<void> {
    await this.protocol.publish(filePath);
  }

  public async getAllPublished() {
    return await this.db.fileRepository.find({relations: ['hashes']});
  }

  public async find(name: string): Promise<any | undefined> {
    return await this.protocol.find(name);
  }

  public whoAmI() {
    return this.libp2p.peerId;
  }

  public async resume(downloadId: number, out: WritableStream) {
    const dl = await this.db.downloadRepository.findOne(downloadId);
    if (!dl) {
      out.write('unknown dl, 404');
      return;
    }

    dl.status = DownloadStatus.InProgress;
    await this.db.downloadRepository.save(dl);
    try {
      await this.protocol.continueDownload(dl, out);
      dl.status = DownloadStatus.CompletedUnverified;
      // TODO: Emit event on save
      await this.db.downloadRepository.save(dl);
    } catch (e) {
      console.log(e);
      dl.status = DownloadStatus.Failed;
      await this.db.downloadRepository.save(dl);
    }
  }

  public async pauseDownload(downloadId: number) {
    this.downloadEvent.emit('pause', {downloadId});
  }

  // TODO: Provide parameter where to save
  public async download(toDownload: DownloadRequest, out: WritableStream) {
    // TODO: Check is it me? peerId == remotePeerId
    // TODO: What if file is already dled?

    const dl = this.db.downloadRepository.create();
    // TODO: Fetch this information from remote peer. Later on it can be cached
    dl.downloadPath = toDownload.downloadPath;
    dl.remoteFileChecksum = toDownload.remoteFileChecksum;
    dl.remoteFileId = toDownload.remoteFileId;
    dl.remoteFileSize = toDownload.remoteFileSize;
    dl.remotePeerId = toDownload.remotePeerId;
    await this.db.downloadRepository.save(dl);

    try {

      await this.protocol.download(PeerId.createFromB58String(toDownload.remotePeerId), toDownload.remoteFileId, toDownload.downloadPath, toDownload.remoteFileSize, out);

      dl.status = DownloadStatus.CompletedUnverified;
      // TODO: Emit event on save
      await this.db.downloadRepository.save(dl);
    } catch (e) {
      console.log(e);
      dl.status = DownloadStatus.Failed;
      await this.db.downloadRepository.save(dl);
    }
  }

  /**
   * Retransmit events with new key 'app:event'
   * @param events
   * @private original key -> emitter
   */
  private propagateEvents(events: Map<string, any | EventEmitter>) {
    const toString = (id: string, original: any) => {
      let message = `[${id}] `;

      if (original.remotePeer) {
        console.log(message);
        message = message.concat(`(${original.remotePeer.toB58String()}) `);
      }
      if (original.remoteAddr) {
        message = message.concat(`${original.remoteAddr.toString()}`);
      }

      if (!original.remotePeer && !original.remoteAddr) {
        message = message.concat(`${original}`)
      }
      return message;
    }
    events.forEach((v, id) => {
      v.on(id, (original: any) => {
        logger.debug(toString(id, original));
        this.eventEmitter.emit('app:event', {id, original})
      })
    });
  }

  private async start() {
    await this.libp2p.start();
    // rebroadcast files
    setTimeout(() => {
      (async () => {
        for (const file of (await this.db.fileRepository.findAllValid({relations: ['hashes']}))) {
          for (const hash of file.hashes) {
            await this.libp2p.contentRouting.provide(new CID(hash.cid));
            logger.info(`Republished: ${JSON.stringify(file.path)}`);
          }
        }
      })();
    }, 2 * 1000);
  }
}
