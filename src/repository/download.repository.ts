import {EntityRepository, Repository} from "typeorm";
import Download from "../models/download.model";

@EntityRepository(Download)
export class DownloadRepository extends Repository<Download> {

}