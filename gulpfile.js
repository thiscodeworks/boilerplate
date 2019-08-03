var path = require('path'),
  http = require('http'),
  fs = require('fs'),

  gulp = require('gulp'),
  gutil = require('gulp-util'),
  markdown = require('gulp-markdown'),
  gulpBump = require('gulp-bump'),
  notify = require('gulp-notify'),
  plumber = require('gulp-plumber'),
  watch = require('gulp-watch'),  
  open = require('gulp-open'),
  sass = require('gulp-sass'),
  sassGlob = require('gulp-sass-glob'),
  rename = require('gulp-rename'),
  jshint = require('gulp-jshint'),
  stylish = require('jshint-stylish'),
  concat = require('gulp-concat'),
  uglify = require('gulp-uglify'),
  uglifycss = require('gulp-uglifycss'),
  gulpif = require('gulp-if'),
  cache = require('gulp-cached'),
  header = require('gulp-header'),
  sourcemaps = require('gulp-sourcemaps'),
  svgSymbols = require('gulp-svg-symbols'),
  embedSvg = require('gulp-embed-svg'),

  eventStream = require('event-stream'),
  hljs = require('highlight.js'),
  express = require('express'),
  connectLivereload = require('connect-livereload'),
  hogan = require('hogan.js'),
  moment = require('moment'),
  del = require('del'),
  streamqueue = require('streamqueue'),
  bump = require('./build/bump'),
  realAmerican = require('./build/realAmerican'),
  jshintError = require('./build/jshint-error'),

  args = require('minimist')(process.argv.slice(2)),
  browserSync = require('browser-sync').create(),

  DEV = args.d || false,  

  pkg = require('./package.json'),
  build = require('./build/generate-buildform.js'),

  banner = hogan
  .compile(
    ['/**',
      ' * {{ pkg.name }} v{{ pkg.version }}',
      ' * {{ pkg.author }} ~ {{ date }}',
      ' */\n'
    ].join('\n'))
  .render({
    pkg: pkg,
    date: moment().format("MMM Do YYYY")
  });

gulp.task('pages', function() {
  return gulp
    .src(build.core.path.pages+'*.hjs')
    .pipe(plumber({
      errorHandler: notify.onError('Chyba v sestavení stránky: <%= error.message %>')
    }))
    .pipe(realAmerican({
      build: build
    }))
    .pipe(rename({
      extname: '.html'
    }))
    .pipe(gulp.dest('dist'))
});

gulp.task('styles-build', function() {
  return gulp
    .src('src/core/styles/main.scss')
    .pipe(sassGlob())
    .pipe(plumber({
      errorHandler: function(error) {
        notify.onError({
          title: "Chyba ve stylech: ",
          message: error.message,
          sound: true
        })(error);
        this.emit('end');
      }
    }))
    .pipe(sass({
      compress: !DEV
    }))
    .pipe(uglifycss({
      "maxLineLen": 80,
      "uglyComments": true
    }))
    .pipe(concat('styles.css'))
    .pipe(header(banner))
    .pipe(gulp.dest(build.core.dist.styles));
});

gulp.task('styles', function() {
  return gulp
    .src('src/core/styles/main.scss')
    .pipe(sassGlob())
    .pipe(plumber({
      errorHandler: function(error) {
        notify.onError({
          title: "Chyba ve stylech: ",
          message: error.message,
          sound: true
        })(error);
        this.emit('end');
      }
    }))
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.identityMap())
    .pipe(sass({
      compress: !DEV
    }))
    .pipe(uglifycss({
      "maxLineLen": 80,
      "uglyComments": true
    }))
    .pipe(concat('styles.css'))
    .pipe(header(banner))
    .pipe(sourcemaps.write(build.core.assets))
    .pipe(gulp.dest(build.core.dist.styles));
});

gulp.task('scripts', function() {

  var libraries = [];
  libraries.push('node_modules/jquery/dist/jquery.js');
  libraries.push('node_modules/slick-carousel/slick/slick.js');
  libraries.push('node_modules/@fancyapps/fancybox/dist/jquery.fancybox.js');

  return streamqueue({
        objectMode: true
      },
      gulp.src(libraries, build.core.scripts.vendor),
      gulp.src(build.core.scripts.app)
    )
    .pipe(plumber({
      errorHandler: notify.onError('Chyba v javascriptu: <%= error %>')
    }))
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(gulpif(!DEV, uglify()))
    .pipe(header(banner))
    .pipe(concat('index.js'))
    .pipe(gulp.dest(build.core.dist.scripts));
});

gulp.task('copy', function() {
  gutil.log('Finální soubory vygenerovány.');
  return gulp
    .src(build.core.assets)
    .pipe(cache('copy'))
    .pipe(gulp.dest(build.core.dist.assets))
});

gulp.task('clean', function(done) {
  del([path.join(build.core.dist.base, '/**/*')], done);
});

gulp.task('browser-sync', function(done) {
    browserSync.init({                  
      injectChanges: true,
      server: {
          baseDir: "./dist",
          port: 9021
      }
    });
    done();
});

gulp.task('sprites-svg', function() {
  return gulp.src('src/core/img/symbols/*.svg')
    .pipe(svgSymbols({
      templates: [
        `default-svg`,
        `default-demo`
      ],
    }))
    .pipe(gulp.dest('dist/assets'));
});

gulp.task('sprites-sass', function() {
  gulp.src('src/core/img/symbols/*.svg')
    .pipe(svgSymbols({
      templates: [
        `default-sass`
      ],
    }))
    .pipe(gulp.dest('src/core/styles/helpers'));
    
  gutil.log('Symboly vygenerovány');
  
  gulp.src("src/core/styles/helpers/svg-symbols.scss",{ allowEmpty: true })
    .pipe(rename("src/core/styles/helpers/_icons.scss"))
    .pipe(gulp.dest("src/core/styles/helpers/"));
    
  gulp.src("dist/assets/svg-symbols.svg",{ allowEmpty: true })
    .pipe(rename("src/components/icons/index.hjs"))
    .pipe(gulp.dest("src/components/icons/"));
    
  gutil.log('Přejmenovány symboly na ikony.');
  
  return true;
});

gulp.task('embedSvgs', function() {
  return gulp.src('dist/*.html')
    .pipe(embedSvg({
      selectors: '.inline-svg',
      root: 'dist'
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('build', gulp.series('pages', 'styles', 'scripts', 'sprites-svg', 'copy', 'embedSvgs'));
gulp.task('build-production', gulp.series('pages', 'styles-build', 'scripts', 'sprites-svg', 'sprites-sass', 'copy', 'embedSvgs'));

gulp.task('watch', gulp.series('browser-sync','build', function() {      
  function reload(file){    
    setTimeout(function(){ lr.changed({body: {files: ["styles.css","index.js"]}});},5000);
    
    gutil.log('Změna v souboru', gutil.colors.magenta(file));      
    gutil.log(gutil.colors.green.bold.underline('Hlídám změnu v souborech ...'));
  }
  
  gulp.watch([path.join(build.core.path.pages, '*.hjs'),path.join(build.core.path.components, '**/*.hjs')], gulp.series('pages')).on('change', browserSync.reload);
  gulp.watch('src/core/styles/**/*.scss', gulp.series('styles')).on('change', browserSync.reload);
  gulp.watch(build.core.scripts.app, gulp.series('scripts')).on('change', browserSync.reload);
  gulp.watch("src/core/img/**", gulp.series('copy'));
  gulp.watch("src/core/img/symbols/*.svg", gulp.series('sprites-svg', 'sprites-sass', 'embedSvgs'));
  gutil.log(gutil.colors.green.bold.underline('Hlídám změnu v souborech ...'));  
}));