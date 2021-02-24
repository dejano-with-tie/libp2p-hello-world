import File from "./file.model";
import {Column, CreateDateColumn, Entity, ManyToMany, PrimaryColumn, UpdateDateColumn} from "typeorm";

// TODO: Change this to Tag
@Entity()
export default class Hash {

    @PrimaryColumn()
        // @ts-ignore
    value: string;

    @Column({nullable: false})
        // @ts-ignore
    cid: string;

    @ManyToMany(() => File, file => file.hashes, {eager: true})
        // @ts-ignore
    files: File[];

    @CreateDateColumn()
        // @ts-ignore
    createdAt: Date;

    @UpdateDateColumn()
        // @ts-ignore
    updatedAt: Date;
}
