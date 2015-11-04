'use strict';

const Sequelize = require('sequelize');
const Fs        = require('fs');
const Path      = require('path');
const _         = require('lodash');

exports.register = function(server, options, next) {
    let models = {};
    const sequelize = new Sequelize(
    options.name || null,
    options.username || null,
    options.password || null, {
        host: options.host || null,
        dialect: options.dialect || null,
        storage: options.storage || null,
        logging: options.logging
    });

    models.sequelize = sequelize;

    const files = Fs.readdirSync(__dirname);

    _.forEach(files, (file) => {
        if (file !== Path.basename(__filename)) {
            const model = Path.basename(file, '.js');

            const name = model.charAt(0).toUpperCase() + model.slice(1);

            models[name] = sequelize.import(model);
        }
    });

    (function setAssociations(m) {

        // A Course has multiple Tags to describe him
        m.Course.belongsToMany(m.Tag, { through: 'course_tags' });

        // A Course can have multiple Users as Titulars
        m.Course.belongsToMany(m.User, { as: 'Titulars',  through: 'course_titulars'});

        // An User can subscribe to many Courses (not in a Folder)
        m.User.belongsToMany(m.Course, { as: 'Courses', through: 'user_courses' });

        // An User can create many Folders containing Courses
        m.User.belongsToMany(m.Folder, { through: 'user_folders'});

        // A Folder contains many Courses
        m.Folder.belongsToMany(m.Course, { through: 'user_courses_folders'});

        // An User can have multiple Tags (for example 'A12' + 'gestion')
        m.User.belongsToMany(m.Tag, { through: 'user_tags' });

        // A Role can have multiple Permissions
        m.Role.belongsToMany(m.Permission, { through: 'role_permissions' });

        // A User has a Role
        m.User.belongsTo(m.Role);

        // A user can have specifics additional permissions.
        m.User.belongsToMany(m.Permission, { through: 'user_permissions' });

    })(models);


    server.expose('models', models);

    next();

};

exports.register.attributes = {
    name: 'models',
    version: require('../../package.json').version
};

