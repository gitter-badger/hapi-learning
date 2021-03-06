'use strict';

const Code = require('code');
const Lab = require('lab');
const fs = require('fs');
const Path = require('path');
const Hoek = require('hoek');
const lab = exports.lab = Lab.script();
const _  = require('lodash');


const describe = lab.describe;
const it = lab.it;
const before = lab.before;
const after = lab.after;
const expect = Code.expect;


let server;

const internals = {};

before((done) => {
    server = require('./server-test');
    const Models = server.plugins.models.models;
    Models.sequelize.sync({
        force: true
    }).then(() => {
        Models.Role.create({
            name: 'admin'
        }).then(() => {
             Models.User.create({
                username: 'admin',
                password: 'admin',
                role_id: 1,
                email: 'admin@admin.com',
                firstName: 'admin',
                lastName: 'admin'
            }).then(user => {
                    server.inject({
                        method: 'POST',
                        url: '/login',
                        payload: {
                            username: 'admin',
                            password: 'admin'
                        }
                    }, (res) => {
                        internals.headers = {
                            Authorization: res.request.response.source.token
                        };
                        done();
                    });
            });
        });

    });
});

after(done => {
    const rm = require('rmdir');
    rm(Path.join(__dirname, 'storage'), function() {
        done();
    });
});

const course = {
    name: 'Ateliers Logiciel 3e',
    code: 'ATL3',
    teachers: ['SRV', 'FPL'],
    tags: ['3e', 'Java']
};

const courses = [{
    name: 'Analyse 3e',
    code: 'ANL3',
    teachers: ['FPL'],
    tags: ['3e', 'Java']
}, {
    name: 'Analyse 2e',
    code: 'ANL2',
    teachers: ['FPL']
}];

const pRequest = {
    method: 'POST',
    url: '/courses',
    payload: course,
    headers: internals.headers
};


const users = [{
    username: 'SRV',
    email: 'invalid@email.com',
    password: 'superpassword'
}, {
    username: 'FPL',
    email: 'invalid2@email.com',
    password: 'superpassword'
}];

const moreUsers = [{
    username: 'ABS',
    email: 'invalid3@email.com',
    password: 'superpassword'
}, {
    username: 'ADT',
    email: 'invalid4@email.com',
    password: 'superpassword'
}];

const tags = [{
    name: '3e',
}, {
    name: 'Java'
}];

const moreTags = [{
    name: '2e'
}, {
    name: 'NodeJS'
}, {
    name: '1e'
}];

describe('Controller.Course', () => {
    describe('#post()', () => {

        it('should return 422 response because of invalid teachers/tags', done => {
            pRequest.headers = internals.headers;
            server.inject(pRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(422);

                fs.stat('storage/courses/ATL3', function(err, stats) {
                    expect(err).to.exists();
                    expect(stats).to.be.undefined();

                    done();
                });
            });
        });

        it('should return the new added course', done => {
            const Models = server.plugins.models.models;
            const User = Models.User;
            const Tag = Models.Tag;

            const createUsers = new Promise((resolve, reject) => {
                let promises = [];
                users.forEach(u => promises.push(User.create(u)));
                Promise.all(promises).then(resolve);
            });


            const createTags = new Promise((resolve, reject) => {
                let promises = [];
                tags.forEach(t => promises.push(Tag.create(t)));
                Promise.all(promises).then(resolve);
            });



            Promise.all([createTags, createUsers])
                .then(() => {
                    server.inject(pRequest, res => {
                        const response = res.request.response.source;

                        expect(response.name).to.equal(course.name);
                        expect(response.code).to.equal(course.code);
                        expect(response.teachers).to.be.an.array();
                        expect(response.teachers).to.have.length(pRequest.payload.teachers.length);
                        expect(response.teachers).to.only.include(pRequest.payload.teachers);

                        expect(response.tags).to.be.an.array();
                        expect(response.tags).to.have.length(pRequest.payload.tags.length);
                        expect(response.tags).to.only.include(pRequest.payload.tags);

                        fs.stat(Path.join(__dirname, 'storage/courses/ATL3'), function(err, stats) {

                            expect(err).to.be.null();
                            expect(stats).to.exists();
                            expect(stats.isDirectory()).to.be.true();

                            fs.stat(Path.join(__dirname, 'storage/courses/ATL3/documents'), function(err, stats) {
                                expect(err).to.be.null();
                                expect(stats).to.exists();
                                expect(stats.isDirectory()).to.be.true();
                                done();
                            });
                        });
                    });
                });
        });

        it('Should return a 409 conflict because resource already exists', done => {
             server.inject(pRequest, res => {
                const response = res.request.response.source;

                expect(response.statusCode).to.equal(409);

                done();
            });
        });

    });

    describe('#get', () => {
        it('Should return the course with tags and teachers', done => {
            const request = {
                method: 'GET',
                url: '/courses/ATL3',
                headers: internals.headers
            };

            server.inject(request, res => {
                const response = res.request.response.source;

                expect(response.code).to.equal(course.code);
                expect(response.name).to.equal(course.name);
                expect(response.teachers).to.be.an.array();
                expect(response.teachers).to.have.length(users.length);
                expect(response.tags).to.be.an.array();
                expect(response.tags).to.have.length(tags.length);
                done();
            });
        });

        it ('Should return 404 not found', done => {
            const request = {
                method: 'GET',
                url: '/courses/ABCDEF',
                headers: internals.headers
            };

            server.inject(request, res => {
                expect(res.request.response.statusCode).to.equal(404);
                done();
            });
        });

    });

    describe('#getAll', () => {
        it ('Should return 3 courses', done => {
            let post = {
                method: 'POST',
                url: '/courses',
                payload: courses[0],
                headers: internals.headers
            };

            const request = {
                method: 'GET',
                url: '/courses',
                headers: internals.headers
            };

            server.inject(post, () => {
                post.payload = courses[1];
                server.inject(post, () => {
                    server.inject(request, res => {
                        const response = res.request.response.source;
                        const meta = {
                            count: 3,
                            totalCount: 3,
                            pageCount: 1
                        };

                        expect(response.meta).to.deep.equal(meta);

                        expect(response.results).to.be.an.array();
                        expect(response.results).to.have.length(3);
                        done();
                    });
                });
            });
        });
    });

    describe('#delete', () => {
        const request = {
            method: 'DELETE',
            url: '/courses/ANL3'
        };
        it ('Should delete the course with 204', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response).to.not.exists();
                expect(res.request.response.statusCode).to.equal(204);

                // Not clean ...
                setTimeout(() => {
                    fs.stat(Path.join(__dirname, 'storage/courses/ANL3'), function(err, stats) {
                        expect(err).to.exists();
                        expect(stats).to.be.undefined();
                        done();
                    });
                }, 1000);
            });
        });

        it ('Should return 404 not found because deleted', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;
                expect(res.request.response.statusCode).to.equal(404);
                done();
            });
        });
    });

    describe('#getStudents', () => {
        const request = {
            method: 'GET',
            url: '/courses/ATL3/students'
        };

        it ('Should return empty array', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response).to.be.an.array();
                expect(response).to.have.length(0);
                done();
            });
        });

        it ('Should return an array with 1 user', done => {
            request.headers = internals.headers;
            const Course = server.plugins.models.models.Course;
            const user = {
                username: 'kevin2004',
                password: 'jsstrofor',
                firstName: 'Kevin',
                lastName: 'Keke',
                email: 'bogoss2004@hotmail.fr'
            };

            Course
                .findOne({where: { code: { $eq: 'ATL3'}}})
                .then(course => {
                    course.createUser(user)
                        .then(() => {
                            server.inject(request, res => {
                                const response = res.request.response.source;
                                expect(response).to.be.an.array();
                                expect(response).to.have.length(1);
                                done();
                            });
                    });
                });


        });
    });

   describe('#getNews', () => {
        const request = {
            method: 'GET',
            url: '/courses/ATL3/news?pagination=false'
        };

        it ('Should return empty array', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response).to.be.an.array();
                expect(response).to.have.length(0);
                done();
            });
        });

        it ('Should return an array with 1 news', done => {
            request.headers = internals.headers;
            const News = server.plugins.models.models.News;
            const news = {
                subject: 'news1',
                content: 'CONTENT1',
                course: 'ATL3',
                priority: 'danger',
                user: 'kevin2004'
            };

            News.create(news)
                .then(() => {
                    server.inject(request, res => {
                        const response = res.request.response.source;
                        expect(response).to.be.an.array();
                        expect(response).to.have.length(1);
                        done();
                    });
                });
            });

        it ('Should return an array with 3 news', done => {
            request.headers = internals.headers;
            const News = server.plugins.models.models.News;
            const news = [{
                subject: 'news2',
                content: 'CONTENT2',
                course: 'ATL3',
                priority: 'danger',
                user: 'kevin2004'
            },{
                subject: 'news3',
                content: 'CONTENT3',
                priority: 'warning',
                course: 'ATL3',
                user: 'kevin2004'
            }];

            const createNews = new Promise((resolve, reject) => {
                let promises = [];
                news.forEach(n => promises.push(News.create(n)));
                Promise.all(promises).then(resolve);
            });

            createNews.then(() => {
                    server.inject(request, res => {
                        const response = res.request.response.source;
                        expect(response).to.be.an.array();
                        expect(response).to.have.length(3);
                        done();
                    });
                });
            });
    });

    describe('#getTeachers', () => {
        const request = {
            method: 'GET',
            url: '/courses/ATL3/teachers'
        };

        it ('Should return 2 teachers', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response).to.be.an.array();
                expect(response).to.have.length(2);
                done();
            });
        });

        it ('Should return an array with 3 teachers', done => {
            request.headers = internals.headers;
            const Course = server.plugins.models.models.Course;
            const user = {
                username: 'julien2004',
                password: 'jsstrofor',
                firstName: 'Julien',
                lastName: 'Keke',
                email: 'bg2004@hotmail.fr',
                role: 2
            };

            Course
                .findOne({where: { code: { $eq: 'ATL3'}}})
                .then(course => {
                    course.createTeacher(user).then(() => {
                        server.inject(request, res => {
                            const response = res.request.response.source;
                            expect(response).to.be.an.array();
                            expect(response).to.have.length(3);
                            done();
                        });
                    });
                });


        });
    });


    describe('#getTags', () => {
        const request = {
            method: 'GET',
            url: '/courses/ATL3/tags'
        };

        it ('Should return an array with 2 tags', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response).to.be.an.array();
                expect(response).to.have.length(2);
                done();
            });
        });

        it ('Should return an array with 3 tags', done => {
            request.headers = internals.headers;
            const Course = server.plugins.models.models.Course;
            const tag = {
                name: 'labo'
            };

            Course
                .findOne({where: { code: { $eq: 'ATL3'}}}).then(course => {
                    course.createTag(tag)
                        .then(() => {
                            server.inject(request, res => {
                                const response = res.request.response.source;
                                expect(response).to.be.an.array();
                                expect(response).to.have.length(3);
                                done();
                            });
                    });
                });


        });
    });



    describe('#patch', () => {
        const request = {
            method: 'PATCH',
            url: '/courses/ATL3',
            payload: {
                name: 'Ateliers Logiciels Gestion',
                code: 'ATL3G'
            }
        };

        it ('Should return 404 not found', done => {

            const copyRequest = Hoek.applyToDefaults(request, {url : '/courses/ABCD'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {

                expect(res.request.response.statusCode).to.equal(404);

                done();
            });
        });

        it ('Should return 204 no content', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                const response = res.request.response.source;

                expect(res.request.response.statusCode).to.equal(204);

                fs.stat(Path.join(__dirname, 'storage/courses/ATL3G'), function(err, stats) {
                    expect(err).to.be.null();
                    expect(stats).to.exists();
                    expect(stats.isDirectory()).to.be.true();

                    fs.stat(Path.join(__dirname, 'storage/courses/ATL3'), function(err, stats) {
                        expect(err).to.exists();
                        expect(stats).to.be.undefined();
                        done();
                    });
                });
            });
        });

        it ('Should return the updated course', done => {
            server.inject({method: 'GET', url:'/courses/ATL3G', headers: internals.headers}, res => {
                const response = res.request.response.source;

                expect(response.code).to.equal(request.payload.code);
                expect(response.name).to.equal(request.payload.name);
                expect(response.teachers).to.be.an.array();
                expect(response.teachers).to.have.length(users.length + 1);
                expect(response.tags).to.be.an.array();
                expect(response.tags).to.have.length(tags.length + 1);

                done();
            });
        });
    });

    describe('#addTags', () => {

        const request = {
            method: 'POST',
            url: '/courses/ATL3G/tags',
            payload: {
                tags: ['2e', 'NodeJS', '1e', '4e'] // 3 existing tags and 1 non existing
            }
        };

        it('Should return the course with the new tags', done => {
            const Models = server.plugins.models.models;
            const Tag = Models.Tag;
            request.headers = internals.headers;
            const createTags = new Promise((resolve, reject) => {
                let promises = [];
                moreTags.forEach(t => promises.push(Tag.create(t)));
                Promise.all(promises).then(resolve);
            });

            createTags.then(() => {
                server.inject(request, res => {
                    const response = res.request.response.source;

                    const allTags = ['3e', 'Java', '2e', 'labo', 'NodeJS', '1e'];
                    expect(response.tags).to.only.include(allTags);
                    done();
                });
            });
        });

        it('Should return 404 course not found', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/tags'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(404);
                done();
            });
        });

        it ('Should return 400 bad request (validation error)', done => {

            const copyRequest = Hoek.applyToDefaults(request, { payload: { tags: '3e', teachers: '3e'}});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response;
                expect(response.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('#addTeachers', () => {



        const request = {
            method: 'POST',
            url: '/courses/ATL3G/teachers',
            payload: {
                teachers: ['ABS', 'ADT', 'JLC']
            }
        };

        it('Should return the course with the new teachers', done => {
            const Models = server.plugins.models.models;
            const User = Models.User;
            request.headers = internals.headers;
            const createTeachers = new Promise((resolve, reject) => {
                let promises = [];
                moreUsers.forEach(t => promises.push(User.create(t)));
                Promise.all(promises).then(resolve);
            });

            createTeachers
            .then(() => {
                server.inject(request, res => {
                    const response = res.request.response.source;

                    const allTeachers = ['SRV', 'FPL', 'julien2004', 'ABS', 'ADT'];

                    const usernames = _.map(response.teachers, (t => t.username));

                    expect(usernames).to.only.include(allTeachers);
                    done();
                });
            });
        });

        it('Should return 404 course not found', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/teachers'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(404);
                done();
            });
        });

        it ('Should return 400 bad request (validation error)', done => {

            const copyRequest = Hoek.applyToDefaults(request, { payload: { teachers: 'ABS'}});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('#deleteTags', () => {

        const request = {
            method: 'DELETE',
            url: '/courses/ATL3G/tags',
            payload: {
                tags: ['2e', 'NodeJS', '1e', '4e'] // 3 existing tags and 1 non existing
            }
        };

        it('Should return 204 no content (ok)', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                expect(res.request.response.statusCode).to.equal(204);
                done();
            });
        });

        it('Should return 404 course not found', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/tags'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).to.equal(404);
                done();
            });
        });

        it ('Should return 400 bad request (validation error)', done => {

            const copyRequest = Hoek.applyToDefaults(request, { payload: { tags: '3e'}});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('#removeTeachers', () => {


        const request = {
            method: 'DELETE',
            url: '/courses/ATL3G/teachers',
            payload: {
                teachers: ['ABS', 'ADT', 'JLC']
            }
        };

        it('Should return 204 no content', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                expect(res.request.response.statusCode).to.equal(204);
                done();
            });
        });

        it('Should return 404 course not found', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/teachers'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(404);
                done();
            });
        });

        it ('Should return 400 bad request (validation error)', done => {

            const copyRequest = Hoek.applyToDefaults(request, { payload: { teachers: 'ABS'}});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(400);
                done();
            });
        });
    });

    describe('#createFolder', () => {
        const request = {
            method: 'POST',
            url: '/courses/ATL3G/folders/subfolder'
        };

        it ('Should return 404 course not found', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/folders/subfolder'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(404);
                done();
            });

        });

        it ('Should return 400 bad request (validation error)', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/folders/'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(400);
                done();
            });
        });

        it ('Should return 400 bad request (validation error) - bis', done => {

            const copyRequest = Hoek.applyToDefaults(request, { url: '/courses/ATL/folders//'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                const response = res.request.response.source;
                expect(response.statusCode).to.equal(400);
                done();
            });
        });

        it ('Should return 201 created and create the folder', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                expect(res.request.response.statusCode).equal(201);

                fs.stat(Path.join(__dirname, 'storage/courses/ATL3G/documents/subfolder'),
                        (err, stats) => {

                    expect(err).to.be.null();
                    expect(stats).to.exists();
                    expect(stats.isDirectory()).to.be.true();

                    done();
                });
            });
        });

        it ('Should return 409 (bad data -- invalid path)', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                expect(res.request.response.statusCode).equal(409);
                done();
            });
        });

        it ('Should return 422 (bad data -- invalid path)', done => {

            const copyRequest = Hoek.applyToDefaults(request, {
                url: '/courses/ATL3G/folders/folder/folderbis'
            });

            copyRequest.headers = internals.headers;

            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).equal(422);
                fs.stat(Path.join(__dirname, 'storage/courses/ATL3G/documents/folder/folderbis'),
                        (err, stats) => {

                    expect(err).to.exists();
                    expect(stats).to.be.undefined();
                    done();
                });
            });
        });

        it ('Should return 400 invalid path', done => {

            const copyRequest = Hoek.applyToDefaults(request, {
                url: '/courses/ATL3G/folders/../../ANL3/documents/folder'
            });
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).equal(400);
                done();
            });
        });
    });

    describe('#postDocument', () => {
        const FormData = require('form-data');
        const streamToPromise = require('stream-to-promise');



        it ('Should return 201 created', done => {
            const form = new FormData();

            const headers = form.getHeaders();
            headers.Authorization = internals.headers.Authorization;

            form.append('file', fs.createReadStream(Path.join(__dirname, 'server-test.js')));
            streamToPromise(form).then(payload => {
                server.inject({
                    method: 'POST',
                    url: '/courses/ATL3G/documents',
                    payload: payload,
                    headers: headers
                }, res => {
                    expect(res.request.response.statusCode).to.equal(201);
                    const path = Path.join(__dirname, 'storage/courses/ATL3G/documents/server-test.js');
                    fs.stat(path, function(err, stats) {
                        expect(err).to.be.null();
                        expect(stats).to.exists();
                        expect(stats.isFile()).to.be.true();

                        const content = fs.readFileSync(path);
                        const originalContent = fs.readFileSync(Path.join(__dirname, 'server-test.js'));
                        expect(content.length).to.equal(originalContent.length);
                        expect(content.equals(originalContent)).to.be.true();

                        done();
                    });
                });
            });
        });

        it ('Should return 404 not found', done => {

            const form = new FormData();

            const headers = form.getHeaders();
            headers.Authorization = internals.headers.Authorization;

            form.append('file', fs.createReadStream(Path.join(__dirname, 'server-test.js')));
             streamToPromise(form).then(payload => {
                server.inject({
                    method: 'POST',
                    url: '/courses/ATL/documents',
                    payload: payload,
                    headers: headers
                }, res => {
                    const response = res.request.response.source;
                    expect(response.statusCode).to.equal(404);
                    done();
                });
            });
        });

        it ('Should return 400 bad request -- missing file', done => {
            const form = new FormData();

            const headers = form.getHeaders();
            headers.Authorization = internals.headers.Authorization;

            form.append('wrongFile', fs.createReadStream(Path.join(__dirname, 'courses-test.js')));
             streamToPromise(form).then(payload => {
                server.inject({
                    method: 'POST',
                    url: '/courses/ATL3G/documents',
                    payload: payload,
                    headers: headers
                }, res => {
                    const response = res.request.response.source;
                    expect(response.statusCode).to.equal(400);
                    done();
                });
            });
        });

        it ('Should return 400 invalid path', done => {
            const form = new FormData();

            const headers = form.getHeaders();
            headers.Authorization = internals.headers.Authorization;

            form.append('file', fs.createReadStream(Path.join(__dirname, 'server-test.js')));
             streamToPromise(form).then(payload => {
                server.inject({
                    method: 'POST',
                    url: '/courses/ATL3G/documents/../../ANL3/documents',
                    payload: payload,
                    headers: headers
                }, res => {
                    const response = res.request.response.source;
                    expect(response.statusCode).to.equal(400);
                    done();
                });
            });
        });
    });

    describe('#updateFolder', () => {
        it ('Should rename the folder', done => {

            const request = {
                method: 'PATCH',
                url: '/courses/ATL3G/folders/subfolder',
                payload: {
                    name: 'subfolderrenamed'
                },
                headers: internals.headers
            };

            server.inject(request, res => {
                expect(res.request.response.statusCode).equal(200);

                fs.stat(Path.join(__dirname, 'storage/courses/ATL3G/documents/subfolderrenamed'),
                        (err, stats) => {

                    expect(err).to.be.null();
                    expect(stats).to.exists();
                    expect(stats.isDirectory()).to.be.true();

                    done();
                });
            });
        })
    });

    describe('#getTree', () => {

        const stat = fs.statSync(Path.join(__dirname, 'server-test.js'));

        it ('Should return the correct tree', done => {

            const request = {
                method: 'GET',
                url: '/courses/ATL3G/tree',
                headers: internals.headers
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(res.request.response.statusCode).to.equal(200);
                expect(response.dir).to.be.null();

                const files = response.files;

                expect(files).to.be.an.array();
                expect(files).to.have.length(2);

                expect(files[0].directory).to.equal('/');
                expect(files[0].name).to.equal('subfolderrenamed');
                expect(files[0].type).to.equal('d');
                expect(files[0].size).to.be.null();
                expect(files[0].ext).to.be.null();

                expect(files[1].directory).to.equal('/');
                expect(files[1].name).to.equal('server-test.js');
                expect(files[1].ext).to.equal('.js');
                expect(files[1].type).to.equal('f');
                expect(files[1].size).to.be.a.number();


                done();
            });
        });

    });

    describe('#deleteDocument', () => {

        const request = {
            method: 'DELETE',
            url: '/courses/ATL3G/documents',
            payload: {
                files: 'server-test.js'
            }
        };

        it ('Should return 403 forbidden path', done => {
            const copyRequest = Hoek.applyToDefaults(request, {
                payload : { files: '../../ANL3/documents/server-test.js' }
            });
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).to.equal(403);
                done();
            });
        });

        it ('Should return 404 not found', done => {
            const copyRequest = Hoek.applyToDefaults(request, {url : '/courses/ATL/documents'});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).to.equal(404);
                done();
            });
        });

        it ('Should return 400 bad validation', done => {
            const copyRequest = Hoek.applyToDefaults(request, {payload : []});
            copyRequest.headers = internals.headers;
            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).to.equal(400);
                done();
            });
        });

        it ('Should return 202 accepted and file deleted', done => {
            request.headers = internals.headers;
            server.inject(request, res => {
                expect(res.request.response.statusCode).to.equal(202);
                const path = Path.join(__dirname, 'storage/courses/ATL3G/documents/server-test.js');
                fs.stat(path, (err, stats) => {
                    expect(err).to.exists();
                    expect(stats).to.be.undefined();
                    done();
                });
            });
        });

        it ('Should return 202 accepted and ignore non existing files', done => {

            const copyRequest = Hoek.applyToDefaults(request, {
                payload: {
                    files: ['server-test.js', 'subfolder']
                }
            });

            copyRequest.headers = internals.headers;

            server.inject(copyRequest, res => {
                expect(res.request.response.statusCode).to.equal(202);
                const path = Path.join(__dirname, 'storage/courses/ATL3G/documents/subfolder');
                fs.stat(path, (err, stats) => {
                    expect(err).to.exists();
                    expect(stats).to.be.undefined();
                    done();
                });
            });
        });

    });

});
