'use strict';

angular.module('hapi-learning')
    .factory('CoursesFactory', [
    'Restangular',
    'LoginFactory',
    '$q',
    function (Restangular, LoginFactory, $q) {

            var internals = {};
            var exports = {};

            internals.fetchedSubscribed = false;
            internals.subscribedCourses = [];

            exports.add = function (value) {
                // TO-DO
                internals.courses.push(value);
            };

            /**
             *  Courses fetching, return asynchronous promise fill with them.
             */
            exports.load = function (options) {

                var d = $q.defer();

                var codename = options.codename;
                var tags = options.tags;
                var page = options.page;
                var limit = options.limit;

                if (tags && (page || limit)) {
                    d.reject('Cannot request tags with pagination');
                }

                var where = {};

                if (codename) {
                    where.codename = codename;
                }

                if (page) {
                    where.page = page;
                }

                if (limit) {
                    where.limit = limit;
                }

                if (tags) {
                    where.tags = tags;
                    where.pagination = false;
                }



                Restangular
                    .all('courses')
                    .customGET('', where)
                    .then(function(results) {
                        d.resolve(results);
                    })
                    .catch(function(error) {
                        d.reject(error);
                    });

                return d.promise;
            };

            exports.loadCodes = function() {
                var d = $q.defer();

                Restangular.all('courses')
                    .customGET('', {
                        pagination: false,
                        select: ['code']
                    }).then(function(response) {
                        d.resolve(response);
                    }).catch(function(error) {
                        d.reject(error);
                    });

                return d.promise;
            };

            /**
                Load a specific course
            **/
            exports.loadSpecific = function (code) {

                return $q(function (resolve, reject) {
                    Restangular.one('courses', code)
                        .get()
                        .then(function (object) {
                            resolve(object);
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                });
            };

            /**
                Try to subscribe a course to a user (/users/{id}/subscribe/{courseId}).
                It should return the subscribed course if success. This will be added
                to local subscribed courses.

                /!\ WIP : Does not return course atm, so subscribed course is clear.
            **/
            exports.subscribe = function (code) {
                return $q(function (resolve, reject) {
                    LoginFactory.getProfile().then(function (profile) {
                        Restangular.one('users', profile.username)
                            .customPOST({}, 'subscribe/' + code)
                            .then(function (course) {
                                internals.subscribedCourses.push(course);
                                resolve(course);
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    }).catch(function (error) {});

                });
            };

            /**
                Try to unsubscribe a course to a user (/users/{id}/unsubscribe/{courseId}).
                It should return the subscribed course if success. This will be removed
                from local subscribed courses.
            **/
            exports.unsubscribe = function (code) {
                return $q(function (resolve, reject) {
                    LoginFactory.getProfile().then(function (profile) {
                        Restangular.one('users', profile.username)
                            .customPOST({}, 'unsubscribe/' + code)
                            .then(function (object) {
                                _.remove(internals.subscribedCourses, function (course) {
                                    return course.code === code;
                                });
                                resolve(object);
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    });
                });
            };

            /**
                Load every courses subscribed by current user (GET /users/{id}/courses).
                If they are already loaded, (internals.subscribedCourse) it will not.
            **/
            exports.getSubscribed = function () {
                return $q(function (resolve, reject) {
                    if (!internals.fetchedSubscribed) {
                        LoginFactory.getProfile().then(function (profile) {

                            Restangular.one('users', profile.username)
                                .getList('courses')
                                .then(function (subscribedCourses) {
                                    internals.subscribedCourses = subscribedCourses;
                                    internals.fetchedSubscribed = true;
                                    resolve(internals.subscribedCourses);
                                })
                                .catch(function (error) {
                                    reject(error);
                                });
                        }).catch(function (error) {});

                    }
                    else {
                        resolve(internals.subscribedCourses);
                    }
                });
            };

            exports.get = function (index) {
                if (index) {
                    return internals.courses[index];
                }
                else {
                    return internals.courses;
                }
            };

            exports.clear = function () {
                internals.courses = [];
            };


            return exports;
}]);
