'use strict';

const Hapi = require('hapi');
const server = new Hapi.Server();


// Permissions for a user
const permissions = [{
    name: 'A',
    acl: ['C', 'R']
}, {
    name: 'B',
    acl: ['R', 'U']
}, {
    name: 'C',
    acl: ['C', 'R', 'U', 'D']
}, {
    name: 'D',
    acl: ['D']
}, {
    name: 'E',
    acl: ['U', 'C']
}];




server.connection();
server.route([{
    method: 'GET',
    path: '/A',
    config: {
        plugins: {
            permissions: [{
                name: 'A',
                acl: ['C', 'R']
            }]
        },
        handler: function(request, reply) { return reply(); }
    }
}, {
    method: 'POST',
    path: '/B',
    config: {
        plugins: {
            permissions: [{
                name: 'B',
                acl: ['C']
            }, {
                name: 'C',
                acl: ['D']
            }]
        },
        handler: function(request, reply) { return reply(); }
    }
}]);

server.ext('onPreAuth', function(request, reply) {
    request.permissions = permissions;
    reply.continue();
});

server.register(require('../'), function(err) {
    if (err) {
        throw err;
    }

    server.start(function() {});

});
