import {DataTypes, Model, Sequelize} from 'sequelize';

// TODO: Missing props, investigate how to do this properly
class File extends Model {

    static model = (sequelize: Sequelize) => {
        return File.init({
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: DataTypes.BIGINT
                },
                path: {
                    allowNull: false,
                    unique: true,
                    type: DataTypes.STRING
                },
                size: {
                    type: DataTypes.BIGINT,
                    allowNull: false,
                },
                mime: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                hash: {
                    type: DataTypes.STRING,
                    allowNull: false,
                }
            },
            {
                sequelize,
                modelName: 'File', timestamps: true, tableName: 'file', underscored: true
            }
        );
    }

    static associate = (sequelize: Sequelize) => {
        File.hasMany(sequelize.models.Published, {
            foreignKey: 'file_id'
        })
    }
}

export default File;