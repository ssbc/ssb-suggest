var parallel = require('run-parallel')

// extracted from patchwork.profile.avatar

module.exports = function (ssb) {
  return function profileAvatar ({ id }, cb) {
    var result = { id }

    parallel(
      [
        (done) => {
          ssb.about.socialValue({ dest: id, key: 'name' }, (err, value) => {
            if (err) return done(err)
            result['name'] = value
            done()
          })
        },
        // TODO - add all the other names too!
        (done) => {
          ssb.about.socialValue({ dest: id, key: 'image' }, (err, value) => {
            if (err) return done(err)
            if (value && value instanceof Object && value.link) value = value.link
            result['image'] = value
            done()
          })
        }
      ],
      (err) => {
        if (err) return cb(err)
        cb(null, result)
      }
    )
  }
}
