import Hash from "./hash.model";
import {Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import Auditing from "./auditing.model";
import * as domain from '../domain/file.domain';
import {PeerDomain} from "../domain/libp2p.domain";

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
  checksum: string

  @ManyToMany(() => Hash, hash => hash.files, {cascade: true})
  @JoinTable()
    // @ts-ignore
  hashes: Hash[];

  public toDomain(provider: PeerDomain) {
    return new domain.FileDomain(this.id, this.path, this.checksum, this.size, this.mime, this.createdAt.toString(), this.updatedAt.toString(), provider);
  }
}
