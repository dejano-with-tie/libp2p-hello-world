import {PeerDomain} from "../protocol/model";
import {Config, updateRelayConfig} from "../config";
import {FileService} from "../service/file.service";
import {container} from "tsyringe";
import logger from "../logger";
import EventEmitter from "events";
import {AppEventEmitter, AppEventId} from "../service/app-event.emitter";
import PeerId from "peer-id";
import Libp2p from "libp2p";
import {NatDiscovery, NatType} from "../nat";

/**
 * Wraps libp2p node
 */
export class Node extends EventEmitter {
  // @ts-ignore
  private _libp2p: Libp2p;
  // @ts-ignore
  private peerId: PeerId;
  private alreadyChangedNat = false;
  // @ts-ignore
  private _natDiscovery: NatDiscovery;

  constructor(
    private _config: Config,
    private _fileService: FileService,
    private _appEventEmitter: AppEventEmitter
  ) {
    super();
    this._natDiscovery = new NatDiscovery(_config.file.network.port, this._appEventEmitter);
  }

  public async start() {
    this._natDiscovery.start();
    updateRelayConfig(this._config, await this._natDiscovery.discover());
    this._libp2p = await Libp2p.create(this._config.libp2p);
    container.register<Libp2p>(Libp2p, {useValue: this._libp2p});
    await this._fileService.addShareDir(this._config.file.shareDirs);
    await this._fileService.syncSharedDirs();
    await this._startLibp2p();

    await this._fileService.publishFiles();
    this._libp2p.addressManager.on('change:addresses', async () => {
      logger.info('address changed')
      logger.info(this._libp2p.addressManager.getObservedAddrs().map((a:any) => a.toString()));
    });
    this._libp2p.connectionManager.on('peer:connect', (_:any) => {
      // +1 because this is emitted after connection is added to the store
      this._appEventEmitter.emit(AppEventId.CONTEXT, {connections: this._libp2p.connectionManager.connections.size + 1});
    });
    this._libp2p.connectionManager.on('peer:disconnect', (_:any) => {
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
    this._appEventEmitter.start();

    // await delayW(() => this._appEventEmitter.emit(AppEventId.CONTEXT, {asRelay: this._config.natType === NatType.OpenInternet}));
    // Setup periodic ping to keep 'online' property up to date

    this._appEventEmitter.emit(AppEventId.CONTEXT, {status: 'online', id: this.peerId.toB58String()});
    this._appEventEmitter.on(AppEventId.NAT, async (nat: NatType) => {
      console.log(`[nat:changed] ${NatType[nat]}`);
      updateRelayConfig(this._config, nat);
      await this.reboot();
    });
  }

  public async stop() {
    await this._stopLibp2p();
    await this._natDiscovery.stop();
    this._appEventEmitter.stop();
  }

  private async _stopLibp2p() {
    await this._libp2p.stop();
    this._appEventEmitter.emit(AppEventId.CONTEXT, {status: 'offline', id: this.peerId.toB58String()});
  }

  private async reboot() {
    this.alreadyChangedNat = true;
    try {
      await this._stopLibp2p();
    } catch (e) {
      logger.error(e);
    }
    logger.info('stopped');
    await setTimeout( async() => {
      logger.info('starting');
      this._libp2p = await Libp2p.create(this._config.libp2p);
      await this._startLibp2p();
    }, 5000)
  }

  private async _startLibp2p() {
    await this._libp2p.start();
    this.peerId = this._libp2p.peerId;
    logger.info(`Node ID: ${this.peerId.toB58String()}`);
    logger.debug('libp2p is listening on the following addresses: ', this._libp2p.transportManager.getAddrs());
    logger.debug('libp2p is advertising the following addresses: ', this._libp2p.multiaddrs);
    this._appEventEmitter.emit(AppEventId.CONTEXT, {status: 'online', id: this.peerId.toB58String()});
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
        const addr = original.remoteAddr.toB58String ? original.remoteAddr.toB58String() : original.remoteAddr.toString();
        message = message.concat(`${addr}`);
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
}
