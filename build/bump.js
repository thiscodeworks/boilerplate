/**
 * Bumps the version
 */

var fs = require( 'fs' );

module.exports = (function() {
    var vers = null;

    return {
        setVersion: function( version ) {
            if ( version ) {
                vers = version;
                return {
                    version: version,
                    indent: 4
                }
            }

            return {
                indent: 4
            }
        },

        getVersion: function() {
            var pkg = JSON.parse( fs.readFileSync( './package.json', {
                encoding: 'utf8'
            }));

            return vers || pkg.version;
        }
    }
})();
