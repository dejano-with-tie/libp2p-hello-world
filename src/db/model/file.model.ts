import Hash from "./hash.model";
import {Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import Auditing from "./auditing.model";
import Directory from "./directory.model";
import path from "path";

@Entity()
export default class File extends Auditing {

  @PrimaryGeneratedColumn()
    // @ts-ignore
  id: number

  @Column({nullable: false, unique: true})
    // @ts-ignore
  path: string

  @Column({nullable: false, default: true})
    // @ts-ignore
  pathIsValid: boolean

  @Column({nullable: false})
    // @ts-ignore
  size: number

  @Column({nullable: false})
    // @ts-ignore
  mime: string

  @Column({nullable: false})
    // @ts-ignore
  ext: string

  @Column({nullable: false})
    // @ts-ignore
  checksum: string

  @ManyToOne(() => Directory, directory => directory.files, {eager: true})
    // @ts-ignore
  directory: Directory;

  @ManyToMany(() => Hash, hash => hash.files, {cascade: true})
  @JoinTable()
    // @ts-ignore
  hashes: Hash[];

  public isHealthy(): boolean {
    return this.pathIsValid;
  }

  public advertisedPath() {
    const pathWithoutSharedDir = path.relative(this.directory.path, this.path);
    return path.join(this.directory.advertisedPath, pathWithoutSharedDir)
  }
}
