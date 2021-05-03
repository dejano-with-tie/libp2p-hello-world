import {PeerDomain} from "../protocol/model";
import {Config} from "../config";
import {FileService} from "../service/file.service";
import {container} from "tsyringe";
import logger from "../logger";
import EventEmitter from "events";
import {AppEventEmitter, AppEventId} from "../service/app-event.emitter";
import PeerId from "peer-id";
import {NatType} from "../nat";
import {delayW} from "../utils";
import Libp2p from "libp2p";

/**
 * Wraps libp2p node
 */
export class Node {
  // @ts-ignore
  private _libp2p: Libp2p;
  // @ts-ignore
  private peerId: PeerId;
  private alreadyChangedNat = false;

  constructor(
    private _config: Config,
    private _fileService: FileService,
    private _appEventEmitter: AppEventEmitter
  ) {
    (async () => {
      this._libp2p = await Libp2p.create(_config.libp2p);
      container.register<Libp2p>(Libp2p, {useValue: this._libp2p});
    })();
  }

  public async start() {
    await this._fileService.addShareDir(this._config.file.shareDirs);
    await this._fileService.syncSharedDirs();
    await this._libp2p.start();

    this.peerId = this._libp2p.peerId;
    logger.info(`Node ID: ${this.peerId.toB58String()}`);
    logger.debug('libp2p is listening on the following addresses: ', this._libp2p.transportManager.getAddrs());
    logger.debug('libp2p is advertising the following addresses: ', this._libp2p.multiaddrs);

    await this._fileService.publishFiles();
    this._libp2p.addressManager.on('change:addresses', async () => {
      for (let addr of this._libp2p.addressManager.getObservedAddrs()) {
        const {family, port} = addr.toOptions();
        // if (family === 4 && port === this._config.file.network.port && !this.alreadyChangedNat) {
        if (family === 4 && !this.alreadyChangedNat) {
          logger.error('lets go as relay');
          // if (family === 4 && this._config.natType != NatType.OpenInternet) {
          await this.rebootAsRelay();
          // go as relay
        }
      }
      console.log(this._libp2p.addressManager.getObservedAddrs().map(a => a.toString()));
    });
    this._libp2p.connectionManager.on('peer:connect', (_) => {
      // +1 because this is emitted after connection is added to the store
      this._appEventEmitter.emit(AppEventId.CONTEXT, {connections: this._libp2p.connectionManager.connections.size + 1});
    });
    this._libp2p.connectionManager.on('peer:disconnect', (_) => {
      this._appEventEmitter.emit(AppEventId.CONTEXT, {connections: this._libp2p.connections.size});
    });

    const events = new Map<string, any | EventEmitter>([
      ['peer:connect', this._libp2p.connectionManager],
      ['peer:disconnect', this._libp2p.connectionManager],
      ['peer:discovery', this._libp2p],
      ['loggable', this._libp2p],
      ['change:addresses', this._libp2p.addressManager],
    ]);
    this._propagateEvents(events);
    this._appEventEmitter.emit(AppEventId.CONTEXT, {status: 'online', id: this.peerId.toB58String()});

    // await delayW(() => this._appEventEmitter.emit(AppEventId.CONTEXT, {asRelay: this._config.natType === NatType.OpenInternet}));
    // Setup periodic ping to keep 'online' property up to date

    // this._libp2p._config.relay.enabled = true;
    // await this.stop();
    // await this.start();


  }

  public async stop() {
    await this._libp2p.stop();
    this._appEventEmitter.emit(AppEventId.CONTEXT, {status: 'offline', id: this.peerId.toB58String()});
  }

  public me(): PeerDomain {
    return {
      id: this._libp2p.peerId,
      multiaddrs: this._libp2p.multiaddrs,
      relayedConn: false,
      isLocal: true,
      reachable: true
    }
  }

  /**
   * Retransmit events with new key 'monitor'
   * @param events
   * @private original key -> emitter
   */
  _propagateEvents(events: Map<string, any | EventEmitter>) {
    const toString = (id: string, original: any) => {
      let message = `[${id}] `;

      if (!original) {
        return message;
      }

      if (original.remotePeer) {
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
        const message = toString(id, original);
        logger.info(message);
        this._appEventEmitter.emit(AppEventId.MONITOR, message);
      })
    });
  }

  private async rebootAsRelay() {
    this.alreadyChangedNat = true;
    try {
      await this.stop();
    } catch (e) {
      logger.error(e);
    }
    logger.info('stopped');
    await setTimeout( async() => {
      logger.info('starting');
      // this._config.natType = NatType.OpenInternet;
      await this._libp2p.start();
    }, 5000)
  }
}
