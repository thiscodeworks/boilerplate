/**
 * Runs pages through hogan templating
 * ---
 *
 * Currently just applies partials
 */

var fs          = require( 'fs' ),
    path        = require( 'path' ),
    gutil       = require( 'gulp-util' ),
    through     = require( 'through2' ),
    hogan       = require( 'hogan.js' ),
    Promise     = require( 'es6-promise' ).Promise,
    extend      = require( 'lodash-node/modern/objects/assign' ),
    component   = require( './generate-component-html' );

module.exports = function( opts ) {
    var template, cache;

    // Safe to check for existence as a build form must be specified
    if ( !opts ) {
        new gutil.PluginError({
            plugin: 'realAmerican',
            message: 'Must specify options for templating task'
        });
    }

    if ( opts.template ) {
        template = fs.readFileSync( opts.template, {
            encoding: 'utf8'
        });
    }

    if ( !opts.build ) {
        gutil.log( gutil.colors.red( 'Error: Must specify build form for template partials' ) );
    }

    /**
     * Concurrently grabs all specified components but basically holds execution
     * until that is done. Will retrieve from a cache for subsequent page templates.
     */
    function getPartials() {

        /**
         * Returns a promise containing the html string rep of a component
         */
        function createComponent( comp ) {
            var obj = {};
            return new Promise( function( resolve, reject ) {
                component.generate( comp )
                    .then( function( res ) {
                        obj[ path.basename( comp ) ] = res;
                        resolve( obj );
                    });
            });
        }

        /**
         * Returns a promise containing all the partials
         */
        return new Promise( function( resolve, reject ) {

            if ( !opts.build.components ) {
                resolve();
                return;
            }

            if ( cache ) {
                resolve( cache );
                return;
            }

            Promise.all( opts.build.components.map( createComponent ) ).then( function( res ) {
                cache = res.reduce( function( a, b ) {
                    return extend( a, b );
                });
                resolve( cache );
            });
        });
    }


    /**
     * Stream template through rendering
     */
    return through.obj( function( file, enc, cb ) {

        getPartials()
            .then( function( partials ) {

                gutil.log( gutil.colors.magenta( '( ◔┏‸┓◔)' ), 'Hogan knows best -', gutil.colors.cyan( file.relative ) );

                var tmpl = hogan.compile( file.contents.toString() );
                file.contents = new Buffer( tmpl.render( {}, partials ) );

                cb( null, file );
            })
            .catch( function( err ) {
                new gutil.PluginError({
                    plugin: 'realAmerican',
                    message: 'Error getting component partials'
                });
            });
    });
};
