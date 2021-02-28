// @ts-nocheck
import {Column, Entity, PrimaryGeneratedColumn, Unique,} from "typeorm";
import Auditing from "./auditing.model";

export enum DownloadStatus {
    InProgress,
    Paused,
    Stopped,
    Failed,
    CompletedUnverified,
    CompletedValid,
    CompletedInvalid
}

@Entity()
// @Unique(["remoteFileId", "remotePeerId"])
export default class Download extends Auditing {

    @PrimaryGeneratedColumn()
    id: string;

    @Column({nullable: false})
    remoteFileId: number;

    @Column({nullable: false})
    remotePeerId: string

    @Column({nullable: false})
    remoteFileSize: number

    @Column({nullable: false})
    remoteFileChecksum: string

    @Column({
        nullable: false,
        type: 'int',
        default: DownloadStatus.InProgress
    })
    status: DownloadStatus

    @Column({nullable: false})
    downloadPath: string

}