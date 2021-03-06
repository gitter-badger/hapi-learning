'use strict';


module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Course', {
        name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
            field: 'name'
        },
        code: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
            field: 'code'
        }
    }, {
        paranoid: true,
        tableName: 'courses',
        underscored: true
    });
};
