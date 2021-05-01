import {EntityRepository, Repository} from "typeorm";
import File from "../models/file.model";
import {FindManyOptions} from "typeorm/find-options/FindManyOptions";
import Directory from "../models/directory.model";

@EntityRepository(Directory)
export class DirectoryRepository extends Repository<Directory> {

  findAllValid(options?: FindManyOptions<Directory>): Promise<Directory[]> {
    return this.find({
      ...{
        where: {
          pathIsValid: true
        }
      }, ...options
    });
  }

}
