import Libp2p, {RelayOptions} from 'libp2p';
import logger from './logger';
import {NOISE} from 'libp2p-noise';
import Bootstrap from 'libp2p-bootstrap';
import Gossipsub from 'libp2p-gossipsub';
import json from 'multiformats/codecs/json'
import {sha256} from 'multiformats/hashes/sha2'
import CID from 'cids';
import PeerId from "peer-id";
import Multiaddr from "multiaddr";
import EventEmitter from 'events';
import {promises as fs} from 'fs';
import path from 'path';

const TCP = require('libp2p-tcp');
const Mplex = require('libp2p-mplex');
const KadDHT = require('libp2p-kad-dht');

enum NatType {
    OpenInternet,
    EndpointIndependentMapping,
    EndpointDependentMapping
}

class Node {
    public eventEmitter: EventEmitter = new EventEmitter();
    private node: Libp2p | undefined;
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
            peerDiscovery: [Bootstrap],
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

    constructor(natType: NatType) {
        (this.defaults.config as any).relay = Node.getRelayOptions(natType);
        if ((this.defaults.config as any).relay.hop.enabled) {
            logger.info('Node acting as relay');
        }
        (async () => {
            (this.defaults as any).peerId = await this.getPeerId()

            this.node = await Libp2p.create(this.defaults);
            await this.node.start();
            logger.info(`ID: ${this.node.peerId.toB58String()}`);

            const listenAddrs = this.node.transportManager.getAddrs();
            logger.debug('libp2p is listening on the following addresses: ', listenAddrs);
            const advertiseAddrs = this.node.multiaddrs;
            logger.debug('libp2p is advertising the following addresses: ', advertiseAddrs);

            const events = new Map<string, any | EventEmitter>([
                ['peer:connect', this.node.connectionManager],
                ['peer:disconnect', this.node.connectionManager],
                ['peer:discovery', this.node],
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

    async publish(name: string): Promise<boolean> {
        const bytes = json.encode({name: name});
        const hash = await sha256.digest(bytes);
        const cid: CID = new CID(1, json.code, hash.bytes);

        // const vals = await this.node._dht.getMany(cid.bytes, 1);
        // logger.info(`vals: ${vals}`);

        await this.node?.contentRouting.provide(cid);
        return true;
    }

    async find(name: string): Promise<{ id: PeerId, multiaddrs: Multiaddr[] }[]> {
        const bytes = json.encode({name: name});
        const hash = await sha256.digest(bytes);
        const cid: CID = new CID(1, json.code, hash.bytes);

        const arr = [];
        const providers = await this.node?.contentRouting.findProviders(cid);
        // @ts-ignore
        for await(const p of providers) arr.push(p);
        return arr;
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
        events.forEach((v, id) => {
            v.on(id, (original: any) => {
                logger.debug(`[${id}] (${original.remotePeer?.toB58String()}) ${original.remoteAddr?.toString()}`);
                this.eventEmitter.emit('app:event', {id, original})
            })
        });
    }
}

export {
    NatType,
    Node
}