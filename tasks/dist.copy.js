'use strict';
const merge = require('merge-stream');

// ------------------------------------------------
//   Task: Copy all deployment files to Dist folder
// ------------------------------------------------

module.exports = function(gulp) {
    return function() {
        var publicFiles = gulp.src(['public/**/*.*', '!public/bower_components/**/*', '!public/test/**/*']).pipe(gulp.dest('./dist/public'));
        var server = gulp.src(['server/**/*.*']).pipe(gulp.dest('./dist/server'));
        var packageFile = gulp.src(['package.json', 'bower.json', '.bowerrc']).pipe(gulp.dest('dist'));

        return merge(publicFiles, server, packageFile);
    };
};
