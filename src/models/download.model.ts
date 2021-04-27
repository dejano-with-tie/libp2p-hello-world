// @ts-nocheck
import {Column, Entity, PrimaryGeneratedColumn,} from "typeorm";
import Auditing from "./auditing.model";
import {PeerDomain} from "../domain/libp2p.domain";
import {DownloadDomain} from "../domain/download.domain";
import {FileDomain} from "../domain/file.domain";
import PeerId from "peer-id";
import {DownloadStatusDomain} from "../domain/download-status.domain";

export enum DownloadStatus {
  PENDING,
  INTEGRITY_VALID,
  INTEGRITY_FAILED,
  InProgress,
  Paused,
  Stopped,
  Failed,
  CompletedUnverified,
  COMPLETED,
  CompletedInvalid
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
  progress: number

  @Column({
    nullable: false,
    type: 'int',
    default: DownloadStatus.PENDING
  })
  status: DownloadStatus

  @Column({
    nullable: false,
    // FIXME: Config + filename
    default: '/home/dejano/Projects/libp2p-hello-world/1.dat'
  })
  downloadPath: string

  public integrityIsValid() {
    this.status = DownloadStatus.INTEGRITY_VALID;
  }
}
