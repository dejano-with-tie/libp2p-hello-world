import {createConnection, getCustomRepository} from "typeorm";
import {Connection} from "typeorm/connection/Connection";
import {FileRepository} from "../repository/file.repository";
import {HashRepository} from "../repository/hash.repository";

export class Db {
    public fileRepository: FileRepository;
    public hashRepository: HashRepository;
    private conn: Connection;
    private path: string;

    private constructor(path: string, conn: Connection) {
        this.path = path;
        this.conn = conn;
        this.fileRepository = getCustomRepository(FileRepository, conn.name);
        this.hashRepository = getCustomRepository(HashRepository, conn.name);
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
        const db = new Db(path, conn);
        return db;
    }
}