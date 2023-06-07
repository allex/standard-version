#!/usr/bin/env node

/* istanbul ignore if */
if (process.version.match(/v(\d+)\./)[1] < 12) {
  console.error('standard-version: Node v12 or greater is required. `standard-version` did not run.')
} else {
  const standardVersion = require('../index')
  const cmdParser = require('../command')
  standardVersion(cmdParser.argv)
    .catch(() => {
      process.exit(1)
    })
}
