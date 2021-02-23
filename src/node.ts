import Libp2p from 'libp2p';
import logger from './logger';
import PeerId from "peer-id";
import Multiaddr from "multiaddr";
import EventEmitter from 'events';
import {Protocol} from './protocol';
import {Config} from "./config";
import Published from "./models/published.model";
import CID from "cids";
import util from 'util';

const sleep = util.promisify(setTimeout);

class Node {
    public eventEmitter: EventEmitter = new EventEmitter();
    // @ts-ignore
    public libp2p: Libp2p;
    public readonly config: Config;
    // @ts-ignore
    private protocol: Protocol;

    private constructor(config: Config) {

        this.config = config;
        logger.debug(`Creating node with config: ${JSON.stringify(this.config, null, 4)}`);
        if (this.config.libp2p.config?.relay?.hop.enabled) {
            logger.info('Node acting as relay');
        }
    }

    public static run = async (config: Config): Promise<Node> => {
        const node = new Node(config);
        node.libp2p = await Libp2p.create(node.config.libp2p);
        await node.start();


        node.protocol = new Protocol(node.libp2p);
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

    public async find(name: string): Promise<{ id: PeerId; multiaddrs: Multiaddr[] }[] | undefined> {
        return await this.protocol.find(name);
    }

    public whoAmI() {
        return this.libp2p.peerId;
    }

    public async download(provider: string, fileId: number) {
        return await this.protocol.download(PeerId.createFromB58String(provider), fileId);
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
                for (const published of (await Published.findAll())) {
                    await this.libp2p.contentRouting.provide(new CID(published.cid));
                    logger.info(`published [${JSON.stringify(published)}]`);
                }
            })();
        }, 10 * 1000);
    }
}


export {
    Node
}