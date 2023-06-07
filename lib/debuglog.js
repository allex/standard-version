const util = require('util')
const pkg = require('../package.json')

exports.debugLog = util.debuglog(pkg.name)
