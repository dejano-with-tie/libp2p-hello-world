import {Config} from "./config";
import Libp2p from "libp2p";
import logger from "./logger";
import {FileService} from "./service/file.service";
import {container} from "tsyringe";
import EventEmitter from "events";

export async function bootstrap(config: Config, fileService: FileService): Promise<Libp2p> {
  await fileService.addShareDir(config.file.shareDirs);
  await fileService.syncSharedDirs();


  const node = await Libp2p.create(config.libp2p);
  await node.start();
  container.register<Libp2p>(Libp2p, {useValue: node});

  logger.info(`Node ID: ${node.peerId.toB58String()}`);
  logger.debug('libp2p is listening on the following addresses: ', node.transportManager.getAddrs());
  logger.debug('libp2p is advertising the following addresses: ', node.multiaddrs);

  await fileService.publishFiles();

  const events = new Map<string, any | EventEmitter>([
    ['peer:connect', node.connectionManager],
    ['peer:disconnect', node.connectionManager],
    ['peer:discovery', node],
    ['peer', node.peerStore],
    ['loggable', node],
  ]);
  propagateEvents(events);

  return node;
}

/**
 * Retransmit events with new key 'app:event'
 * @param events
 * @private original key -> emitter
 */
function propagateEvents(events: Map<string, any | EventEmitter>) {
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
      // this.eventEmitter.emit('app:event', {id, original})
    })
  });
}
