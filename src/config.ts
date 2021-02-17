import PeerId from "peer-id";
import fsPath from "path";
import fs from "fs";
import logger from './logger';
import {Libp2pOptions,} from "libp2p";
import {NatType} from "./nat";
import {NOISE} from "libp2p-noise";
import Bootstrap from "libp2p-bootstrap";
import Gossipsub from "libp2p-gossipsub";
import {Builder} from "builder-pattern";

const PubsubPeerDiscovery = require('libp2p-pubsub-peer-discovery')

const TCP = require('libp2p-tcp');
const Mplex = require('libp2p-mplex');
const KadDHT = require('libp2p-kad-dht');
const MulticastDNS = require('libp2p-mdns');

export interface ConfigBuilder {
    alias?: string;
    nodePort: number;
    gatewayPort: number;
    filePath: string;
}

export const defaultConfigBuilder: ConfigBuilder = {
    nodePort: 8000,
    gatewayPort: 3000,
    filePath: './config/config.json'
};

export interface Config {
    file: FileConfig,
    natType: NatType,
    libp2p: Libp2pOptions
}

export interface FileConfig {
    alias: string;
    peer: PeerId;
    network: Network;
    gateway: Gateway;
    configFilePath: string;

}

interface Network {
    bootstrapPeers: string[];
    port: number;
}

interface Gateway {
    port: number
}

export const libp2pConfig = async (builder: ConfigBuilder, natType: NatType): Promise<Config> => {
    const fileConfig: FileConfig = await from(Builder(defaultConfigBuilder).alias("local").build());
    const libp2pConfig = {
        peerId: fileConfig.peer,
        addresses: {
            listen: [
                `/ip4/0.0.0.0/tcp/${fileConfig.network.port}`,
            ]
        },
        modules: {
            transport: [TCP],
            streamMuxer: [Mplex],
            connEncryption: [NOISE],
            peerDiscovery: [Bootstrap, PubsubPeerDiscovery, MulticastDNS],
            dht: KadDHT,
            pubsub: Gossipsub
        },
        config: {
            peerDiscovery: {
                [PubsubPeerDiscovery.tag]: {
                    interval: 1000,
                    enabled: true
                },
                [Bootstrap.tag]: {
                    enabled: true,
                    list: fileConfig.network.bootstrapPeers
                },
                [MulticastDNS.tag]: {
                    interval: 20e3,
                    enabled: true
                }
            },
            dht: {
                enabled: true,
                randomWalk: {
                    enabled: true
                }
            },
            relay: {
                enabled: true,
                autoRelay: {
                    enabled: true,
                },
                advertise: {
                    enabled: natType === NatType.OpenInternet,
                },
                hop: {
                    enabled: natType === NatType.OpenInternet,
                    active: natType === NatType.OpenInternet,
                }
            }
        }
    } as any;


    return {
        libp2p: libp2pConfig,
        file: fileConfig,
        natType
    };
}

const from = async (builder: ConfigBuilder): Promise<FileConfig> => {
    const configFilePath = fsPath.join(__dirname, '..', builder.filePath);
    const config: FileConfig = loadFile(configFilePath);
    const [generated, peer] = await generatePeer(config.peer);
    config.peer = await PeerId.createFromJSON(JSON.parse(JSON.stringify(peer)));
    if (generated) {
        await save(config, configFilePath);
    }

    logger.debug(`File config: ${JSON.stringify(config, null, 4)}`);
    return config;
};

const loadFile = (configFilePath: string): FileConfig => {
    return (JSON.parse(fs.readFileSync(configFilePath).toString()) as FileConfig);
};

const generatePeer = async (peer: PeerId): Promise<[boolean, PeerId]> => {
    if (peer) {
        return [false, await PeerId.createFromJSON(JSON.parse(JSON.stringify(peer)))];
    }
    // otherwise generate peer
    const id = await PeerId.create();
    logger.info(`Generated new peer ID: ${id.toB58String()}`);
    return [true, id];
}

const save = async (config: FileConfig, path: string): Promise<void> => {
    await fs.writeFileSync(path, JSON.stringify(config, null, 4));
}
