/**
 * gulp-static-seed
 * ---
 *
 */

var path                = require( 'path' ),
    http                = require( 'http' ),
    fs                  = require( 'fs' ),

    gulp                = require( 'gulp' ),
    gutil               = require( 'gulp-util' ),
    markdown            = require( 'gulp-markdown' ),
    gulpBump            = require( 'gulp-bump' ),
    notify              = require( 'gulp-notify' ),
    plumber             = require( 'gulp-plumber' ),
    watch               = require( 'gulp-watch' ),
    livereload          = require( 'gulp-livereload' ),
    open                = require( 'gulp-open' ),
    less                = require( 'gulp-less' ),
    rename              = require( 'gulp-rename' ),
    jshint              = require( 'gulp-jshint' ),
    stylish             = require( 'jshint-stylish' ),
    concat              = require( 'gulp-concat' ),
    uglify              = require( 'gulp-uglify' ),
    gulpif              = require( 'gulp-if' ),
    cache               = require( 'gulp-cached' ),
    header              = require( 'gulp-header' ),

    eventStream         = require( 'event-stream' ),
    hljs                = require( 'highlight.js' ),
    express             = require( 'express' ),
    connectLivereload   = require( 'connect-livereload' ),
    hogan               = require( 'hogan.js' ),
    moment              = require( 'moment' ),
    del                 = require( 'del' ),

    bump                = require( './build/bump' ),
    realAmerican        = require( './build/realAmerican' ),
    jshintError         = require( './build/jshint-error' ),

    args                = require( 'minimist' )( process.argv.slice( 2 ) ),
    lr                  = require( 'tiny-lr' )(),
    server              = express(),

    STATIC_PORT         = 9021,
    LR_PORT             = 35729,
    PROD                = args.p || process.env.NODE_ENV && process.env.NODE_ENV.match( /prod/ ),
    DEV                 = args.d || false,
    FORCE               = args.f || false,

    pkg                 = require( './package.json' ),
    build               = require( './build/generate-buildform.js' ),

    banner              = hogan
                            .compile(
                                [   '/**',
                                    ' *   {{ pkg.name }} v{{ pkg.version }}',
                                    ' * © {{ pkg.author }} ~ {{ date }}',
                                    ' */\n'
                                ].join( '\n' ) )
                            .render( {
                                pkg: pkg,
                                date: moment().format("MMM Do YYYY")
                            });


/**
 * Compile and render pages
 */
gulp.task( 'pages', function() {
    return gulp
        .src( build.pages )
        .pipe( plumber({
            errorHandler: notify.onError( 'Page Build error: <%= error.message %>' )
        }))
        .pipe( realAmerican({
            build: build
        }))
        .pipe( rename({
            extname: '.html'
        }))
        .pipe( gulp.dest( 'dist' ) )
});


/**
 * Converts less to css
 */
gulp.task( 'styles', function() {

    return gulp
        .src( build.styles )        
        .pipe(plumber({ errorHandler: function(error){
          notify.onError({title: "Stylesheet error", message: error.message, sound: true})(error);
          this.emit('end');
        } }))
        .pipe( less({
            compress: !DEV
        }))
        .pipe( concat( 'styles.css' ) )
        .pipe( header( banner ) )
        .pipe( gulp.dest( build.core.dist.styles ) );
});


/**
 * Scripts - hint, minify and concat
 */
gulp.task( 'scripts', function() {
  
    var libraries=[];
    libraries.push('node_modules/jquery/dist/jquery.js');
    libraries.push('node_modules/slick-carousel/slick/slick.js');
    libraries.push('node_modules/@fancyapps/fancybox/dist/jquery.fancybox.js');
    
    var vendorStream = gulp
        .src(libraries,build.core.scripts.vendor )
        .pipe( concat( 'vendor.js ') );

    var appStream = gulp
        .src( build.core.scripts.app )
        .pipe( plumber( {
            errorHandler: notify.onError( 'Script error: <%= error.message %>' )
        }) )
        .pipe( jshint() )
        .pipe( jshint.reporter( stylish ) )
        .pipe( jshintError() )
        .pipe( concat( 'main.js' ) )
        .pipe( rename( { suffix: '.min' } ) )
        .pipe( gulpif( !DEV, uglify() ) )
        .pipe( header( banner ) );

    return eventStream.merge( vendorStream, appStream )
        .pipe( concat( 'index.js' ) )
        .pipe( gulp.dest( build.core.dist.scripts ) );

});


/**
 * Static copy
 */
gulp.task( 'copy', function() {
    return gulp
        .src( build.core.assets )
        .pipe( cache( 'copy' ) )
        .pipe( gulp.dest( build.core.dist.assets ) )
});


/**
 * Version bump
 *
 * `gulp bump` will bump the patch number
 * `gulp bump -b x.y.z` will bump the version to x.y.z
 */
// @todo this is pretty crap
gulp.task( 'bumpit', function() {
    return gulp
        .src([
            './package.json',
            './bower.json'
        ])
        .pipe( plumber() )
        .pipe( gulpBump( bump.setVersion( args.b ) ) )
        .pipe( gulp.dest( './' ) );
});
gulp.task( 'bump', function() {
    return gulp.start(
        'bumpit',
        function() {
            gulp.src( './' )
                .pipe( notify( {
                    message: 'Version Bumped ' + bump.getVersion(),
                }));
        }
    );
});


/**
 * Mashes up the dist directory
 */
gulp.task( 'clean', function( done ) {
    del([ path.join( build.core.dist.base, '/**/*' ) ], done );
});


/**
 * Creates a static server for the live reload and watch tasks.
 * Uses connect to inject the livereload script.
 */
gulp.task( 'staticServer', function( done ) {
    server.use( connectLivereload() );
    server.use( express.static( path.join( __dirname, build.core.dist.base ) ) );

    server.listen( STATIC_PORT, function() {
        gutil.log( 'Server listening on', gutil.colors.magenta( STATIC_PORT ) );

        done();
    });
});


/**
 * Starts the live reload server
 */
gulp.task( 'lrServer', function( done ) {
    lr.listen( LR_PORT, function() {
        gutil.log( 'livereload server listening on', gutil.colors.magenta( LR_PORT ) );

        done();
    });
});


/**
 * Compound build task
 */
gulp.task( 'build', [ 'pages', 'styles', 'scripts', 'copy' ] );


/**
 * Watches and reloads the page
 */
gulp.task( 'watch', [ 'staticServer', 'lrServer', 'build' ], function() {

    /**
     * Open the default browser
     */
    if ( args.o ) {
        var filename = 'index.html',
            host = args.e ? 'http://0.0.0.0:' : 'http://localhost:';

        if ( typeof args.o === 'string' && fs.existsSync( path.join( build.core.dist.base, args.o ) ) ) {
            filename = args.o;
        }

        gutil.log( 'Opening file', gutil.colors.magenta( filename ) );

        gulp.src( path.join( build.core.dist.base, filename ) )
            .pipe( open( '', {
                url: path.join( host + STATIC_PORT, filename )
            }) );
    }

    /**
     * Helper function to run a reload using the specified task to modify the build artefact
     */
    function reload( task ) {

        return function( file ) {
            return gulp
                .start( task, function() {
                    var filename = path.relative( __dirname, file.path );
                    gutil.log( 'File changed', gutil.colors.magenta( path.relative( __dirname, file.path ) ) );

                    lr.changed( {
                        body: {
                            files: gutil.replaceExtension( path.basename( file.path ), '' )
                        }
                    });
                });
        }
    }


    /**
     * Start watching stuff
     */
    gulp.start( function() {

        gulp.watch( [
            build.pages,
            path.join( build.core.path.components, '**/*.hjs' )
        ], reload( 'pages' ) );

        gulp.watch( build.styles, reload( 'styles' ) );        

        gulp.watch( build.core.scripts.app, reload( 'scripts' ) );

        gutil.log( 'Watching files...' );
    });
});


/**
 * Default task to run
 */
gulp.task( 'default', [ 'clean' ], function() {
    return gulp.start(
        'build',
        function() {
            gulp.src( './', { read: false } )
                .pipe( notify( 'Build Success ✔' ) );

            if ( DEV ) {
                gutil.log( '' );
                gutil.log( gutil.colors.yellow( 'Dev build' ) );
            }
        }
    );

});
