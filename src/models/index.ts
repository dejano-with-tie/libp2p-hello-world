// const Sequelize = require('sequelize')

import {Sequelize} from "sequelize";
import path from "path";
import * as fs from "fs";
import File from './file.model';
import Published from './published.model';
import {isProd} from "../util";

function prepareSQLite() {
    let file = path.join(__dirname, '../../data.sqlite')
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '')
    }
    return `${file}`
}

const sequelize = new Sequelize({
    logging: !isProd() ? console.log : false,
    dialect: "sqlite",
    logQueryParameters: true,
    storage: prepareSQLite()
});

File.model(sequelize);
Published.model(sequelize);
const db = {
    File: File,
    Published: Published,
    sequelize: sequelize,
    Sequelize: Sequelize,
};

Object.keys(db).forEach(modelName => {
    if ((db as any)[modelName].associate) {
        (db as any)[modelName].associate(sequelize)
    }
});

(async () => {
    await sequelize.sync({force: !isProd()});
})();

export default db;