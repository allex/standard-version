const chalk = require('chalk')
const checkpoint = require('../checkpoint')
const conventionalChangelog = require('conventional-changelog')
const fs = require('fs')
const presetLoader = require('../preset-loader')
const runLifecycleScript = require('../run-lifecycle-script')
const writeFile = require('../write-file')
const START_OF_LAST_RELEASE_PATTERN = /(^#+ \[?[0-9]+\.[0-9]+\.[0-9]+|<a name=)/m
const semverValid = require('semver').valid
const debugLog = require('../debuglog').debugLog

const reUnstableTag = /.+-(\w+\.)?\d+$/

async function Changelog (args, newVersion) {
  if (args.skip.changelog) return
  await runLifecycleScript(args, 'prechangelog')
  await outputChangelog(args, newVersion)
  await runLifecycleScript(args, 'postchangelog')
}

Changelog.START_OF_LAST_RELEASE_PATTERN = START_OF_LAST_RELEASE_PATTERN

module.exports = Changelog

function outputChangelog (args, newVersion) {
  return new Promise((resolve, reject) => {
    createIfMissing(args)
    const header = args.header

    let oldContent = args.dryRun ? '' : fs.readFileSync(args.infile, 'utf-8')
    const oldContentStart = oldContent.search(START_OF_LAST_RELEASE_PATTERN)
    // find the position of the last release and remove header:
    if (oldContentStart !== -1) {
      oldContent = oldContent.substring(oldContentStart)
    }
    let content = ''
    const context = { version: newVersion }
    /*
    conventionalChangelog(
      options?: Options<TCommit, TContext>,
      context?: Partial<TContext>,
      gitRawCommitsOpts?: GitRawCommitsOptions,
      parserOpts?: ParserOptions,
      writerOpts?: WriterOptions<TCommit, TContext>
    ): Stream.Readable;
    */
    const changelogStream = conventionalChangelog(
      {
        debug: args.verbose && console.info.bind(console, 'conventional-changelog'),
        preset: presetLoader(args),
        tagPrefix: args.tagPrefix,
        releaseCount: 1,
        skipUnstable:  args.skipUnstable,
      },
      context,
      {
        merges: null,
        path: args.path,
        from: args.fromVersion,
        debug: debugLog,
      },
      {},
      {
        /**
         * @ref conventionalChangelogWriter.Options.GenerateOn<conventionalChangelogCore.MergedContext<conventionalChangelogWriter.Context>, Commit<string | number | symbol>>
         * @default generateOn (commit) {
         *    return semverValid(commit.version)
         *  }
         */
        generateOn(keyCommit, commits, context, options) {
          const ver = keyCommit.version
          // skip unstable tags when not prerelease mode
          if (!semverValid(ver)) {
            return false
          }
          if (args.skipUnstable && reUnstableTag.test(ver)) {
            keyCommit.version = null
            return false
          }
          return true
        },
        debug: debugLog,
      }
    )
      .on('error', function (err) {
        return reject(err)
      })

    changelogStream.on('data', function (buffer) {
      content += buffer.toString()
    })

    changelogStream.on('end', function () {
      checkpoint(args, 'outputting changes to %s', [args.infile])
      if (args.dryRun) console.info(`\n---\n${chalk.gray(content.trim())}\n---\n`)
      else writeFile(args, args.infile, header + '\n' + (content + oldContent).replace(/\n+$/, '\n'))
      return resolve()
    })
  })
}

function createIfMissing (args) {
  try {
    fs.accessSync(args.infile, fs.F_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      checkpoint(args, 'created %s', [args.infile])
      args.outputUnreleased = true
      writeFile(args, args.infile, '\n')
    }
  }
}
