import {createConnection, getCustomRepository} from "typeorm";
import {Connection} from "typeorm/connection/Connection";
import {FileRepository} from "../repository/file.repository";
import {HashRepository} from "../repository/hash.repository";
import {DownloadRepository} from "../repository/download.repository";
import {container} from "tsyringe";

export class Db {
  public fileRepository: FileRepository;
  public hashRepository: HashRepository;
  public downloadRepository: DownloadRepository;
  private conn: Connection;
  private path: string;

  private constructor(path: string, conn: Connection) {
    this.path = path;
    this.conn = conn;
    this.fileRepository = getCustomRepository(FileRepository, conn.name);
    this.hashRepository = getCustomRepository(HashRepository, conn.name);
    this.downloadRepository = getCustomRepository(DownloadRepository, conn.name);
    container.register<FileRepository>(FileRepository, {useValue: this.fileRepository});
    container.register<HashRepository>(HashRepository, {useValue: this.hashRepository});
    container.register<DownloadRepository>(DownloadRepository, {useValue: this.downloadRepository});
  }

  public static async createAndConnect(path: string) {
    const conn = await createConnection({
      type: 'sqlite',
      name: path,
      database: path,
      entities: [
        __dirname + '/*.ts'
      ],
      synchronize: true
    });
    return new Db(path, conn);
  }
}
