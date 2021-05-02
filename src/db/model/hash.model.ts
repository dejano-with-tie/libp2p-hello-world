import File from "./file.model";
import {Column, Entity, ManyToMany, PrimaryColumn} from "typeorm";
import Auditing from "./auditing.model";

// TODO: Change this to Tag
@Entity()
export default class Hash extends Auditing {

  @PrimaryColumn()
    // @ts-ignore
  value: string;

  @Column({nullable: false})
    // @ts-ignore
  cid: string;

  @ManyToMany(() => File, file => file.hashes, {eager: true})
    // @ts-ignore
  files: File[];

}
