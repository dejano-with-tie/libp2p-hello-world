import {AllowNull, AutoIncrement, Column, HasMany, Model, PrimaryKey, Table, Unique} from 'sequelize-typescript';
import Published from "./published.model";

@Table({
    timestamps: true
})
export default class File extends Model {

    @AutoIncrement
    @PrimaryKey
    @Column
        // @ts-ignore
    id: bigint

    @Unique
    @AllowNull(false)
    @Column({})
        // @ts-ignore
    path: string

    @AllowNull(false)
    @Column
        // @ts-ignore
    size: bigint

    @AllowNull(false)
    @Column
        // @ts-ignore
    mime: string

    @AllowNull(false)
    @Column
        // @ts-ignore
    hash: string

    @HasMany(() => Published)
        // @ts-ignore
    published: Published[]

}