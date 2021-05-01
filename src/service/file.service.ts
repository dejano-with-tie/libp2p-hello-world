import {delay, inject, injectable} from "tsyringe";
import {FileRepository} from "../repository/file.repository";
import {HashRepository} from "../repository/hash.repository";
import Hash from "../models/hash.model";
import File from "../models/file.model";
import * as fs from "fs";
import {Stats} from "fs";
import * as fspath from "path";
import path from "path";
import logger from "../logger";
import {error, ErrorCode} from "../gateway/exception/error.codes";
import {Config, SharedDir} from "../config";
import {DirectoryRepository} from "../repository/directory.repository";
import Directory from "../models/directory.model";
import CID from "cids";
import raw from 'multiformats/codecs/raw'
import {sha256} from 'multiformats/hashes/sha2'
import {FileTypeService} from "./file-type.service";
import {ProtocolClient} from "../libp2p-client/protocol.client";
import {CidDomain} from "../libp2p-client/model";

const fsp = fs.promises;

@injectable()
export class FileService {

  constructor(
    private fileRepository: FileRepository,
    private directoryRepository: DirectoryRepository,
    private hashRepository: HashRepository,
    private fileTypeService: FileTypeService,
    @inject(delay(() => ProtocolClient)) private protocolClient: ProtocolClient,
    @inject("Config") private config: Config,
  ) {
  }

  async getByCid(cid: CidDomain): Promise<Hash | undefined> {
    return this.hashRepository.findOneByCid(cid.toString())
  }

  async find(cid: CidDomain): Promise<File[]> {

    const local = await this.hashRepository.findOneByCid(cid.toString());
    if (!local) {
      return [];
    }

    return local.files;
  }

  async deleteFromFs(path: string) {
    try {
      await fs.promises.unlink(path);
    } catch (e) {
      // ignore
      logger.error(e);
    }
  }

  async uniquePath(path: string, downloadPath: string = this.config.file.downloadDirPath): Promise<string> {
    const ext = fspath.extname(path);
    const filename = fspath.basename(path, ext);
    const pathWithName = fspath.join(downloadPath, filename);
    let fileExist = true;
    let uniqueIndex = 0;
    while (fileExist) {
      const modification = uniqueIndex > 0 ? ` (${uniqueIndex})` : '';
      const current = `${pathWithName}${modification}${ext}`
      if (fs.existsSync(current)) {
        uniqueIndex++;
      } else {
        fs.closeSync(fs.openSync(current, 'w'));
        return current;
      }
    }

    throw error(ErrorCode.ILLEGAL_STATE);
  }

  async createWriteStream(path: string, flag: 'w' | 'a'): Promise<fs.WriteStream> {
    if (flag == 'w') {
      await this.deleteFromFs(path);
    }
    return fs.createWriteStream(path, {flags: flag});
  }

  async syncSharedDirs() {
    const validDirs = await this.invalidateExistingDirs();

    for (const dir of validDirs) {
      const files = await this.traverseDir(dir.path);
      for (const filePath of files) {
        await this.fsToDb(filePath, dir);
      }
    }
  }

  public async traverseDir(dirPath: string): Promise<string[]> {
    let result: string[] = [];
    const files = await fsp.readdir(dirPath);
    for (const file of files) {
      let fullPath = path.join(dirPath, file);
      if (fs.lstatSync(fullPath).isDirectory()) {
        result = result.concat(result, await this.traverseDir(fullPath));
      } else {
        result.push(fullPath);
      }
    }

    return [...new Set(result)];
  }

  async addShareDir(dirsToShare: SharedDir[]): Promise<Directory[]> {
    const sharedDirs = await this.directoryRepository.findAllValid();
    const toSave = dirsToShare
      .filter(dir => sharedDirs.map(d => d.path).indexOf(dir.path) === -1)
      .map(dir => ({
        path: dir.path,
        advertisedPath: dir.advertisedPath,
      }));

    if (!toSave.length) {
      return sharedDirs;
    }
    return await this.directoryRepository.save(toSave);
  }

  /**
   * Check is directory and path is valid. Updates dir flag
   * @param dir to validate
   * @private true if valid
   */
  public async validateDirectory(dir: Directory): Promise<boolean> {
    try {
      const fsDir = (await fsp.lstat(dir.path))
      if (fsDir.isDirectory()) {
        return true;
      }
      console.error(`${dir.path} is not a directory`);
      dir.pathIsValid = false;
    } catch (e) {
      console.error(e);
      dir.pathIsValid = false;
    }
    return false;
  }

  public async validateFile(file: File): Promise<boolean> {
    try {
      const fsFile = await fsp.lstat(file.path);
      if (fsFile.isFile()) {
        return true;
      }
      console.error(`${file.path} is not a file`);
      file.pathIsValid = false;
    } catch (e) {
      console.error(e);
      file.pathIsValid = false;
    }
    return false;
  }

  public async fsToDb(filePath: string, dir: Directory): Promise<File | undefined> {
    const fileStat = await fsp.lstat(filePath);
    if (!fileStat.isFile()) {
      return undefined;
    }

    const toSave = await this.toModel(fileStat, filePath, dir);
    return await this.fileRepository.save(toSave);
  }

  public async publishFiles() {
    const files = await this.fileRepository.find({relations: ['hashes']});
    setTimeout(() => {
      (async () => {
        for (const file of files) {
          const hash = file.hashes[0];
          const cid = new CidDomain(hash.value, new CID(hash.cid))
          await this.protocolClient.provide(cid);
          logger.info(`published [${file.path}] \t\t\t${cid.toString()}`);
        }
      })();
    }, 2 * 1000);
  }

  private async invalidateExistingDirs(): Promise<Directory[]> {
    const dirs: Directory[] = await this.directoryRepository.findAllValid();
    for (const dir of dirs) {
      await this.validateDirectory(dir);
    }
    const validDirs = dirs.filter(dir => dir.pathIsValid);
    await this.fileRepository.clear();
    await this.directoryRepository.clear();
    await this.directoryRepository.save(validDirs);

    return validDirs;
  }

  private async toModel(fileStat: Stats, filePath: string, dir: Directory) {
    const bytes = await raw.encode(await fsp.readFile(filePath));
    const digest = await sha256.digest(bytes);
    const fileHash = new CID(1, raw.code, digest.bytes,);

    const extName = path.extname(filePath);
    const name = path.basename(filePath, extName);
    const cid = await new CidDomain(name).digest();

    const details = {
      size: fileStat.size,
      cid,
      path: filePath,
      extName,
      name,
      fileHash
    }

    const hash = this.hashRepository.create();
    hash.cid = details.cid.toString();
    hash.value = details.name;

    const type = await this.fileTypeService.type(details.path);
    const file = this.fileRepository.create();
    file.checksum = details.fileHash.toString();
    file.path = details.path;
    file.size = details.size;
    file.mime = type.mime;
    file.ext = type.ext;
    file.hashes = [hash];
    file.directory = dir;
    return file;
  }
}
