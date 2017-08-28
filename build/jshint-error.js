/**
 * Fires error on hinting error for plumber to catch but otherwise allows
 * the build process to continue
 */

var through = require( 'through2' );

module.exports = function() {

    return through.obj( function( file, enc, cb ) {
        cb( file.jshint.success ? null : new Error( 'JSHint error' ), file );
    });
};
