import {EntityRepository, Repository} from "typeorm";
import {FindManyOptions} from "typeorm/find-options/FindManyOptions";
import Directory from "../model/directory.model";

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
