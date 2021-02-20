import {AllowNull, BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table, Unique} from 'sequelize-typescript';
import File from "./file.model";

@Table({
    timestamps: true
})
export default class Published extends Model {

    @PrimaryKey
    @AllowNull(false)
    @Column
        // @ts-ignore
    cid: string;

    @AllowNull(false)
    @Unique
    @Column
        // @ts-ignore
    value: string;


    @ForeignKey(() => File)
    @AllowNull(false)
    @Column
        // @ts-ignore
    fileId: number

    @BelongsTo(() => File)
        // @ts-ignore
    file: File
}
