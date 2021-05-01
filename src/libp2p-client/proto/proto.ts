import fs from "fs";
import {PeerDomain} from "../model";
import {FileResponse} from "../../gateway/http/controller/dto/file.response";

const protobuf = require('protocol-buffers');
const pbm = protobuf(fs.readFileSync('./src/libp2p-client/proto/messages.proto'));

export enum MessageType {
  FIND_FILE = 1,
  GET_FILE = 2,
  GET_FILE_CONTENT = 3,
}

export enum MessageStyle {
  REQUEST_RESPONSE,
  STREAM
}

export const MESSAGE_TYPE_STYLE = {
  [MessageType.FIND_FILE]: MessageStyle.REQUEST_RESPONSE,
  [MessageType.GET_FILE]: MessageStyle.REQUEST_RESPONSE,
  [MessageType.GET_FILE_CONTENT]: MessageStyle.STREAM,
}

export class File {
  id: number;
  path: string;
  mime: string;
  checksum: string;
  size: number;
  createdAt: string | any;
  updatedAt: string | any;


  constructor(id: number, path: string, mime: string, checksum: string, size: number, createdAt: any, updatedAt: any) {
    this.id = id;
    this.path = path;
    this.mime = mime;
    this.checksum = checksum;
    this.size = size;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

}

export class Message {
  public static readonly TYPES = MessageType;

  public type: MessageType;
  public query?: string;
  public fileId?: number;
  public offset?: number;
  public files: File[] = [];
  public content?: Uint8Array;
  public error?: string;


  constructor(type: MessageType) {
    this.type = type;
  }

  public static findFiles(query: string) {
    const msg = new Message(MessageType.FIND_FILE);
    msg.query = query;
    return msg;
  }

  public static getFile(fileId: number) {
    const msg = new Message(MessageType.GET_FILE);
    msg.fileId = fileId;
    return msg;
  }

  public static getFileContent(fileId: number, offset: number = 0) {
    const msg = new Message(MessageType.GET_FILE_CONTENT);
    msg.fileId = fileId;
    msg.offset = offset;
    return msg;
  }

  /**
   * Decode from protobuf
   *
   * @param {Uint8Array} raw
   */
  public static deserialize(raw: Uint8Array) {
    const dec = pbm.Message.decode(raw)

    const msg = new Message(dec.type)

    if (dec.query) {
      msg.query = dec.query.toString();
    }

    if (dec.fileId) {
      msg.fileId = dec.fileId;
    }

    if (dec.offset != undefined) {
      msg.offset = dec.offset;
    }

    if (dec.content) {
      msg.content = dec.content;
    }

    if (dec.error) {
      msg.error = dec.error.toString();
    }

    if (dec.files && dec.files.length) {
      msg.files = dec.files.map((f: any) => new File(f.id, f.path, f.mime, f.checksum, f.size, f.createdAt, f.updatedAt));
    }

    return msg
  }

  /**
   * Encode into protobuf
   */
  public serialize(): Uint8Array {
    const obj = {
      type: this.type,
      query: undefined,
      offset: undefined,
      fileId: undefined,
      content: undefined,
      error: undefined,
      files: undefined,
    }

    if (this.query) {
      obj.query = this.query as any;
    }

    if (this.fileId) {
      obj.fileId = this.fileId as any;
    }

    if (this.offset != undefined) {
      obj.offset = this.offset as any;
    }

    if (this.content) {
      obj.content = this.content as any;
    }

    if (this.error) {
      obj.error = this.error as any;
    }

    if (this.files && this.files.length) {
      obj.files = this.files as any;
    }

    return pbm.Message.encode(obj)
  }
}
