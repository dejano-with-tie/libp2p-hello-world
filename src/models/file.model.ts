import Hash from "./hash.model";
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";

@Entity()
export default class File {

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

    @CreateDateColumn()
        // @ts-ignore
    createdAt: Date;

    @UpdateDateColumn()
        // @ts-ignore
    updatedAt: Date;

    @ManyToMany(() => Hash, hash => hash.files, {cascade: true})
    @JoinTable()
        // @ts-ignore
    hashes: Hash[];

}