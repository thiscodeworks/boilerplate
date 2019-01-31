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
  livereload = require('gulp-livereload'),
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
  lr = require('tiny-lr')(),
  server = express(),

  STATIC_PORT = 9021,
  LR_PORT = 35729,
  PROD = args.p || process.env.NODE_ENV && process.env.NODE_ENV.match(/prod/),
  DEV = args.d || false,
  FORCE = args.f || false,

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
    .src(build.pages)
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
    .pipe(sourcemaps.write(build.core.assets))
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
      errorHandler: notify.onError('Chyba ve javascriptu: <%= error.message %>')
    }))
    .pipe(jshint())
    .pipe(jshintError())
    .pipe(gulpif(!DEV, uglify()))
    .pipe(header(banner))
    .pipe(concat('index.js'))
    .pipe(gulp.dest(build.core.dist.scripts));
});

gulp.task('copy', function() {
  return gulp
    .src(build.core.assets)
    .pipe(cache('copy'))
    .pipe(gulp.dest(build.core.dist.assets))
});

gulp.task('clean', function(done) {
  del([path.join(build.core.dist.base, '/**/*')], done);
});

gulp.task('staticServer', function(done) {
  server.use(connectLivereload());
  server.use(express.static(path.join(__dirname, build.core.dist.base)));

  server.listen(STATIC_PORT, function() {
    gutil.log('Server poslouchá na portu: ', gutil.colors.magenta(STATIC_PORT));

    done();
  });
});

gulp.task('lrServer', function(done) {
  lr.listen(LR_PORT, function() {
    gutil.log('Livereload server poslouchá na portu: ', gutil.colors.magenta(LR_PORT));

    done();
  });
});

gulp.task('sprites-svg', function () {
  return gulp.src('src/core/img/symbols/*.svg')
    .pipe(svgSymbols({
        templates: [
          `default-svg`,
          `default-demo`          
        ],
      }))
    .pipe(gulp.dest('dist/assets'));
});

gulp.task('sprites-sass', function () {  
  gulp.src('src/core/img/symbols/*.svg')
    .pipe(svgSymbols({
        templates: [
          `default-sass`          
        ],
      }))
    .pipe(gulp.dest('src/core/styles/helpers'));
  gutil.log('Symboly vygenerovány'); 
  gulp.src("src/core/styles/helpers/svg-symbols.scss")
    .pipe(rename("src/core/styles/helpers/_icons.scss"))
    .pipe(gulp.dest(""));    
  gulp.src("dist/assets/svg-symbols.svg")
    .pipe(rename("src/components/icons/index.hjs"))
    .pipe(gulp.dest(""));  
  gutil.log('Přejmenovány symboly na ikony.'); 
  return;
});

gulp.task('embedSvgs', function() {
  return gulp.src('dist/*.html')
    .pipe(embedSvg({
      selectors: '.inline-svg',
      root: 'dist'
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('build', ['pages', 'styles', 'scripts', 'sprites-svg','sprites-sass', 'copy', 'embedSvgs']);
gulp.task('build-production', ['pages', 'styles-build', 'scripts', 'sprites-svg','sprites-sass', 'copy', 'embedSvgs']);

gulp.task('watch', ['staticServer', 'lrServer', 'build'], function() {

  if (args.o) {
    var filename = 'index.html',
      host = args.e ? 'http://0.0.0.0:' : 'http://localhost:';

    if (typeof args.o === 'string' && fs.existsSync(path.join(build.core.dist.base, args.o))) {
      filename = args.o;
    }

    gutil.log('Otevírám soubor:', gutil.colors.magenta(filename));

    gulp.src(path.join(build.core.dist.base, filename))
      .pipe(open('', {
        url: path.join(host + STATIC_PORT, filename)
      }));
  }

  function reload(task) {

    return function(file) {
      return gulp
        .start(task, function() {
          var filename = path.relative(__dirname, file.path);
          gutil.log('Změna v souboru', gutil.colors.magenta(path.relative(__dirname, file.path)));

          lr.changed({
            body: {
              files: gutil.replaceExtension(path.basename(file.path), '')
            }
          });
        });
    }
  }

  gulp.start(function() {

    gulp.watch([
      build.pages,
      path.join(build.core.path.components, '**/*.hjs')
    ], reload('pages'));
  
    gulp.watch("src/core/styles/**/*.scss", reload('styles'));

    gulp.watch(build.core.scripts.app, reload('scripts'));
    
    gulp.watch("src/core/img/**", reload('copy'));
    
    gulp.watch("src/core/img/symbols/*.svg", reload(['sprites-svg','sprites-sass','embedSvgs']));

    gutil.log(gutil.colors.green.bold.underline('Hlídám změnu v souborech ...'));
  });
});

gulp.task('default', ['clean'], function() {
  return gulp.start(
    'build',
    function() {
      gulp.src('./', {
          read: false
        })
        .pipe(notify('Build Success ✔'));      
    }
  );
});
