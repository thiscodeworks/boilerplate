/**
 * Turns components into blocks of html
 * ---
 *
 * Just give it a path to a component and it'll return a promise containing a
 * string of html.
 */

var fs        = require( 'fs' ),
    path      = require( 'path' ),
    util      = require( 'util' ),
    extend    = require( 'lodash-node/modern/objects/assign' ),
    Promise   = require( 'es6-promise' ).Promise,
    hogan     = require( 'hogan.js' ),

    through   = require( 'through2' ),
    gutil     = require( 'gulp-util' );


exports.generate = function( component ) {

    /**
     * Wraps a string in an array and returns the array
     * @param str {string}
     */
    function arrayWrap( str ) {
        return util.isArray( str ) ? str : [ str ];
    }

    /**
     * Basic logging handler for errors
     */
    function handleError( err ) {
        console.log( '-- Error generating component html --' );
        console.log( err );
    }

    /**
     * Returns an object representing the json at filepath or an error
     * @param filepath {string} path to json file to grab
     * @returns {Promise} should resolve with a parsed object from the json file
     */
    function get( filepath ) {

        return new Promise( function( resolve, reject ) {
            fs.readFile( filepath, {
                encoding: 'utf8'
            }, function( err , res ) {
                if ( err ) {
                    reject( err );
                    return;
                }

                resolve( res );
            });

        })
        .catch( Error( handleError ) );
    }

    /**
     * Creates the build form object that is passed down the chain
     */
    function createBuildForm( componentPath ) {

        return new Promise( function( resolve, reject ) {
            get( path.join( componentPath, 'build.json' ) )
                .then( JSON.parse )
                .then( function( res ) {
                    resolve({
                        path: componentPath,
                        form: res
                    });
                })
                .catch( Error( 'Struggling to construct build form for component' ) );
        });
    }

    /**
     * Consolidates separate data sources in to one object
     * @param buildForm {object} expects the component data.json
     * @returns {Promise} resolves with an array of data objects
     */
    function getData( build ) {

        return new Promise( function( resolve, reject ) {

            // arrayWrap ensures that we are dealing with an array
            Promise.all( arrayWrap( build.form.data ).map( function( data ) {
                return get( path.join( build.path, data ) )
                          .then( JSON.parse );
            }))
            .then( function( res ) {
                if ( !res ) {
                    // It shouldnt get here as the error handler should catch it
                    // first
                    reject( Error( 'Struggling to build data for component' ) );
                }

                // res is now an array of objects for each json file referenced
                // in the buildForm.  Need to collate it into a single object.

                // collate and spit out
                build.data = res.reduce( function( a, b ) {
                    return extend( a, b );
                });
                resolve( build );
            })
            .catch( Error( handleError ) );
        });
    }

    /**
     * Gets a single dependency and returns as a key/value pair
     * name: HTML
     * @param dep {String} dependency path
     * @returns {Promise} resolves to HTML string representation
     */
    function getDependency( dep ) {

        return new Promise( function( resolve, reject ) {
            var obj = {};
            generate( dep, { useRelative: true } )
                .then( function( result ) {
                    obj[ path.basename( dep ) ] = result;
                    resolve( obj );
                })
                .catch( reject );
        });
    }

    /**
     * Gets all the dependencies for the current component to use as partials
     * @param build {Object} current status of build object that we're creating
     * @returns {Promise} resolves to the build object with dependency data appended
     */
    function getDependencies( build ) {

        if ( !build.form.deps ) {
            return build;
        }

        return new Promise( function( resolve, reject ) {
            Promise.all( arrayWrap( build.form.deps ).map( function( dep ) {
                return getDependency( path.join( build.path, dep ) );
            }))
                .then( function( res ) {
                    if ( !res ) {
                        // It shouldnt get here as the error handler should catch it
                        // first
                        reject( Error( 'Struggling to build dependencies for component' ) );
                    }

                    // res should be an array of dependency objects
                    // collate and spit out
                    build.deps = res.reduce( function( a, b ) {
                        return extend( a, b );
                    });
                    resolve( build );
                })
                .catch( Error( handleError ) );
        });
    }

    /**
     * Grabs the template file
     * @param build {object} the object we're building for the compile template function
     * @returns {Promise} resolves to the build object
     */
    function getIndex( build ) {
        return new Promise( function( resolve, reject ) {
            if ( !build.form.base ) {
                reject( Error( 'BuildForm should specify a base to use as a template' ) );
            }

            get( path.join( build.path, build.form.base ) )
                .then( function( res ) {
                    build.tmpl = res;
                    resolve( build );
                });
        });
    }

    /**
     * Compiles and renders the template
     * @param {Object} the build object, containing template and data
     * @returns {string} HTML string of built code
     */
    function renderTemplate( build ) {
        return hogan
                .compile( build.tmpl )
                .render( build.data, build.deps );
    }

    /**
     * Generates a component
     * Filepath goes relative to the project root
     * @param buildform {string} the build form specifying the component
     * @returns {Promise} resolves to the HTML string rep of the component
     */
    function generate( componentPath, opts ) {
        var filepath = componentPath;

        if ( opts && !opts.useRelative ) {
            filepath = path.join( __dirname, '../', componentPath );
        }

        return createBuildForm( filepath )
            .then( getData )
            .then( getDependencies )
            .then( getIndex )
            .then( renderTemplate )
            .catch( handleError );
    }

    // Do the async magic and return a promise with a string of HTML
    return generate( component );
};
