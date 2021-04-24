import PeerId from "peer-id";
import fsPath from "path";
import fs from "fs";
import logger from './logger';
import {Libp2pOptions,} from "libp2p";
import {NatType} from "./nat";
import {NOISE} from "libp2p-noise";
import Bootstrap from "libp2p-bootstrap";
import Gossipsub from "libp2p-gossipsub";
import {injectable} from "tsyringe";

const PubsubPeerDiscovery = require('libp2p-pubsub-peer-discovery')

const TCP = require('libp2p-tcp');
const Mplex = require('libp2p-mplex');
const KadDHT = require('libp2p-kad-dht');
const MulticastDNS = require('libp2p-mdns');

export interface ConfigBuilder {
    alias?: string;
    db?: string;
    nodePort?: number;
    gatewayPort?: number;
    filePath: string;
    peerIdFilePath: string;
}

export const defaultConfigBuilder: ConfigBuilder = {
    filePath: './config/config.json',
    peerIdFilePath: './config/id.json'
};

export interface Config {
    file: FileConfig,
    natType: NatType,
    libp2p: Libp2pOptions
}

export interface FileConfig {
    alias: string;
    db: string;
    network: Network;
    gateway: Gateway;
    peerIdFilePath: string;
}

interface Network {
    bootstrapPeers: string[];
    port: number;
}

interface Gateway {
    port: number
}

export const libp2pConfig = async (builder: ConfigBuilder, natType: NatType): Promise<Config> => {
    const fileConfig: FileConfig = await from(builder);
    const peer = await peerId(builder.peerIdFilePath);

    const libp2pConfig = {
        peerId: peer,
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
    const fileConfig: FileConfig = loadFile(configFilePath);

    fileConfig.network.port = builder.nodePort || fileConfig.network.port;
    fileConfig.gateway.port = builder.gatewayPort || fileConfig.gateway.port;
    fileConfig.alias = builder.alias || fileConfig.alias;
    fileConfig.db = builder.db || fileConfig.db;
    fileConfig.peerIdFilePath = builder.peerIdFilePath || fileConfig.peerIdFilePath;

    return fileConfig;
};

const loadFile = (configFilePath: string): FileConfig => {
    return (JSON.parse(fs.readFileSync(configFilePath).toString()) as FileConfig);
};

async function peerId(peerIdFilePath: string): Promise<PeerId> {
    if (fs.existsSync(peerIdFilePath)) {
        const text = JSON.parse(fs.readFileSync(peerIdFilePath).toString());
        return await PeerId.createFromJSON(text);
    }

    const id = await PeerId.create();
    logger.info(`Generated new peer ID: ${id.toB58String()}`);
    fs.writeFileSync(peerIdFilePath, JSON.stringify(id.toJSON(), null, 4));
    return id;
}
