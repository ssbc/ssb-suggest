var pull = require('pull-stream')
var ref = require('ssb-ref')
var Paramap = require('pull-paramap')
var pullCat = require('pull-cat')
var merge = require('lodash.merge')

var profileAvatar = require('./lib/avatar')

var collator = new Intl.Collator('default', { sensitivity: 'base', usage: 'search' })

exports.name = 'suggest'
exports.version = require('./package.json').version
exports.manifest = {
  profile: 'async'
}

exports.init = function (ssb, config) {
  var state = {
    suggestCache: {},
    updateQueue: new Set(),
    following: new Set(),
    recentFriends: []
  }

  var avatar = ssb.patchwork ? ssb.patchwork.profile.avatar : profileAvatar(ssb)

  // start update loop after 5 seconds
  setTimeout(updateLoop, 5e3)
  setTimeout(() => watchNewAbouts(ssb, state), 5e3)
  setTimeout(() => watchRecentAuthors(ssb, state), 10e3)

  // TODO - re-enable this
  if (ssb.patchwork) {
    setTimeout(() => {
      // use the public friend states for suggestions (not private)
      // so that we can find friends that we can still find ignored friends (privately blocked)
      pull(
        ssb.patchwork.contacts.stateStream({ live: true, feedId: ssb.id }),
        pull.drain(states => {
          Object.keys(states).forEach(key => {
            if (states[key] === true) {
              state.following.add(key)
              state.updateQueue.add(key)
            } else {
              state.following.delete(key)
            }
          })
        })
      )

      // TODO - add existing friends, e.g. run this source:
      // ssb.patchwork.contacts.stateStream({ reverse: true, feedId: ssb.id }),
    }, 5)
  }
  if (ssb.friends) {
    setTimeout(() => {
      pull(
        ssb.friends.hopStream(),
        pull.filter(d => !d.sync),
        pull.drain(d => {
          Object.keys(d)
            .filter(feedId => d[feedId] >= 0 && d[feedId] <= 2) // friends of friends
            .forEach(feedId => state.updateQueue.add(feedId))
            .filter(feedId => d[feedId] === 1) // friends of friends
            .forEach(feedId => state.following.add(feedId))
        })
      )
    }, 5)
  }

  function updateLoop () {
    if (state.updateQueue.size) {
      var ids = Array.from(state.updateQueue)
      state.updateQueue.clear()
      update(ids, () => {
        if (state.updateQueue.size) {
          updateLoop()
        } else {
          setTimeout(updateLoop, 10e3)
        }
      })
    } else {
      setTimeout(updateLoop, 10e3)
    }
  }

  function update (ids, cb) {
    if (!Array.isArray(ids)) return cb()
    if (!ids.length) return cb()

    pull(
      pull.values(ids),
      Paramap((id, cb) => avatar({ id }, cb), 10),
      pull.drain(
        item => {
          state.suggestCache[item.id] = item
        },
        cb
      )
    )
  }

  return {
    profile: function suggestProfile ({ text, limit, defaultIds = [] }, cb) {
      update(defaultIds.filter(id => !state.suggestCache[id]), function (err) {
        if (err) return cb(err)

        if (typeof text === 'string' && text.trim().length) {
          let matches = getMatches(state.suggestCache, text)
          let result = sort(matches, defaultIds, state.recentFriends, state.following)
          if (limit) {
            result = result.slice(0, limit)
          }

          // add following attribute
          result = result.map(x => merge(x, { following: state.following.has(x.id) }))

          cb(null, result)
        } else if (defaultIds && defaultIds.length) {
          cb(null, defaultIds.map(id => state.suggestCache[id]))
        } else {
          let ids = state.recentFriends.slice(-(limit || 20)).reverse()
          let result = ids.map(id => state.suggestCache[id])
          result = result.map(x => merge(x, { following: state.following.has(x.id) }))
          cb(null, result)
        }
      })
    }
  }
}

function watchNewAbouts (ssb, state) {
  pull(
    ssb.backlinks.read({
      live: true,
      old: false,
      query: [{ $filter: {
        dest: { $prefix: '@' },
        value: { content: { type: 'about' } }
      } }]
    }),
    pull.filter(msg => !msg.sync),
    pull.filter(msg => {
      // TODO schema validation!
      return ref.isFeedId(msg.value.content.about) &&
        (typeof msg.value.content.name === 'string' || msg.value.content.image)
    }),
    pull.drain(msg => {
      state.updateQueue.add(msg.value.content.about)
    })
  )
}

function watchRecentAuthors (ssb, state) {
  const howFarBack = 1000

  pull(
    pullCat([
      ssb.createLogStream({ reverse: true, limit: howFarBack }),
      ssb.createLogStream({ old: false })
    ]),
    pull.map(msg => msg.value.author),
    pull.drain(author => {
      if (!state.suggestCache[author]) {
        state.updateQueue.add(author)
      }

      // update recent friends
      if (state.following.has(author)) {
        var index = state.recentFriends.indexOf(author)
        if (~index) {
          state.recentFriends.splice(index, 1)
        }
        state.recentFriends.push(author)
      }
    })
  )
}

function sort (items, defaultItems, recentFriends, following) {
  return items.sort((a, b) => {
    return compareBool(defaultItems.includes(a.id), defaultItems.includes(b.id)) ||
           compareBool(recentFriends.includes(a.id), recentFriends.includes(b.id)) ||
           compareBool(following.has(a.id), following.has(b.id)) ||
           a.name.length - b.name.length
  })
}

function compareBool (a, b) {
  if (a === b) {
    return 0
  } else if (a) {
    return -1
  } else {
    return 1
  }
}

function getMatches (cache, text) {
  var result = []
  var values = Object.values(cache)

  values.forEach((item) => {
    if (typeof item.name === 'string' && startsWith(item.name, text)) {
      result.push(item)
    }
  })
  return result
}

function startsWith (text, startsWith) {
  return collator.compare(text.slice(0, startsWith.length), startsWith) === 0
}
