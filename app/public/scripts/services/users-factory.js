'use strict';

angular.module('hapi-learning')
    .factory('UsersFactory', ['Restangular', '$q', function (Restangular, $q) {

        var exports = {};

        exports.create = function(users) {
            return Restangular.all('users').customPOST(users);
        };

        return exports;
}]);
