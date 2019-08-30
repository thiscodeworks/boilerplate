var
  path = require('path'),
  fs = require('fs'),
  gulp = require('gulp'),
  gutil = require('gulp-util'),
  notify = require('gulp-notify'),
  plumber = require('gulp-plumber'),
  watch = require('gulp-watch'),
  sass = require('gulp-sass'),
  sassGlob = require('gulp-sass-glob'),
  rename = require('gulp-rename'),
  jshint = require('gulp-jshint'),
  concat = require('gulp-concat'),
  uglify = require('gulp-uglify'),
  uglifycss = require('gulp-uglifycss'),
  gulpif = require('gulp-if'),
  cache = require('gulp-cached'),
  header = require('gulp-header'),
  sourcemaps = require('gulp-sourcemaps'),
  svgSymbols = require('gulp-svg-symbols'),
  embedSvg = require('gulp-embed-svg'),
  hogan = require('gulp-hogan'),
  moment = require('moment'),
  streamqueue = require('streamqueue'),
  imagemin = require('gulp-imagemin'),
  browserSync = require('browser-sync').create(),
  pkg = require('./package.json'),
  build = require('./build/build.json');


banner = ['/**',
  ' * <%= pkg.name %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @author <%= pkg.author %>',
  ' * @builded ' + moment().format("LLLL"),
  ' */\n',
  ''
].join('\n');


gulp.task('pages', function() {
  return gulp
    .src(build.core.path.pages + '/*.hjs')
    .pipe(hogan({}, null, '.html'))
    .pipe(rename({
      extname: '.html'
    }))
    .pipe(gulp.dest('./dist'))
    .on('end', function() {
      gutil.log('Stránky vygenerovány')
    });
});

gulp.task('styles-build', function() {
  return gulp
    .src(build.core.path.styles + '/main.scss')
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
      compress: true
    }))
    .pipe(uglifycss({
      "maxLineLen": 80,
      "uglyComments": true
    }))
    .pipe(concat('styles.css'))
    .pipe(header(banner, {
      pkg: pkg
    }))
    .pipe(gulp.dest(build.core.dist.styles));
});

gulp.task('styles', function() {
  return gulp
    .src(build.core.path.styles + '/main.scss')
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
      compress: true
    }))
    .pipe(uglifycss({
      "maxLineLen": 80,
      "uglyComments": true
    }))
    .pipe(concat('styles.css'))
    .pipe(header(banner, {
      pkg: pkg
    }))
    //.pipe(sourcemaps.write(build.core.path.assets))
    .pipe(gulp.dest(build.core.dist.styles));
});

gulp.task('scripts', function() {

  var libraries = require(build.core.path.scripts + '/libraries.json');
  var scripts = require(build.core.path.scripts + '/scripts.json');

  return streamqueue({
        objectMode: true
      },
      gulp.src(libraries),
      gulp.src(scripts)
    )
    .pipe(plumber({
      errorHandler: notify.onError('Chyba v javascriptu: <%= error %>')
    }))
    .pipe(jshint())      
    .pipe(uglify()).on("error", function(err) {
      notify.onError('Chyba v javascriptu: ' + err.cause)
    })
    .pipe(concat('index.js'))
    .pipe(header(banner, {
      pkg: pkg
    }))
    .pipe(gulp.dest(build.core.dist.scripts));
});

gulp.task('copy', function() {
  return gulp
    .src(build.core.path.assets+"/**", {
      allowEmpty: true
    })
    .pipe(imagemin([
      imagemin.gifsicle({
        interlaced: true
      }),
      imagemin.jpegtran({
        progressive: true
      }),
      imagemin.optipng({
        optimizationLevel: 5
      }),
      imagemin.svgo({
        plugins: [{
            removeUselessStrokeAndFill: true,
            cleanupIDs: true,
            removeEmptyAttrs: true,
            cleanupAttrs: true,
            removeViewBox: true
          },
          {
            cleanupIDs: false
          }
        ]
      })
    ]))
    .pipe(cache('copy'))
    .pipe(gulp.dest(build.core.dist.assets))
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
  return gulp.src(build.core.path.assets + '/symbols/*.svg')
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

  gulp.src("src/core/styles/helpers/svg-symbols.scss", {
      allowEmpty: true
    })
    .pipe(rename("src/core/styles/helpers/_icons.scss"))
    .pipe(gulp.dest("src/core/styles/helpers/"));

  gulp.src("dist/assets/svg-symbols.svg", {
      allowEmpty: true
    })
    .pipe(rename("src/pages/partials/icons.hjs"))
    .pipe(gulp.dest("src/pages/partials/"));

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

gulp.task('watch', gulp.series('browser-sync', 'build', function() {
  gulp.watch([path.join(build.core.path.pages, '*.hjs'), path.join(build.core.path.pages, '/**/*.hjs')], gulp.series('pages')).on('change', browserSync.reload);
  gulp.watch(build.core.path.styles + '/**/*.scss', gulp.series('styles')).on('change', browserSync.reload);
  gulp.watch(build.core.path.scripts + "/*.js", gulp.series('scripts')).on('change', browserSync.reload);
  gulp.watch(build.core.path.assets + "/**", gulp.series('copy'));
  gulp.watch(build.core.path.assets + "/symbols/*.svg", gulp.series('sprites-svg', 'sprites-sass', 'embedSvgs'));
  gutil.log(gutil.colors.green.bold.underline('Hlídám změnu v souborech ...'));    
}));