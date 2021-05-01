// @ts-nocheck
import {Column, Entity, PrimaryGeneratedColumn,} from "typeorm";
import Auditing from "./auditing.model";

export enum DownloadStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  PAUSED = "PAUSED",
  COMPLETED_UNVERIFIED = "COMPLETED_UNVERIFIED",
  COMPLETED = "COMPLETED",
  COMPLETED_INTEGRITY_FAILED = "COMPLETED_INTEGRITY_FAILED",
  FAILED = "FAILED",
  DELETED = "DELETED",
}

@Entity()
// @Unique(["remoteFileId", "remotePeerId"])
export default class Download extends Auditing {

// TODO: It would be a good idea to add cid here in case remote peer unpublished
  @PrimaryGeneratedColumn()
  id: number;

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
    default: 0
  })
  offset: number

  @Column({
    nullable: false,
    type: 'text',
    default: DownloadStatus.PENDING
  })
  status: DownloadStatus

  @Column({
    nullable: false,
    // FIXME: Config + filename
    default: '/home/dejano/Projects/libp2p-hello-world/1.dat'
  })
  downloadPath: string

  public inProgress() {
    this.status = DownloadStatus.IN_PROGRESS;
  }

  public progress() {
    return Math.floor((this.offset / this.remoteFileSize) * 100)
  }
}
