import Libp2p from 'libp2p';
import logger from './logger';
import PeerId from "peer-id";
import Multiaddr from "multiaddr";
import EventEmitter from 'events';
import {Protocol} from './protocol';
import {Config} from "./config";

class Node {
    public eventEmitter: EventEmitter = new EventEmitter();
    // @ts-ignore
    public libp2p: Libp2p;
    // @ts-ignore
    private protocol: Protocol;
    public readonly config: Config;

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
        await node.libp2p.start();

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

    async stop() {
        await this.libp2p.stop();
    }

    async publish(filePath: string): Promise<void> {
        await this.protocol.publish(filePath);
    }

    async find(name: string): Promise<{ id: PeerId; multiaddrs: Multiaddr[] }[] | undefined> {
        return this.protocol.find(name);
    }

    public whoAmI() {
        return this.libp2p.peerId;
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
}

export {
    Node
}