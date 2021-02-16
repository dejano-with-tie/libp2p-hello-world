import Libp2p, {RelayOptions} from 'libp2p';
import logger from './logger';
import {NOISE} from 'libp2p-noise';
import Gossipsub from 'libp2p-gossipsub';
import PeerId from "peer-id";
import Multiaddr from "multiaddr";
import EventEmitter from 'events';

import {promises as fs} from 'fs';
import path from 'path';
import {Protocol} from './protocol';
import Bootstrap from "libp2p-bootstrap";

const PubsubPeerDiscovery = require('libp2p-pubsub-peer-discovery')

const TCP = require('libp2p-tcp');
const Mplex = require('libp2p-mplex');
const KadDHT = require('libp2p-kad-dht');
const MulticastDNS = require('libp2p-mdns');

enum NatType {
    OpenInternet,
    EndpointIndependentMapping,
    EndpointDependentMapping
}

class Node {
    public eventEmitter: EventEmitter = new EventEmitter();
    public node: Libp2p | undefined;
    private defaults = {
        addresses: {
            listen: [
                '/ip4/0.0.0.0/tcp/0',
            ]
        },
        modules: {
            transport: [TCP],
            streamMuxer: [Mplex],
            connEncryption: [NOISE],
            peerDiscovery: [Bootstrap, PubsubPeerDiscovery],
            dht: KadDHT,
            pubsub: Gossipsub
        },
        config: {
            peerDiscovery: {
                bootstrap: {
                    list: ['/ip4/54.175.90.157/tcp/8000/ipfs/QmfCEMJ1wjsGuXNwnPa8H3dZ8CDGjmbWWFnjghxJ18ZJhs']
                }
            },
            dht: {
                enabled: true,
                randomWalk: {
                    enabled: true
                }
            },

        }
    };
    private protocol: Protocol | undefined;

    constructor(natType: NatType, port?: number) {
        (this.defaults.config as any).relay = Node.getRelayOptions(natType);
        if (port) {
            (this.defaults as any).addresses.listen.push(`/ip4/0.0.0.0/tcp/${port}`);
        }
        if ((this.defaults.config as any).relay.hop.enabled) {
            logger.info('Node acting as relay');
        }
        (async () => {
            (this.defaults as any).peerId = await this.getPeerId()

            this.node = await Libp2p.create(this.defaults);
            await this.node.start();
            logger.info(`Node ID: ${this.node.peerId.toB58String()}`);

            const listenAddrs = this.node.transportManager.getAddrs();
            logger.debug('libp2p is listening on the following addresses: ', listenAddrs);
            const advertiseAddrs = this.node.multiaddrs;
            logger.debug('libp2p is advertising the following addresses: ', advertiseAddrs);

            this.protocol = new Protocol(this.node);

            const events = new Map<string, any | EventEmitter>([
                ['peer:connect', this.node.connectionManager],
                ['peer:disconnect', this.node.connectionManager],
                ['peer:discovery', this.node],
                ['peer', this.node.peerStore],
                ['loggable', this.node],
            ]);
            this.propagateEvents(events);
        })();

    }

    private static getRelayOptions(type: NatType): RelayOptions {
        return {
            enabled: true,
            autoRelay: {
                enabled: true,
                // maxListeners: 2
            },
            advertise: {
                enabled: type === NatType.OpenInternet,
                // bootDelay: 100,
                // ttl: ?
            },
            hop: {
                enabled: type === NatType.OpenInternet,
                active: type === NatType.OpenInternet,
            }
        };

    }

    async stop() {
        this.node?.stop();
    }

    async publish(filePath: string): Promise<void> {
        await this.protocol?.publish(filePath);
    }

    async find(name: string): Promise<{ id: PeerId; multiaddrs: Multiaddr[] }[] | undefined> {
        return this.protocol?.find(name);
    }

    public whoAmI() {
        return this.node?.peerId;
    }

    async getPeerId(): Promise<PeerId> {
        const peerIdPath = path.join(__dirname, '..', 'config', 'peer-id.json');
        try {
            return await PeerId.createFromJSON((JSON.parse((await fs.readFile(peerIdPath)).toString())));
        } catch (e) {
            logger.warn(e);
        }
        const id = await PeerId.create();
        await fs.writeFile(peerIdPath, JSON.stringify(id, null, 4));
        logger.info('Peer id has been generated and saved in config/peer-id.json.');
        return id;
    }

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
    NatType,
    Node
}