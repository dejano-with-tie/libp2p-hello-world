// @ts-nocheck
import {CreateDateColumn, UpdateDateColumn} from "typeorm";

export default abstract class Auditing {

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}