import * as fs from 'fs';
import Libp2p from "libp2p";
import MuxedStream from "libp2p";
import CID from "cids";
import json from 'multiformats/codecs/json'
import raw from 'multiformats/codecs/raw'
import {sha256} from 'multiformats/hashes/sha2'
import path from 'path';
import logger from "./logger";
import pipe from "it-pipe";
import first from 'it-first';
import PeerId from "peer-id";
import lp, {varintDecode} from 'it-length-prefixed';
import {Db} from "./models";
import Multiaddr from "multiaddr";
import File from "./models/file.model";
import fileSize from "filesize";
import {EOL} from "os";
import Download from "./models/download.model";
import EventEmitter from "events";
import WritableStream = NodeJS.WritableStream;

const afterBreak = false;
const offset = 160366592;

interface Provider {
    isLocal: boolean;
    multiaddrs: Multiaddr[];
    id: ({ id: string, pubKey: string });
}

interface Location {
    provider: Provider;
    fileId: number;
    path: string;

}

interface FindFileResult {
    size: number,
    mime: string,
    locations: Location[]
}

interface FindFileResults extends Map<string, FindFileResult> {
}

const errcode = require('err-code');
// import errorcode from 'err';

const {publicAddressesFirst} = require('libp2p-utils/src/address-sort');
// import Connection from 'libp2p'

const protons = require('protons');
const PROTOCOL = '/libp2p/file/1.0.0'

interface FileInfoResponse {
    type: number,
    info: FileInfo[]
}

interface FileInfo {
    id: number;
    path: string;
    mime: string;
    checksum: string;
    size: number;
    createdAt: string | any;
    updatedAt: string | any;
}

const {Request} = protons(`
message Request {
  enum Type {
    INFO = 1;
    DOWNLOAD = 2;
  }
  
  required Type type = 1;
  optional FileInfo info = 2;
  optional FileDownload download = 3;
}

message FileDownload {
    required int64 id = 1;
}

message FileInfo {
    required string name = 1;
}
`);

const {Response} = protons(`
message Response {
  enum Type {
    INFO = 1;
    DOWNLOAD = 2;
  }
  
  required Type type = 1;
  repeated FileInfo info = 2;
  optional FileDownload download = 3;
}

message FileDownload {
    required int64 id = 1;
}

message FileInfo {
    required int64 id = 1;
    required string path = 2;
    required int64 size = 3;
    required string mime = 4;
    required string checksum = 5;
    required string createdAt = 6;
    required string updatedAt = 7;
}
`);

const {DownloadResponse} = protons(`
message DownloadResponse {
    required bytes data = 1;
    optional bool error = 2;
}
`);

export class Protocol {
    private node: Libp2p;
    private db: Db;
    private downloadEvent: EventEmitter;
    // in mem tracker of active dls
    private downloads = new Map<number, any>();

    constructor(node: Libp2p, db: Db, downloadEvent: EventEmitter) {
        this.node = node;
        this.db = db;
        this.downloadEvent = downloadEvent
        this.handleInfo = this.handleInfo.bind(this);
        this.handle = this.handle.bind(this);
        this.node.handle(PROTOCOL, this.handle);
        this.downloadEvent.on('pause', ({downloadId}: ({ downloadId: number })) => {
            if (this.downloads.has(downloadId)) {
                const dl = this.downloads.get(downloadId);
                // TODO: If prev state is inprogress
                dl.status = 'paused';
            }
            console.log('got pause');
        });
    }

    static echo(totalSize: number, out: WritableStream) {
        let total = afterBreak ? offset : 0;
        let prevProgress = 0;
        return async function* (source: any) {
            for await (const message of source) {
                // err part is 4 bytes
                const len = varintDecode(message) - 4;
                total += len;
                const progress = Math.floor((total / totalSize) * 100);
                // if (progress > 50 && !afterBreak) {
                //     // simulate err
                //     throw errcode(new Error('simulate error'), 'simulate error');
                // }
                if (prevProgress !== progress) {
                    out.write(String(progress) + '%' + EOL);
                    prevProgress = progress;
                }
                yield message;
            }
            console.log(fileSize(total, {exponent: 1}))
        }
    }

    private static async createCidFromName(name: string): Promise<CID[]> {
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
        const [cid] = await Protocol.createCidFromName(name);

        const bytes = raw.encode(content);
        const hash = await sha256.digest(bytes);
        const fileHash = new CID(1, raw.code, hash.bytes,);

        console.log(stat.size / 1024);
        console.log(stat.size / 1000);
        console.log(fileSize(stat.size, {exponent: 1}));
        return {
            size: stat.size,//fileSize(stat.size, {exponent: 1 output: 'object'}).value, //fileSize(stat.size, {round: 0, exponent: 1, output: 'object'}).value,
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

        const existing = await this.db.fileRepository.findOneByChecksum(details.fileHash.toString());
        if (existing) {
            throw errcode(Error(`File ${filePath} with identical content already published`), 'FILE_ALREADY_PUBLISHED');
        }

        const existingByPath = await this.db.fileRepository.findOneByPath(details.path);
        if (existingByPath != null) {
            throw errcode(Error(`File ${filePath} with different content but same path already published`), 'FILE_ALREADY_PUBLISHED');
        }

        const hash = this.db.hashRepository.create();
        hash.cid = details.cid.toString();
        hash.value = details.name;

        const file = this.db.fileRepository.create();
        file.checksum = details.fileHash.toString();
        file.path = details.path;
        file.size = details.size;
        file.mime = 'TODO';
        file.hashes = [hash];
        await this.db.fileRepository.save(file);
        await this.node.contentRouting.provide(details.cid);
        logger.info(`published [${details.cid.toString()}] ${filePath}`);
    }


    async find(name: string): Promise<FindFileResults> {
        const [cid] = await Protocol.createCidFromName(name);
        logger.info(`searching for [${cid.toString()}]`);

        const results: FindFileResults = new Map();

        // TODO: not one
        const local = await this.db.hashRepository.findOneByCid(cid.toString());
        if (local) {
            local.files.forEach(file => {
                const result: FindFileResult = {
                    mime: file.mime,
                    size: file.size,
                    locations: [{
                        fileId: file.id, path: file.path, provider: {
                            isLocal: true,
                            id: this.withoutPrivKey(),
                            multiaddrs: this.node.multiaddrs
                        }
                    }]
                };
                results.set(file.checksum, result);
            });
        }

        let providers = undefined;
        try {
            providers = await this.node.contentRouting.findProviders(cid);
        } catch (e) {
            logger.error(e);
            return results;
        }
        console.log('trace0')

        try {
            for await(const provider of providers) {
                // is local
                if (provider.id.equals(this.node.peerId)) {
                    logger.debug(`I have '${name}'!`);
                    continue;
                }

                console.log(`provider: ${provider.id.toB58String()}`)

                const {stream} = await this.node?.dialProtocol(provider.id, PROTOCOL);
                const request = Request.encode({
                    type: Request.Type.INFO,
                    info: {name}
                })

                const response: FileInfoResponse = await pipe(
                    // Source data
                    [request],
                    // Write to the stream, and pass its output to the next function
                    stream,
                    // Sink function
                    async (source: any) => {
                        const buf: any = await first(source)
                        if (buf) {
                            return Response.decode(buf.slice());
                            // return buf.slice()
                        }
                    }
                )

                if (!response || response.type !== Response.Type.INFO) {
                    continue;
                }

                response.info.map(file => {
                    if (results.has(file.checksum)) {
                        results.get(file.checksum)?.locations.push({
                            fileId: file.id,
                            path: file.path,
                            provider: {
                                isLocal: false,
                                id: this.withoutPrivKey(provider.id),
                                multiaddrs: provider.multiaddrs
                            }
                        })
                    } else {
                        const result: FindFileResult = {
                            mime: file.mime,
                            size: file.size,
                            locations: [{
                                fileId: file.id, path: file.path, provider: {
                                    isLocal: false,
                                    id: this.withoutPrivKey(provider.id),
                                    multiaddrs: provider.multiaddrs
                                }
                            }]
                        };
                        results.set(file.checksum, result);
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }

        return results;
    }

    async handle({connection, stream}: ({ connection: any, stream: any })) {
        let that = this;
        try {

            await pipe(
                stream,
                (source: AsyncIterable<Uint8Array>) => (async function* () {
                    const buffer = await first(source) as any;
                    const request = Request.decode(buffer.slice());
                    logger.info(`REQUEST: ${JSON.stringify(request)}`);
                    try {
                        switch (request.type) {
                            case Request.Type.INFO:
                                const response = await that.handleInfo(request);
                                if (response) {
                                    console.log(`RESPONSE: ${JSON.stringify(response)}`);
                                    yield Response.encode(response);
                                }
                                break;
                            case Request.Type.DOWNLOAD:
                                for await (const chunk of that.handleDownload(stream, request)) {
                                    yield chunk
                                }

                                break;
                            default:
                            // do nothing
                        }
                    } catch (e) {
                        // TODO: Response with error here
                        console.log(e);
                        // NOTE: yield null/undefined will close the stream
                        // yield 'a';
                        // return;
                    }
                })(),
                // lp.encode({lengthEncoder: int32BEEncode}),
                // Encode with length prefix (so receiving side knows how much data is coming)
                lp.encode(),
                // stream,
                stream
            )
        } catch (err) {
            // TODO: This error is not catching errors inside pipe fns
            console.error(err)
        }
    }

    // TODO: Request is not any but proto request
    async* handleDownload(stream: MuxedStream, request: any) {
        // TODO valid path
        const file = await this.db.fileRepository.findOne({id: request.download.id});
        if (!file) {
            yield DownloadResponse.encode({
                error: true,
                data: Buffer.from('invalid file id'),
            });
            return;
        }

        let options = {};
        if (afterBreak) {
            options = {start: offset}
        }

        const readStream = fs.createReadStream(file.path, options);
        // const readStream = fs.ReadStream.from(['test', '123', 'this should be long', 'short'])
        for await (const chunk of readStream) {
            yield DownloadResponse.encode({data: chunk});
            // yield chunk;
        }
    }

    async handleInfo(request: any): Promise<FileInfoResponse | undefined> {
        const [cid] = await Protocol.createCidFromName(request.info.name);
        logger.debug(`searching for [${cid.toString()}]`);
        const hashes = await this.db.hashRepository.findOneByCid(cid.toString());
        if (!hashes?.files?.length) {
            return undefined;
        }

        const validFiles: File[] = hashes.files.filter(file => fs.existsSync(file.path));
        hashes.files.filter(file => !validFiles.includes(file)).forEach(file => {
            logger.info(`Invalid file: ${file.path}`);
            // TODO: Update db
        });

        return {
            type: Response.Type.INFO,
            info: validFiles.map(file => {
                let {pathIsValid, ...response} = file;
                return response;
            })
        };
    }


    async continueDownload(dl: Download, response: WritableStream) {
        const stat = fs.statSync(dl.downloadPath);
        const size = stat.size;


    }

    async download(provider: PeerId, fileId: number, downloadPath: string, totalSize: number, response: WritableStream) {
        // TODO: Line below recreates file
        const out = fs.createWriteStream(downloadPath, {flags: 'a'});
        let state = 'inprogress';
        this.downloads.set(1, {status: 'inprogress'});
        this.downloadEvent.on('pause', (b: any) => {
            console.log('got pause');
        });
        try {
            const {stream} = await this.node?.dialProtocol(provider, PROTOCOL);
            const request = Request.encode({
                type: Request.Type.DOWNLOAD,
                download: {id: fileId}
            });

            const result = await pipe(
                [request],
                stream,
                // lp.decode({lengthDecoder: int32BEDecode}),
                Protocol.echo(totalSize, response),
                lp.decode(),
                async (source: any) => {
                    for await (const message of source) {
                        const buf = message.slice();
                        if (!buf) {
                            // no msg
                            throw errcode(new Error('No message'), 'ERR_NO_MESSAGE_RECEIVED');
                        }

                        // await out.write(buf);
                        const resp = DownloadResponse.decode(buf);
                        if (resp.hasError()) {
                            throw errcode(new Error(`Download failed: '${String(resp.data)}'`), 'ERR_DOWNLOAD_FILE');
                        }
                        await out.write(resp.data);

                        if (this.downloads.has(1)) {
                            const dl = this.downloads.get(1);
                            if (dl.status === 'paused') {
                                return 'paused';
                            }
                        }
                    }
                    return 'completed';
                }
                // Decode length-prefixed data
                // lp.decode(),
                // out
            );
            console.info(`Response: ${result}`);
            this.downloads.delete(1);
        } catch (e) {
            this.downloads.delete(1);
            console.error(e);
            throw e;
        }
        //
        // read.pipe(out);


        // download
        // store
        // say to network that I also have this file now
    }

    private withoutPrivKey(peerId: PeerId = this.node.peerId): ({ id: string, pubKey: string }) {
        const id = {...peerId.toJSON()};
        return {
            id: id.id,
            pubKey: id.pubKey ?? ''
        };
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
