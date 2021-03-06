'use strict';

angular.module('hapi-learning')
    .directive('courseInfo', function () {
        return {
            restrict: 'E',
            scope: {
                course: '='
            },
            templateUrl: 'templates/course-info.html',
            link: function (scope, elem, attrs) {

                scope.updated = function () {
                    return true;
                };
            }
        };
    });
