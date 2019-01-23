var pull = require('pull-stream')
var Paramap = require('pull-paramap')
var merge = require('lodash.merge')

var profileAvatar = require('./lib/avatar')
var startsWith = require('./lib/starts-with')
var watch = require('./lib/watch')

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
  setTimeout(() => watch.follows(ssb, state), 3e3)
  setTimeout(() => watch.newAbouts(ssb, state), 5e3)
  setTimeout(() => watch.recentAuthors(ssb, state), 10e3)

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
      defaultIds = Array.from(new Set(defaultIds)) // uniq!
        .filter(feedId => feedId !== ssb.id) // not me

      update(defaultIds.filter(id => !state.suggestCache[id]), function (err) {
        if (err) return cb(err)

        if (typeof text === 'string' && text.trim().length) {
          let matches = getMatches(state.suggestCache, text)
          let result = sort(text, matches, defaultIds, state.recentAuthors, state.following)
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
          let result = defaultIds
            .map(id => state.suggestCache[id])
            .filter(Boolean)
            .map(x => merge(x, { following: state.following.has(x.id) }))

          cb(null, result)
        } else {
          let result = state.recentAuthors.slice(-(limit || 20)).reverse()

          result = result
            .map(feedId => state.suggestCache[feedId])
            .filter(Boolean)
            .map(x => merge(x, { following: state.following.has(x.id) }))

          cb(null, result)
        }
      })
    }
  }
}

function sort (text, matches, defaultItems, recentAuthors, following) {
  return matches
    .sort((a, b) => {
      return compareBool(defaultItems.includes(a.avatar.id), defaultItems.includes(b.avatar.id)) ||
             compareBool(recentAuthors.includes(a.avatar.id), recentAuthors.includes(b.avatar.id)) ||
             compareBool(following.has(a.avatar.id), following.has(b.avatar.id)) ||
             a.name.length - b.name.length
    })

    // for each person, bubble up the option where the match.name is the best match to search
    .sort((a, b) => {
      if (a.avatar.id !== b.avatar.id) return 0
      return compareBool(~a.name.indexOf(text), ~b.name.indexOf(text))
    })

    // drop any duplicates of particular identities
    .reduce((soFar, match) => {
      if (soFar.every(m => m.avatar.id !== match.avatar.id)) {
        soFar.push(match)
      }
      return soFar
    }, [])

    // push tombstones accounts to the bottom
    // TODO replace once we have tombstones
    .sort((a, b) => compareBool(!isDead(a), !isDead(b)))
}

function isDead (match) {
  return match.avatar.name.startsWith('deprecated') ||
    match.avatar.name.startsWith('dead') ||
    match.avatar.names.find(name => name.startsWith('deprecated')) ||
    match.avatar.names.find(name => name.startsWith('dead'))
}

function compareBool (a, b) {
  if (a === b) return 0
  if (a) return -1
  return 1
}

function getMatches (cache, text) {
  var matches = []
  var values = Object.values(cache)

  values.forEach((avatar) => {
    if (typeof avatar.name === 'string' && startsWith(avatar.name, text)) {
      const aliases = new Set(avatar.names)
      aliases.delete(avatar.name)
      matches.push({ name: avatar.name, avatar })
    }
  })
  values.forEach((avatar) => {
    if (!Array.isArray(avatar.names)) return

    avatar.names
      .filter(name => name !== avatar.name && startsWith(name, text))
      .forEach(alias => {
        matches.push({ name: alias, avatar })
      })
  })
  return Object.values(matches)
}
