import {EntityRepository, Repository} from "typeorm";
import File from "../models/file.model";
import {FindManyOptions} from "typeorm/find-options/FindManyOptions";

@EntityRepository(File)
export class FileRepository extends Repository<File> {

    findAllValid(options?: FindManyOptions<File>): Promise<File[]> {
        return this.find({...{where: {
            pathIsValid: true
        }}, ...options});
    }

    findOneByChecksum(checksum: string): Promise<File | undefined> {
        return this.findOne({checksum});
    }

    findOneByPath(path: string): Promise<File | undefined> {
        return this.findOne({path});
    }

}