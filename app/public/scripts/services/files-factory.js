'use strict';

angular.module('hapi-learning')
    .factory('FilesFactory', [
        'Restangular',
        '$q',
        '$http', function(Restangular, $q, $http) {

        var internals = {};
        var exports = {};

        internals.replacePath = function(path) {
            path = path.replace('%2F', '/');

            if (path[0] === '/') {
                path = path.substr(1);
            }

            return path;
        };

        internals.getUrl = function(course, path) {
            //path = internals.replacePath(path);
            path = path.replace('%2F', '/');
            var url = Restangular.configuration.baseUrl + '/courses/' + course + '/documents' + path;
            return url;
        };


        internals.get = function(course, path, recursive) {
            return $q(function(resolve, reject) {

                path = internals.replacePath(path);

                Restangular
                    .one('courses', course)
                    .all('tree')
                    .customGET(path, { recursive: recursive })
                    .then(function(results) {
                        resolve(results);
                    })
                    .catch(function(err) {
                        reject(err);
                    });
            });
        };

        exports.getList = function(course, path) {
            return internals.get(course, path, false);
        };

        exports.getTree = function(course, path) {
            return internals.get(course, path, true);
        };


        exports.createFolder = function(course, path) {

            return $q(function(resolve, reject) {
                path = internals.replacePath(path);
                Restangular
                    .one('courses', course)
                    .all('folders')
                    .customPOST(null, path)
                    .then(function(response) {
                        resolve();
                    })
                    .catch(function(error) {
                        reject(error);
                    });
            });
        };


        exports.download = function(course, path) {

            var url = internals.getUrl(course, path);

            $http({
                url: url,
                method: 'GET',
                responseType: 'arraybuffer'
            }).then(function(results) {

                var disposition = results.headers('Content-Disposition');
                var contentType = results.headers('Content-Type');
                var filename = disposition.substr(21); // get filename

                var file = new Blob([results.data], {type: contentType });

                saveAs(file, filename, true);

            }).catch(function(err) {
                console.log(err);
            });

        };

        return exports;

    }]);
