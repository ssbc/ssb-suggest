var parallel = require('run-parallel')

// extracted from patchwork.profile.avatar

module.exports = function (ssb, state) {
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
        (done) => {
          ssb.about.socialValues({ dest: id, key: 'name' }, (err, namesByPeer) => {
            if (err) return done(err)

            result['names'] = Object.keys(namesByPeer)
              .filter(peer => state.following.has(peer))
              .map(peer => namesByPeer[peer])
              .reduce((soFar, name) => {
                if (!soFar.includes(name)) soFar.push(name)
                return soFar
              }, [])
            done()
          })
        },
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
