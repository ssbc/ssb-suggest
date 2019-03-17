var pull = require('pull-stream')
var ref = require('ssb-ref')
var pullCat = require('pull-cat')

module.exports = {
  newAbouts,
  recentAuthors,
  follows
}

function follows (ssb, state) {
  if (state.quiting) return
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
          .filter(feedId => d[feedId] >= 0 && d[feedId] <= 1) // just people I follow
          .forEach(feedId => {
            state.following.add(feedId)
            state.updateQueue.add(feedId)
          })
      }, () => console.log('!!! hopStream ended !!!'))
    )
  }
}

function newAbouts (ssb, state) {
  if (state.quiting) return

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

function recentAuthors (ssb, state) {
  if (state.quiting) return
  const howFarBack = 300

  pull(
    pullCat([
      ssb.createLogStream({ reverse: true, limit: howFarBack }),
      ssb.createLogStream({ live: true, old: false })
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
