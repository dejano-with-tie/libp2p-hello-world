import * as fs from 'fs';
import Libp2p from "libp2p";
import CID from "cids";
import json from 'multiformats/codecs/json'
import raw from 'multiformats/codecs/raw'
import {sha256} from 'multiformats/hashes/sha2'
import path from 'path';
import logger from "./logger";
import pipe from "it-pipe";
import first from 'it-first';
import File from "./models/file.model";
import Published from "./models/published.model";

const errcode = require('err-code');
// import errorcode from 'err';

const {publicAddressesFirst} = require('libp2p-utils/src/address-sort');
// import Connection from 'libp2p'

const protons = require('protons');
const PROTOCOL = '/libp2p/file/1.0.0'

const {Request} = protons(`
message Request {
  enum Type {
    PUBLISH = 1;
    GET = 2;
  }
  
  required Type type = 1;
  optional PublishFile publish = 2;
  optional SearchForFile search = 3;
}

message PublishFile {
    required bytes id = 1;
    required string name = 2;
    required int64 size = 3;
}

message SearchForFile {
    required bytes name = 1;
}
`);

export class Protocol {
    private node: Libp2p;
    private shared = new Map<CID, any>();

    constructor(node: Libp2p) {
        this.node = node;
        this.node.handle(PROTOCOL, this.handle)
    }

    private static async createCidsFromName(name: string): Promise<CID[]> {
        const bytes = json.encode({name: name});
        const hash = await sha256.digest(bytes);
        return [new CID(1, json.code, hash.bytes)];
    }

    private static async details(filePath: string) {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            throw new Error(`Only files are shareable. ${filePath} is not a file`);
        }

        const content = fs.readFileSync(filePath);

        const extName = path.extname(filePath);
        const name = path.basename(filePath, extName);
        const [cid] = await Protocol.createCidsFromName(name);

        const bytes = raw.encode(content);
        const hash = await sha256.digest(bytes);
        const fileHash = new CID(1, raw.code, hash.bytes,);

        return {
            size: stat.size,
            cid,
            path: filePath,
            extName,
            name,
            fileHash
        }
    }

    async publish(filePath: string) {
        if (!fs.existsSync(filePath)) {
            throw errcode(Error(`File ${filePath} does not exist`), 'FILE_DOES_NOT_EXIST');
        }
        const details = await Protocol.details(filePath);
        const existing = await File.findOne({
            limit: 1, where: {
                // @ts-ignore
                hash: details.fileHash.toString()
            }
        });
        console.info(`existing: ${existing}`);
        if (existing != null) {
            throw errcode(Error(`File ${filePath} with identical content already published`), 'FILE_ALREADY_PUBLISHED');
        }

        const existingByPath = await File.findOne({
            limit: 1, where: {
                // @ts-ignore
                path: details.path
            }
        });
        console.info(`existing: ${existing}`);
        if (existingByPath != null) {
            throw errcode(Error(`File ${filePath} with different content but same path already published`), 'FILE_ALREADY_PUBLISHED');
        }

        const file = await File.create({
            path: details.path,
            size: details.size,
            mime: 'TODO',
            hash: details.fileHash.toString(),
        });
        await Published.create({cid: details.cid.toString(), value: details.name, fileId: file.id});

        await this.node.contentRouting.provide(details.cid);
        logger.info(`published [${details.cid.toString()}] ${filePath}`);
    }

    async find(name: string): Promise<any> {
        const [cid] = await Protocol.createCidsFromName(name);
        console.log(cid);
        logger.info(`searching for [${cid.toString()}]`);

        const arr: any = [];

        const local = await Published.findOne({
            include: [File], limit: 1, where: {
                // @ts-ignore
                cid: cid.toString()
            }
        });
        if (local != null) {
            arr.push(local.file);
        }
        // if there are providers, ask them to give details about file
        console.log('trace0')
        // findProviders(CID) throws
        try {
            // NOTE: This does not work when providers are not stored locally but rather fetched from other peers.
            // returned data contains only peer id and not the multiaddrs
            // will fail on `storeAddresses(source, this.libp2p.peerStore)`
            const providers = await this.node?.contentRouting.findProviders(cid);
            console.log('trace1');

            // @ts-ignore
            for await(const provider of providers) {
                console.log(`provider: ${provider}`)
                // is local
                if (provider.id.equals(this.node.peerId)) {
                    logger.debug(`I have '${name}'!`);

                    // arr.push(File.find)
                    continue;
                }
                console.log(provider);
                const {stream} = await this.node?.dialProtocol(provider.id, PROTOCOL);
                const response = await pipe(
                    // Source data
                    [`${name}`],
                    // Write to the stream, and pass its output to the next function
                    stream,
                    // Sink function
                    async (source: any) => {
                        const buf: any = await first(source)
                        if (buf) {
                            return buf.slice()
                        }
                    }
                )

                if (response.length === 0) {
                    throw errcode(new Error('No message received'), 'ERR_NO_MESSAGE_RECEIVED')
                }

                logger.debug(String(response));
                const responseParsed = JSON.parse(String(response));
                if (responseParsed.length > 0) {
                    const withProvider = {provider, ...responseParsed};
                    arr.push(withProvider);
                }
            }
        } catch (e) {
            console.error(e);
        }

        return arr;
    }

    async handle({connection, stream}: ({ connection: any, stream: any })) {
        try {
            await pipe(
                stream,
                (source: any) => (async function* () {
                    for await (const message of source) {
                        console.info(`[RECV] ${connection.remotePeer.toB58String().slice(0, 8)}: ${String(message)}`)
                        // createFromCID()
                        const [cid] = await Protocol.createCidsFromName(String(message));
                        console.log(cid);
                        logger.info(`searching for [${cid.toString()}]`);

                        const local = await Published.findOne({
                            include: [File], limit: 1, where: {
                                // @ts-ignore
                                cid: cid.toString()
                            }
                        });
                        if (local === null) {
                            yield null;
                            continue;
                        }

                        if (!fs.existsSync(local.file.path)) {
                            // TODO: Update db
                            continue;
                        }

                        yield JSON.stringify(local.file);
                    }
                })(),
                stream
            )
        } catch (err) {
            console.error(err)
        }
    }

    async download(provider: any, cid: CID) {
        // download
        // store
        // say to network that I also have this file now
    }

    // async writeReadMessage (stream, msg) {
    //     const res = await pipe(
    //         [msg],
    //         lp.encode(),
    //         stream,
    //         lp.decode(),
    //         /**
    //          * @param {AsyncIterable<Uint8Array>} source
    //          */
    //         async source => {
    //             const buf = await first(source)
    //
    //             if (buf) {
    //                 return buf.slice()
    //             }
    //         }
    //     )
    //
    //     if (res.length === 0) {
    //         throw errcode(new Error('No message received'), 'ERR_NO_MESSAGE_RECEIVED')
    //     }
    //
    //     return Message.deserialize(res)
    // }
}