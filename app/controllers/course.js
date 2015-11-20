'use strict';

const Joi   = require('joi');
const _     = require('lodash');
const Hoek  = require('hoek');
const Utils = require('../utils/sequelize');
const Path  = require('path');

const internals = {};

internals.checkCourse = function(Course, id, reply, callback) {

    Hoek.assert(Course, 'Model Course required');
    Hoek.assert(id, 'Course code required');
    Hoek.assert(callback, 'Callback required');
    Hoek.assert(reply, 'Reply interface required');

    Utils
        .findCourseByCode(Course, id)
        .then(result => {
            if (result) {
                return callback();
            } else {
                return reply.notFound('The course ' + id + ' does not exists.');
            }
        })
        .catch(err => reply.badImplementation(err));
};

internals.checkForbiddenPath = function(path) {
    return path.includes('/..') || path.includes('../');
};


exports.getAll = {
    description: 'List all the courses',
    handler: function (request, reply) {

        const Course = this.models.Course;

        const options = {
            limit: request.query.limit,
            offset: (request.query.page - 1) * request.query.limit
        };

        Course
            .findAndCountAll(options).then(results => {

            let promises = _.map(results.rows, (r => Utils.getCourse(r)));
            // Wait for all promises to end
            Promise
                .all(promises)
                .then(values => reply.paginate(values, results.count));

        })
        .catch(err => reply.badImplementation(err));
    }
};


exports.get = {
    description: 'Get info for one course',
    validate: {
        params: {
            id: Joi.string().required().description('Course code')
        }
    },
    handler: function (request, reply) {
        const Course = this.models.Course;
        const id = request.params.id;

        Utils.findCourseByCode(Course, id)
        .then(result => {
            if (result) // If found
            {

                Utils.getCourse(result).then(course => reply(course));
            }
            else // If not found
            {
                return reply.notFound('Cannot find course ' + id);
            }
        })
        .catch(err => reply.badImplementation(err));

    }
};


// WORKS - How to unit test this ?
exports.getDocuments = {
    description: 'Get a ZIP containing documents or a file',
    validate: {
        params: {
            id: Joi.string().required().description('Course code'),
            path: Joi.string().default('/')
        }
    },
    handler: function (request, reply) {

        const Storage = this.storage;
        const path = request.params.path;
        const course = request.params.id;

        Storage
        .download(course, path)
        .then((results) => {

            const isFile = results.isFile;
            const result = results.result;

            if (isFile)
            {
                return reply.file(result, { mode: 'attachment'});
            }
            else
            {
                const pathName = path === '/' ? '' : '_' + require('path').basename(path);
                const contentDisposition = 'attachment; filename=' + course + pathName + '.zip';
                return reply(result)
                    .type('application/zip')
                    .header('Content-Disposition', contentDisposition);
            }
        })
        .catch(() => reply.notFound('File not found'));
    }
};



exports.getTree = {
    description: 'Get course folder tree',
    validate: {
        options: {
            stripUnknown: true
        },
        params: {
            id: Joi.string().required().description('Course code'),
            path: Joi.string().default('/')
        },
        query: {
            recursive: Joi.boolean().default(true)
        }
    },
    handler: function (request, reply) {

        const path = request.params.path;

        if (internals.checkForbiddenPath(path)) {
            return reply.forbidden();
        }

        const Storage   = this.storage;
        const Course    = this.models.Course;
        const id        = request.params.id;
        const recursive = request.query.recursive

        const tree = function() {
            return reply(Storage.getTree(id, path, recursive));
        };

        return internals.checkCourse(Course, id, reply, tree);
    }
};


exports.getStudents = {
    description: 'Get students following the course',
    validate: {
        params: {
            id: Joi.string().required().description('Course code')
        }
    },
    handler: function (request, reply) {
        const Course = this.models.Course;

        Utils.findCourseByCode(Course, request.params.id)
        .then(course => {
            course
                .getUsers({joinTableAttributes: []})
                .then(users => reply(Utils.removeDates(users)));
        })
        .catch(err => reply.badImplementation(err));
    }
};


exports.post = {
    auth: {
        scope: ['admin', 'teacher']
    },
    description: 'Add a course',
    validate: {
        options: {
            stripUnknown: true
        },
        payload: {
            name: Joi.string().min(1).max(255).required().description('Course name'),
            code: Joi.string().min(1).max(255).required().description('Course code'),
            description: Joi.string().min(1).max(255).description('Course description'),
            teachers: Joi.array().items(Joi.string()).description('Teachers'),
            tags: Joi.array().items(Joi.string()).description('Tags')
        }
    },
    handler: function (request, reply) {

        const Course  = this.models.Course;
        const User    = this.models.User;
        const Tag     = this.models.Tag;
        const Storage = this.storage;

        const name        = request.payload.name;
        const code        = request.payload.code;
        const description = request.payload.description;
        const pteachers   = request.payload.teachers;
        const ptags       = request.payload.tags;

        const hasTeachers = pteachers ? true : false;
        const hasTags     = ptags ? true : false;

        const coursePayload = {
            name: name,
            code: code,
            description: description
        };

        // If tags has been passed to the payload, return a promise
        // loading the tags, otherwise return a promise returning an empty array
        const getTags = hasTags ?
            Promise.resolve(Tag.findAll(
                {where: {name: {$in: ptags}}}))
            : Promise.resolve([]);

        // If teachers has been passed to the payload, return a promise
        // loading the teachers, otherwise return a promise returning an empty array
        const userExclude = ['password'];
        const getTeachers = hasTeachers ?
            Promise.resolve(User.findAll(
                {where: {username: {$in: pteachers}},
                 attributes: {exclude: userExclude}}))
            : Promise.resolve([]);

        // Loads tags and teachers to be added
        Promise
        .all([getTags, getTeachers])
        .then(values => {

                const tags     = values[0];
                const teachers = values[1];

                const wrongTeachers = (hasTeachers && teachers.length !== pteachers.length);
                const wrongTags     = (hasTags && tags.length !== ptags.length);

                if (wrongTeachers || wrongTags)
                {
                    return reply.badData(wrongTeachers ? 'Invalid teachers(s)' : 'Invalid tag(s)');
                }
                else
                {
                    // TODO - Should refactor this somewhere else.
                    // Create course
                    Course
                    .create(coursePayload)
                    .then(newCourse => {

                        // Add teachers and tags to the new added course
                        Promise
                        .all([newCourse.addTeachers(teachers), newCourse.addTags(tags)])
                        .then(() => {

                            // Build response
                            const course = newCourse.get({plain:true});
                            course.tags = _.map(tags, (t => t.get('name', {plain:true})));
                            course.teachers = _.map(teachers, (t => t.get('username', {plain:true})));

                            Storage.createCourse(course.code);

                            return reply(course).code(201);
                        });
                    })
                    .catch(() => reply.conflict());
                }
            });
    }
};

exports.postDocument = {
    description: 'Upload a file to a course',
    payload: {
        maxBytes: process.env.UPLOAD_MAX,
        output: 'stream',
        allow: 'multipart/form-data',
        parse: true
    },
    validate: {
        params: {
            id: Joi.string().required().description('Course code'),
            path: Joi.string().default('/')
        }
    },
    handler: function (request, reply) {

        const file = request.payload.file;

        if (!file) {
            return reply.badRequest('File required to post a document');
        }

        const filename = file.hapi.filename;

        if (!filename) {
            return reply.badRequest('Filename required to post a document');
        }

        const path = Path.join(encodeURI(request.params.path), encodeURI(filename));

        // needs a better verification, but will do it for now.
        if (internals.checkForbiddenPath(path)) {
            return reply.forbidden();
        }

        const course = request.params.id;

        const Storage = this.storage;
        const Course = this.models.Course;

        const upload = function() {
            try {
                Storage.createOrReplaceFile(course, path, file);
                return reply('File : ' + filename + ' successfuly uploaded').code(201);
            } catch(err) {
                return reply.conflict(err);
            }
        };

        return internals.checkCourse(Course, course, reply, upload);
    }
};

exports.createFolder = {
    description: 'Create a folder to a course',
    validate: {
        params: {
            id: Joi.string().required().description('Course code'),
            path: Joi.string().required().invalid('/')
        }
    },
    handler: function (request, reply) {

        const Storage = this.storage;
        const Course  = this.models.Course;
        const course  = request.params.id;
        const path    = encodeURI(request.params.path);

        // needs a better verification, but will do it for now.
        if (internals.checkForbiddenPath(path)) {
            return reply.forbidden();
        }

        const createFolder = function() {
            Storage
                .createFolder(course, path)
                .then(() => reply('Folder : ' + Path.basename(path) + ' successfuly created').code(201))
                .catch(err => reply.badData(err));
        };

        return internals.checkCourse(Course, course, reply, createFolder);
    }
};

// Tags that does not exists will be ignored
exports.addTags = {
    description: 'Add a list of tags to the course',
    validate: {
        params: {
            id: Joi.string().required().description('Course code'),
        },
        payload: {
            tags: Joi.array().items(Joi.string().required())
        }
    },
    handler: function (request, reply) {

        const Tag    = this.models.Tag;
        const Course = this.models.Course;
        const id     = request.params.id;

        Tag
        .findAll({where: { name: { $in: request.payload.tags } }})
        .then(tags => {
            Utils.findCourseByCode(Course, request.params.id)
            .then(course => {
                if (course) {
                    course.addTags(tags).then(() => {
                       Utils.getCourse(course).then(result => {
                           return reply(result);
                       });
                    });
                } else {
                    return reply.notFound('The course ' + id + ' does not exists.');
                }
            });
        })
        .catch(reply.badImplementation);
    }
};

// Teachers that does not exists will be ignored
exports.addTeachers = {
    description: 'Add a list of teachers to the course',
    validate: {
        options: {
            stripUnknown: true
        },
        params: {
            id: Joi.string().required().description('Course code'),
        },
        payload: {
            teachers: Joi.array().items(Joi.string().required())
        }
    },
    handler: function (request, reply) {
        const User   = this.models.User;
        const Course = this.models.Course;
        const id     = request.params.id;

        User
        .findAll({where: { username: { $in: request.payload.teachers } }})
        .then(teachers => {
            Utils.findCourseByCode(Course, request.params.id)
            .then(course => {
                if (course) {
                    course.addTeachers(teachers).then(() => {
                        Utils.getCourse(course).then(result => {
                            return reply(result);
                        });
                    });
                } else {
                    return reply.notFound('The course ' + id + ' does not exists.');
                }
            });
        })
        .catch(err => reply.badImplementation(err));
    }
};


exports.patch = {
    description: 'Modify a course',
    validate: {
        options: {
            stripUnknown: true
        },
        params: {
            id: Joi.string().required().description('Course code')
        },
        payload: {
            name: Joi.string().min(1).max(255).description('Course name'),
            code: Joi.string().min(1).max(255).description('Course code'),
            description: Joi.string().min(1).max(255).description('Course description')
        }
    },
    handler: function (request, reply) {
        const Course  = this.models.Course;
        const id      = request.params.id;
        const newId   = request.payload.code;
        const Storage = this.storage;

        const renameFolder = function(returnValue) {
            Storage.renameCourse(id, newId)
                .then(() => reply(returnValue))
                .catch(err => reply.badImplementation(err));
        };

        Course
        .update(request.payload, { where: { code: { $eq: request.params.id } } })
        .then(values => {
            const toReturn = { count: values[0] };
            if (id && values[0] !== 0) {
                return renameFolder(toReturn);
            } else {
                return reply(toReturn);
            }

        })
        .catch(() => reply.conflict());
    }
};


exports.delete = {
    description: 'Delete a course',
    validate: {
        params: {
            id: Joi.string().required().description('Course code')
        }
    },
    handler: function (request, reply) {

        const Course = this.models.Course;
        const Storage = this.storage;

        Course.destroy({
            where : {
                code : { $eq: request.params.id }
            }
        })
        .then(count => {
            const tail = request.tail('Delete course folder');
            Storage.deleteCourse(request.params.id).then(tail);
            return reply({count: count});
        })
        .catch(err => reply.badImplementation(err));
    }
};

exports.deleteTags = {
    description: 'Delete a list of tags from the course',
    validate: {
        options: {
            stripUnknown: true
        },
        params: {
            id: Joi.string().required().description('Course code'),
        },
        payload: {
            tags: Joi.array().items(Joi.string().required())
        }
    },
    handler: function (request, reply) {

        const Tag    = this.models.Tag;
        const Course = this.models.Course;
        const ptags  = request.payload.tags;
        const id     = request.params.id;

        Tag
        .findAll({where: { name: { $in: ptags} }})
        .then(tags => {
            Utils.findCourseByCode(Course, id)
            .then(course => {
                if (course) {
                    course.removeTags(tags).then(() => {
                        Utils.getCourse(course).then(result => {
                            return reply(result);
                       });
                    });
                } else {
                    return reply.notFound('The course ' + id + 'does not exists.');
                }
            });
        })
        .catch(err => reply.badImplementation(err));
    }
};

exports.deleteTeachers = {
    description: 'Delete a list of teachers from the course',
    validate: {
        options: {
            stripUnknown: true
        },
        params: {
            id: Joi.string().required().description('Course code'),
        },
        payload: {
            teachers: Joi.array().items(Joi.string().required())
        }
    },
    handler: function (request, reply) {

        const User = this.models.User;
        const Course = this.models.Course;

        const pteachers = request.payload.teachers;
        const id = request.params.id;

        User
        .findAll({where: { username: { $in: pteachers } }})
        .then(teachers => {
            Utils.findCourseByCode(Course, id)
            .then(course => {
                if (course) {
                    course.removeTeachers(teachers).then(() => {
                        Utils.getCourse(course).then(result => {
                            return reply(result);
                        });
                    });
                } else {
                    return reply.notFound('The course ' + id + 'does not exists.');
                }
            });
        })
        .catch(err => reply.badImplementation(err));
    }
};


/**
 * When returning not found, files may already have been deleted.
 * Page reloading may be necessary !
 */
exports.deleteDocument = {
    description: 'Delete a document from a course',
    validate: {
        options: {
            stripUnknown: true
        },
        params: {
            id: Joi.string().required().description('Course code')
        },
        payload: {
            files: [Joi.string().required(), Joi.array().items(Joi.string().required())]
        }

    },
    handler: function (request, reply) {
        const Course  = this.models.Course;
        const Storage = this.storage;
        const id      = request.params.id;

        const files = request.payload.files;

        if (Array.isArray(files)) {
            _.forEach(files, (file => {
                if (internals.checkForbiddenPath(file)) {
                    reply.forbidden();
                }
            }));
        } else {
             if (internals.checkForbiddenPath(files)) {
                return reply.forbidden();
            }
        }

        const del = function() {
            Storage.delete(id, files)
                .then(() => reply().code(202))
                .catch(() => reply.badImplementation());
        };

        internals.checkCourse(Course, id, reply, del);
    }
};

