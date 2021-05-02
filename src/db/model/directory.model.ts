import {Column, Entity, JoinTable, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import Auditing from "./auditing.model";
import File from "./file.model";

@Entity()
export default class Directory extends Auditing {

  @PrimaryGeneratedColumn()
    // @ts-ignore
  id: number

  @Column({nullable: false, unique: true})
    // @ts-ignore
  path: string

  @Column({nullable: false, default: true})
    // @ts-ignore
  pathIsValid: boolean

  @Column({nullable: false, unique: true})
    // @ts-ignore
  advertisedPath: string

  @OneToMany(() => File, file => file.directory, {cascade: true})
  @JoinTable()
    // @ts-ignore
  files: File[];

}
