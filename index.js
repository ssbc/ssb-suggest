var pull = require('pull-stream')
var ref = require('ssb-ref')
var Paramap = require('pull-paramap')
var pullCat = require('pull-cat')
var merge = require('lodash.merge')

var profileAvatar = require('./lib/avatar')
var startsWith = require('./lib/starts-with')

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
    recentAuthors: []
  }

  var avatar = ssb.patchwork ? ssb.patchwork.profile.avatar : profileAvatar(ssb, state)

  // start update loop after 5 seconds
  setTimeout(updateLoop, 5e3)
  setTimeout(() => watchNewAbouts(ssb, state), 5e3)
  setTimeout(() => watchRecentAuthors(ssb, state), 10e3)
  setTimeout(() => loadFollows(ssb, state), 5)

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
          let result = sort(matches, defaultIds, state.recentAuthors, state.following)
          if (limit) {
            result = result.slice(0, limit)
          }

          result = result
            .map(match => merge(
              match.avatar,
              { matchedName: match.name },
              { following: state.following.has(match.avatar.id) } // add following attribute
            ))

          cb(null, result)
        } else if (defaultIds && defaultIds.length) {
          cb(null, defaultIds.map(id => state.suggestCache[id]))
        } else {
          let result = state.recentAuthors.slice(-(limit || 20)).reverse()
            .map(feedId => state.suggestCache[feedId])
            .map(x => merge(x, { following: state.following.has(x.id) }))
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
  const howFarBack = 300

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

      // update recent authors
      var index = state.recentAuthors.indexOf(author)
      if (~index) state.recentAuthors.splice(index, 1) // pop from current position
      state.recentAuthors.push(author) // add to end
    })
  )
}

function loadFollows (ssb, state) {
  if (ssb.patchwork && ssb.patchwork.contacts) {
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
  } else if (ssb.friends) {
    pull(
      ssb.friends.hopStream({ live: true, old: true }),
      pull.filter(d => !d.sync),
      pull.drain(d => {
        Object.keys(d)
          .filter(feedId => d[feedId] >= 0 && d[feedId] <= 1) // friends of friends
          .forEach(feedId => {
            state.following.add(feedId)
            state.updateQueue.add(feedId)
          })
      }, () => console.log('!!! hopStream ended !!!'))
    )
  }
}

function sort (matches, defaultItems, recentAuthors, following) {
  return matches
    .sort((a, b) => {
      return compareBool(defaultItems.includes(a.avatar.id), defaultItems.includes(b.avatar.id)) ||
             compareBool(recentAuthors.includes(a.avatar.id), recentAuthors.includes(b.avatar.id)) ||
             compareBool(following.has(a.avatar.id), following.has(b.avatar.id)) ||
             a.match.length - b.match.length
    })
    .reduce((soFar, match) => {
      if (soFar.every(m => m.avatar.id !== match.avatar.id)) {
        soFar.push(match)
      }
      return soFar
    }, [])
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
  var matches = []
  var values = Object.values(cache)

  values.forEach((avatar) => {
    if (typeof avatar.name === 'string' && startsWith(avatar.name, text)) {
      const aliases = new Set(avatar.names)
      aliases.delete(avatar.name)
      matches.push({ match: avatar.name, avatar })
    }
  })
  values.forEach((avatar) => {
    if (!Array.isArray(avatar.names)) return

    avatar.names
      .filter(name => name !== avatar.name && startsWith(name, text))
      .forEach(alias => {
        matches.push({ match: alias, avatar })
      })
  })
  return Object.values(matches)
}
