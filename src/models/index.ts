import {Sequelize} from "sequelize-typescript";
import {isProd} from "../util";

export class Db {
    private sequelize: Sequelize;

    constructor(url: string) {
        this.sequelize = new Sequelize(url, {
            logging: !isProd() ? console.log : false,
            logQueryParameters: true,
            models: [__dirname + '/*.model.ts']
        });
    }

    async createAndConnect() {
        await this.sequelize.sync({force: !isProd()});
        await this.sequelize.authenticate();
    }
}