import {EntityRepository, Repository} from "typeorm";
import Hash from "../model/hash.model";
import {FindManyOptions} from "typeorm/find-options/FindManyOptions";

@EntityRepository(Hash)
export class HashRepository extends Repository<Hash> {

  findOneByCid(cid: string, options?: FindManyOptions<Hash>): Promise<Hash | undefined> {
    return this.findOne({
      ...{
        where: (qb: any) => {
          qb.where({cid}).andWhere('Hash_files.pathIsValid = true');
        }
      }, ...options
    });
  }
}
