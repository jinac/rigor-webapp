"use strict";


var browseApp = angular.module('browseApp', []);


// make Angular use (( )) for template markup instead of {{ }}
// to avoid a conflict with Flask's templates which also use {{ }}
browseApp.config(function($interpolateProvider,$locationProvider) {
    $interpolateProvider.startSymbol('((');
    $interpolateProvider.endSymbol('))');
    $locationProvider.html5Mode(false);
});


browseApp.controller('BrowseController', function($scope, $http, $routeParams, $location) {

    //================================================================================
    // CONSTANTS AND UTILS

    // ANY is a special value to represent that we should ignore this field
    // when searching.  this is equivalent to ''.
    // When we convert $scope.query to query params for the API, we
    // omit any items which are ANY or ''.
    var ANY = '(any)';

    var tokenizeString = function(s) {
        // given a string like "   tag1 tag2 \n   tag3 "
        // return ['tag1','tag2','tag3']
        var result = [];
        angular.forEach(s.trim().split(' '), function(token,ii) {
            token = token.trim();
            if (token.length > 0) {
                result.push(token);
            }
        });
        return result;
    };


    //================================================================================
    // SCOPES

    $scope.view_state = {            // which view mode we're in.
        render_path: 'thumbs'        // 'thumbs', 'detail'
    };
    $scope.search_form = {           // choices for drop-downs.  to be filled in via AJAX
        database_names: ['blindsight'],
        sources: [],
        sensors: []
    };
    $scope.query = {                 // query params for searching images
        database_name: 'blindsight',      // TODO: this should be set to config.INITIAL_DB_NAME
        source: ANY,
        sensor: ANY,
        //has_tags: 'sightpal angle testing bigangle',
        has_tags: '',
        exclude_tags: '',
        max_count: 18,
        page: 0
    };
    $scope.search_results = {
        search_has_occurred: false,   // has a search occurred yet?
        images: [],                   // results of the search
        full_count: 0,                // number of returned images (all pages)
        last_page: 0                  // number of pages
    };
    $scope.detail = {
        image: undefined,             // json for the image being viewed
        annotations: []               // json for the annotations
    };


    //================================================================================
    // SEARCH FORM BUTTONS AND BEHAVIOR

    $scope.clickClearButton = function() {
        //$scope.view_state.render_path = 'thumbs';
        $scope.query.source = ANY;
        $scope.query.sensor = ANY;
        $scope.query.has_tags = '';
        $scope.query.exclude_tags = '';
        $scope.query.page = 0;

        $scope.switchToThumbView();
        $scope.doSearch();
    };

    $scope.clickSearchButton = function() {
        $scope.switchToThumbView();
        $scope.query.page = 0;
        $scope.doSearch();
    };

    // when user changes database name, re-fetch sources and sensors
    $scope.$watch('query.database_name', function(newValue,oldValue) {
        console.log('[watch database_name] ----------------------------------------\\');
        console.log('[watch database_name] db name changed from ' + oldValue + ' to ' + newValue + ', so re-fetching sensors and sources');

        // reset source and sensor to legal values
        $scope.query.source = ANY;
        $scope.query.sensor = ANY;

        // fill in sources
        console.log('[watch database_name] getting sources...');
        $http.get('/api/v1/db/'+$scope.query.database_name+'/source')
            .success(function(data,status,headers,config) {
                $scope.search_form.sources = data['d'];
                $scope.search_form.sources.unshift(ANY);  // put on front of list
                console.log('...[watch database_name] got sources: ' + $scope.search_form.sources);
            })
            .error(function(data,status,headers,config) {
                console.log('...[watch database_name] error getting sources');
            });

        // fill in sensors
        console.log('[watch database_name] getting sensors...');
        $http.get('/api/v1/db/'+$scope.query.database_name+'/sensor')
            .success(function(data,status,headers,config) {
                $scope.search_form.sensors = data['d'];
                $scope.search_form.sensors.unshift(ANY);  // put on front of list
                console.log('...[watch database_name] got sensors: ' + $scope.search_form.sensors);
            })
            .error(function(data,status,headers,config) {
                console.log('...[watch database_name] error getting sensors');
            });

        console.log('[watch database_name] ----------------------------------------/');
    });


    //================================================================================
    // DO SEARCH

    $scope.doSearch = function(callback) {
        console.log('[do_search] ----------------------------------------\\');
        console.log('[do_search] getting images...');

        $scope.search_results.search_has_occurred = true;

        $location.search($scope.query);

        // clean up query object for use as URL params
        var queryParams = angular.copy($scope.query);
        queryParams.has_tags = tokenizeString(queryParams.has_tags).join();
        queryParams.exclude_tags = tokenizeString(queryParams.exclude_tags).join();

        angular.forEach(queryParams, function(value,key) {
            if (value === ANY || value === '') {
                delete queryParams[key];
            }
        });
        console.log('[do_search] query = ');
        console.log(queryParams);

        $http.get('/api/v1/search',{params: queryParams})
            .success(function(data,status,headers,config) {
                $scope.search_results.images = data['images'];
                $scope.search_results.full_count = data['full_count'];
                $scope.search_results.last_page = Math.floor($scope.search_results.full_count / $scope.query.max_count);
                console.log('...[do_search] success. got ' + $scope.search_results.images.length + ' images');
                console.log('...[do_search] full_count = ' + $scope.search_results.full_count);
                console.log('...[do_search] last_page = ' + $scope.search_results.last_page);
                if (typeof callback !== 'undefined') {
                    console.log('...[do_search] running callback:');
                    callback();
                }
            })
            .error(function(data,status,headers,config) {
                console.log('...[do_search] error');
            });

        console.log('[do_search] ----------------------------------------/');
    };


    //================================================================================
    // THUMB PAGINATION

    $scope.nextButtonIsEnabled = function () {
        return $scope.search_results.search_has_occurred && $scope.query.page < $scope.search_results.last_page;
    };
    $scope.prevButtonIsEnabled = function () {
        return $scope.search_results.search_has_occurred && $scope.query.page >= 1;
    };

    $scope.clickNextButton = function() {
        if ($scope.nextButtonIsEnabled()) {
            console.log('next button');
            $scope.query.page += 1;
            $scope.doSearch();
        }
    };
    $scope.clickPrevButton = function() {
        if ($scope.prevButtonIsEnabled()) {
            console.log('prev button');
            $scope.query.page -= 1;
            $scope.doSearch();
        }
    };


    //================================================================================
    // MODIFY SEARCH BY CLICKING TAG IN DETAIL OR THUMB VIEW

    $scope.clickTag = function(tag) {
        var existingTagSearch = tokenizeString($scope.query.has_tags);

        $scope.switchToThumbView();

        // if we're not already searching for this tags...
        if (existingTagSearch.indexOf(tag) === -1) {
            // add the tag to the has_tags string
            if ($scope.query.has_tags === '') {
                $scope.query.has_tags = tag;
            } else {
                $scope.query.has_tags += ' ' + tag;
            }
            $scope.doSearch();
        }
    };


    //================================================================================
    // POPULATING DETAIL VIEW

    var findDetailImageAndGetAnnotations = function(ii) {
        console.log('[find detail and annotations] ----------------------------------------\\');
        // find image
        $scope.detail.image = undefined;
        angular.forEach($scope.search_results.images, function(image,jj) {
            if (image.ii === ii) {
                $scope.detail.image = image;
                console.log('[find detail and annotations] found image');
            }
        });
        if (typeof $scope.detail.image == 'undefined') {
            console.error('[find detail and annotations] could not find image. ii = ' + ii);
        }

        // update hash
        $location.path('/'+$scope.detail.image.database_name+'/image/'+$scope.detail.image.locator);
        $location.search('');

        // load annotations
        console.log('[find detail and annotations] loading annotations...');
        $http.get('/api/v1/db/'+$scope.detail.image.database_name+'/image/'+$scope.detail.image.locator+'/annotation')
            .success(function(data,status,headers,config) {
                $scope.detail.annotations = data['d']
                console.log('...[find detail and annotations] success.  got ' + $scope.detail.annotations.length + ' annotations');
                console.log('...[find detail and annotations] drawing annotations');

                drawAnnotations();
            })
            .error(function(data,status,headers,config) {
                console.log('...[find detail and annotations] error');
            });

        console.log('[find detail and annotations] ----------------------------------------/');
    };

    var drawAnnotations = function() {
        var canvas = document.getElementById('image_canvas');
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,$scope.detail.image.x_resolution, $scope.detail.image.y_resolution);
        angular.forEach($scope.detail.annotations, function(annotation,jj) {
            if (annotation.domain === 'text') {
                ctx.fillStyle = "hsla(35,100%,45%,0.4)";
                ctx.strokeStyle = "hsla(35,100%,66%,0.4)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                angular.forEach(annotation.boundary, function(point,kk) {
                    if (kk === 0) {
                        ctx.moveTo(point[0],point[1]);
                    } else {
                        ctx.lineTo(point[0],point[1]);
                    }
                });
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        });
        angular.forEach($scope.detail.annotations, function(annotation,jj) {
            if (annotation.domain === 'textcluster') {
                ctx.beginPath();
                ctx.moveTo(annotation.boundary[0][0],annotation.boundary[0][1]);
                ctx.lineTo(annotation.boundary[1][0],annotation.boundary[1][1]);

                ctx.strokeStyle = "hsla(260,80%,70%,0.5)";
                ctx.lineWidth = 7;
                ctx.closePath();
                ctx.stroke();

                ctx.strokeStyle = "hsla(260,80%,30%,0.3)";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(annotation.boundary[0][0],annotation.boundary[0][1], 5, 0,2*Math.PI);
                ctx.closePath();

                ctx.strokeStyle = "hsla(260,80%,30%,0.3)";
                ctx.fillStyle = "hsla(260,80%,70%,0.3)";
                ctx.fill();
                ctx.stroke();
            }
        });
    };

    // this is a hack
    $scope.switchToImageByLocator = function(database_name, locator) {
        console.log('[switch to image by locator] ----------------------------------------\\');
        console.log('[switch to image by locator] switching to image ' + locator);
        $scope.view_state.render_path = 'detail';
        $scope.detail.annotations = [];

        $scope.detail.image = {
            ii: 0,
            page: 1,
            max_count: 1
        };

        // load image data
        console.log('[switch to image by locator] loading image data...');
        $http.get('/api/v1/db/'+database_name+'/image/'+locator)
            .success(function(data,status,headers,config) {
                $scope.detail.image = data
                console.log('...[switch to image by locator] success.  got image data.');

                // load annotations
                console.log('...[switch to image by locator] loading annotations...');
                $http.get('/api/v1/db/'+database_name+'/image/'+locator+'/annotation')
                    .success(function(data,status,headers,config) {
                        $scope.detail.annotations = data['d']
                        console.log('......[switch to image by locator] success.  got ' + $scope.detail.annotations.length + ' annotatations');
                        console.log('......[switch to image by locator] drawing annotations');

                        drawAnnotations();
                    })
                    .error(function(data,status,headers,config) {
                        console.log('......[switch to image by locator] error');
                    });

            })
            .error(function(data,status,headers,config) {
                console.log('...[switch to image by locator] error');
            });

        console.log('[switch to image by locator] ----------------------------------------/');
    };



    $scope.switchToImage = function(ii) {
        if (ii >= 0 && ii < $scope.search_results.full_count) {
            console.log('[switch to image by ii] ----------------------------------------\\');
            console.log('[switch to image by ii] switching to image '+ii);
            $scope.view_state.render_path = 'detail';
            $scope.detail.annotations = [];

            // have we gone out of our current page?
            // which direction?
            var needToDoSearch = false;
            if (ii < $scope.search_results.images[0].ii) {
                console.log('[switch to image by ii] went below current page.  searching again');
                $scope.query.page -= 1;
                needToDoSearch = true;
            }
            if (ii > $scope.search_results.images[$scope.search_results.images.length-1].ii) {
                console.log('[switch to image by ii] went past current page.  searching again');
                $scope.query.page += 1;
                needToDoSearch = true;
            }

            if (needToDoSearch) {
                // do search in background but don't switch to thumbs view
                // wait for search to complete
                // then update detail.image
                $scope.doSearch(function() {
                    findDetailImageAndGetAnnotations(ii);
                });
            } else {
                // just update detail.image now
                findDetailImageAndGetAnnotations(ii);
            }
            console.log('[switch to image by ii] ----------------------------------------/');

        }
    };

    $scope.switchToThumbViewAndDoFirstSearchIfNeeded = function() {
        $scope.switchToThumbView();
        if (!$scope.search_results.search_has_occurred) {
            $scope.doSearch();
        }
    };
    $scope.switchToThumbView = function() {
        $scope.view_state.render_path = 'thumbs';
        // update hash
        $location.path('/'+$scope.query.database_name+'/search');
        $location.search($scope.query);
    };

    $scope.nextImageButtonIsEnabled = function () {
        return $scope.detail.image.ii < $scope.search_results.full_count-1;
    };
    $scope.prevImageButtonIsEnabled = function () {
        return $scope.detail.image.ii >= 1;
    };

    $scope.getDetailTextAnnotations = function() {
        // just return the text annotations, not the textclusters
        var result = [];
        angular.forEach($scope.detail.annotations, function(annotation,jj) {
            if (annotation.domain === 'text') {
                result.push(annotation);
            }
        });
        return result;
    };


    //================================================================================
    // MAIN




    // fill in database_names on page load
    console.log('[main] getting database names...');
    $http.get('/api/v1/db')
        .success(function(data,status,headers,config) {
            $scope.search_form.database_names = data['d']
            console.log('...[main] success. got database names: ' + $scope.search_form.database_names);
        })
        .error(function(data,status,headers,config) {
            console.log('...[main] error');
        });


    // load data from URL
    angular.forEach($location.search(), function(value,key) {
        if (key === 'page' || key === 'max_count') {
            value = parseInt(value,10);
        }
        $scope.query[key] = value;
    });

    var path = $location.path();
    if (path.indexOf('/image/') !== -1) {
        console.log('[main] choosing DETAIL VIEW because of URL');
        // image detail view
        var parts = path.split('/');
        var locator = parts[parts.length-1];
        var database_name = parts[1];
        $scope.query.database_name = database_name;
        $scope.switchToImageByLocator(database_name, locator);
    } else {
        console.log('[main] choosing THUMB VIEW because of URL');
        // start the page off with an actual search
        $scope.switchToThumbView();
        $scope.doSearch();
    }

    /*function () {
        $scope.switchToImage(0);
    });*/

});




