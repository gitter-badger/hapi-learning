'use strict';

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();

const describe = lab.describe;
const it = lab.it;
const before = lab.before;
const after = lab.after;
const expect = Code.expect;

const server = require('./server-test');

before((done) => {
    const Models = server.plugins.models.models;
    Models.sequelize.sync({
        force: true
    }).then(() => done());
});

const badUser = {
    username: '',
    email: 'invisible@email.com',
    password: 'superpassword'
};

const badUsers = [{
    username: 'SRV',
    email: '',
    password: 'superpassword'
}, {
    username: 'FPL',
    email: 'pluquos@hotmail.com',
    password: 'superpassword'
}];

const user = {
    username: 'Johnny',
    email: 'Bogoss42@gmail.com',
    password: 'ImPosay',
    phoneNumber: '+32484283748'
};

const users = [{
    username: 'SRV',
    email: 'SRV@caramail.com',
    password: 'superpassword'
}, {
    username: 'FPL',
    email: 'pluquos@hotmail.com',
    password: 'superpassword'
}];

describe('Controller.User', () => {
    describe('#post', () => {
        it('Should return 400 response because of invalid username', done => {
            const request = {
                method: 'POST',
                url: '/users',
                payload : badUser
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response.statusCode).equal(400);
                done();
            });
        });
        it('Should return 400 response because of one invalid email in array', done => {
            const request = {
                method: 'POST',
                url: '/users',
                payload : badUsers
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response.statusCode).equal(400);
                done();
            });
        });
        it('Should return the created user', done => {
            const request = {
                method: 'POST',
                url: '/users',
                payload : user
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(res.request.response.statusCode).equal(201);
                expect(response.username).equal(user.username);
                expect(response.email).equal(user.email);
                expect(response.password).not.equal(user.password);
                expect(response.phoneNumber).equal(user.phoneNumber);

                done();
            });
        });
        it('Should return 409 because user already exist', done => {
            const request = {
                method: 'POST',
                url: '/users',
                payload : user
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response.statusCode).equal(409);

                done();
            });
        });     
        it('Should return number of created users from array', done => {
            const request = {
                method: 'POST',
                url: '/users',
                payload : users
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(res.request.response.statusCode).equal(201);
                expect(response.count).equal(2);
                done();
            });
        });
    });
    describe('#get', () => {
        it('Should return 404 not found', done => {
            const request = {
                method: 'GET',
                url: '/users/IWillProbablyDoNotExist'
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response.statusCode).equal(404);
                done();
            });
        });
        it('Should return specified user', done => {
            const request = {
                method: 'GET',
                url: '/users/FPL'
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response.username).equal('FPL');
                expect(response.email).equal('pluquos@hotmail.com');
                done();
            });
        });
    });

    describe('#getAll', () => {
        it ('Should return 3 users', done => {
            
            const request = {
                method: 'GET',
                url: '/users'
            };

            server.inject(request, res => {
                const response = res.request.response.source;
                expect(response).to.be.an.array();
                expect(response).to.have.length(3);
                done();
            });
        });
    });

});
