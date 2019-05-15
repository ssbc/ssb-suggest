# ssb-suggest

### Background

When writing messages in Scuttlebutt, sometimes you may want to mention another user, but how does that work? In most ssb-clients which use markdown, one would need to have a hyperlink that wraps their ssb key in a link like so:

```
Hey [@corlock](@sHFNLAao6phQ5AN17ecYNUbszDa4Qf6DhyQsjtQfdmY=.ed25519)! How are you?
```

However, chances are you only know the person's alias (what you call them, or what they call themselves), and not their feedId.

This plugin provides a way to suggest SSB users (with avatar, alias, feedId, etc) based on a query text for an alias. The primary use of this plugin is for auto-suggest in scuttlebutt clients, so when a user starts typing "@cor" in a message, they will be prompted with a visual list of suggestions that can be auto-completed to a functioning @-mention in ssb markdown.


### Usage
`ssb-suggest` is a plugin for `ssb-server`. For documentation on how plugins work in Scuttlebutt, see [here](https://github.com/ssbc/secret-stack/blob/master/PLUGINS.md).


Requires other plugins :
- `ssb-backlinks`,
- `ssb-about`
- EITHER `ssb-friends` OR patchwork!

This module was extracted from patchwork, originally written by Matt Mckegg

## Example usage

```js
var Server = require('ssb-server')
  .use(require('ssb-server/plugins/master'))
  .use(require('ssb-suggest'))

var Config = require('ssb-config')

var server = Server(Config()) // just use default config

server.suggest.profile({ text: 'mi' }, (err, matches) => {
  if (err) console.log('OH no!', err)

  // do something with matches
})
```

## API

### SSB Plugin API

Adhering to the [secret-stack plugin format](https://github.com/ssbc/secret-stack/blob/master/PLUGINS.md#plugin-format), this module exposes the following standard plugin exports as an object with properties:

- `name` (string)
- `version` (string)
- `init` (function)
- `manifest` (object)


### `server.suggest` API

When used as illustrated [above](#example-usage), the plugin's `init` function is executed under the hood, and the returned object (as specified in the `manifest` object) is set as the value for `server.suggest`.

#### `server.suggest.profile(opts, cb)`

`opts` is an Object with properties:
- `text` (optional), the text you're searching profiles names by. If not provided, then, falls back to offering `defaultIds` (if provided) or a sample of the most recent message authors.
- `defaultIds` (optional, default=[]), an array of feedIds that are important in the current context. They could be people present in the current thread for example. These will be fallback matches, but also be prioritised in any matches to `text`.
- `limit` (optional), how many results you want back _Default: 20_


- `cb` is a callback with signature `(err, matches)` where `matches` is an Array of objects of form:
```js
{
  id: FeedId,
  matchedName: String, // the name your search matched (within name / names)
  name: String, // the name you know this person by
  names: Array, // the names people you follow have given this person
  image: Blob,
  following: Boolean // whether you currently follow them
}
```
