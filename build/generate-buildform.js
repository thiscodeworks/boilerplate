 module.exports = (function() {
     "use strict";

    var fs      = require( 'fs' ),
        path    = require( 'path' ),
        each    = require( 'lodash-node/modern/collections/foreach' ),
        build   = require( './build.json' );

    build.pages = build.pages.map( function( page ) {
        return path.join( build.core.path.pages, page );
    });

    build.components = build.components.map( function( comp ) {
        return path.join( build.core.path.components, comp, '/' );
    });

    build.core.scripts.vendor = build.core.scripts.vendor.map( function( script ) {
        return path.join( build.core.path.vendor, script );
    });

    build.core.dist = each( build.core.dist, function( value, key ) {
        build.core.dist[ key ] = key === 'base' ? value : path.join( build.core.dist.base, value );
    });

    build.core.assets = build.core.assets.map( function( asset ) {
        return path.join( build.core.path.core, asset );
    });

    build.styles = [];
    fs.readdirSync( build.core.path.styles ).forEach( function( file ) {
        if ( !/^\_/.test( file ) ) {
            build.styles.push( path.join( build.core.path.styles, file ) );
        }
    });

    build.core.scripts.app = build.core.scripts.app.map( function( script ) {
        return path.join( build.core.path.scripts, script );
    });

    return build;
 })();
