import {DataTypes, Model, Sequelize} from 'sequelize';

class Published extends Model {

    static model = (sequelize: Sequelize) => {
        return Published.init({
                cid: {
                    allowNull: false,
                    primaryKey: true,
                    type: DataTypes.STRING
                },
                value: {
                    allowNull: false,
                    unique: true,
                    type: DataTypes.STRING
                },
            },
            {
                sequelize,
                modelName: 'Published', timestamps: true, tableName: 'published', underscored: true
            }
        );
    }

    static associate = (sequelize: Sequelize) => {
        Published.belongsTo(sequelize.models.File, {
            onDelete: 'CASCADE',
            foreignKey: {
                allowNull: false
            }
        })
    }
}

export default Published;