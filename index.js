"use strict";

const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const io = require('@actions/io');
const path = require('path');
const toolrunner = require('@actions/exec/lib/toolrunner');
const util = require('util');

const CMakeApiClientName = "client-msvc-ca-action";
const RelativeRulesetPath = '..\\..\\..\\..\\..\\..\\..\\Team Tools\\Static Analysis Tools\\Rule Sets';

/**
 * Validate if the given directory both exists and is non-empty.
 * @returns Promise<string> true if the directory is empty
 */
function isDirectoryEmpty(buildRoot) {
  return !buildRoot || !fs.existsSync(buildRoot) || (fs.readdirSync(buildRoot).length) == 0;
}

/**
 * Validate and resolve action input path by making non-absolute paths relative to
 * GitHub repository root.
 * @param {*} input name of GitHub action input variable
 * @param {*} required if true the input must be non-empty
 * @returns the absolute path to the input path if specified.
 */
function resolveInputPath(input, required = false) {
  let inputPath = core.getInput(input);
  if (!inputPath) {
    if (required) {
      throw new Error(input + " input path can not be empty.");
    }
  }

  if (!path.isAbsolute(inputPath)) {
    // make path relative to the repo root if not absolute
    inputPath = path.join(process.env.GITHUB_WORKSPACE, inputPath);
  }

  return inputPath;
}

/**
 * Helper for iterating over object properties that may not exist
 * @param {*} object object with given optional property
 * @param {*} property property name
 * @returns iterable if exists, otherwise empty array.
 */
function iterateIfExists(object, property) {
  return object && object.hasOwnProperty(property) ? object[property] : [];
}

function createSarifFilepath(resultsDir, source, analyzeIndex) {
  const filename = `${path.basename(source)}.${analyzeIndex}.sarif`;
  return path.join(resultsDir, filename);
}

/**
 * Create a query file for the CMake API
 * @param {*} apiDir CMake API directory '.cmake/api/v1', will be creating if non-existent
 */
async function createApiQuery(apiDir) {
  const queryDir = path.join(apiDir, "query", CMakeApiClientName);
  if (!fs.existsSync(queryDir)) {
    await io.mkdirP(queryDir);
  }

  const queryFile = path.join(queryDir, "query.json");
  const queryData = {
    "requests": [
      { kind: "cache", version: 2 },
      { kind: "codemodel", version: 2 },
      { kind: "toolchains", version: 1 }
  ]};

  try {
    fs.writeFileSync(queryFile, JSON.stringify(queryData), 'utf-8');
  } catch (err) {
    throw new Error("Failed to write query.json file for CMake API.", err);
  }
}

/**
 * Read and parse json reply file
 * @param {*} replyFile Absolute path to json reply
 * @returns Parsed json data of the reply file
 */
function parseReplyFile(replyFile) {
  if (!fs.existsSync(replyFile)) {
    throw new Error("Failed to find CMake API reply file: " + replyFile);
  }

  let jsonData = fs.readFileSync(replyFile, (err) => {
    if (err) {
      throw new Error("Failed to read CMake API reply file: " + replyFile, err);
    }
  });

  return JSON.parse(jsonData);
}

function getResponseFilepath(replyDir, indexReply, kind) {
  const clientResponses = indexReply.reply[CMakeApiClientName]["query.json"].responses;
  const response = clientResponses.find((response) => response["kind"] == kind);
  return response ? path.join(replyDir, response.jsonFile) : null;
}

function ReplyIndexInfo(replyDir, indexReply) {
  this.version = indexReply.cmake.version.string;
  this.cacheResponseFile = getResponseFilepath(replyDir, indexReply, "cache");
  this.codemodelResponseFile = getResponseFilepath(replyDir, indexReply, "codemodel");
  this.toolchainsResponseFile = getResponseFilepath(replyDir, indexReply, "toolchains");
}

/**
 * Load the information needed from the reply index file for the CMake API
 * @param {*} apiDir CMake API directory '.cmake/api/v1'
 * @returns ReplyIndexInfo info extracted from json
 */
function getApiReplyIndex(apiDir) {
  const replyDir = path.join(apiDir, "reply");

  let indexFilepath;
  if (fs.existsSync(replyDir)) {
    for (const filename of fs.readdirSync(replyDir)) {
      if (filename.startsWith("index-")) {
        // Get the most recent index query file (ordered lexicographically)
        const filepath = path.join(replyDir, filename);
        if (!indexFilepath || filepath > indexFilepath) {
          indexFilepath = filepath;
        }
      };
    }
  }

  if (!indexFilepath) {
    throw new Error("Failed to find CMake API index reply file.");
  }

  const indexReply = parseReplyFile(indexFilepath);
  const replyIndexInfo = new ReplyIndexInfo(replyDir, indexReply);

  core.info(`Loaded index reply with CMake version ${indexReply.cmake.version.string}`);

  return replyIndexInfo;
}

/**
   * Create a query to the CMake API of an existing already configured CMake project. This will:
   *  - Read existing default reply data to find CMake
   *  - Create a query file for all data needed
   *  - Re-run CMake config to generated reply data
   *  - TODO: ...
   * 
   * loadApi is required to call any other methods on this class.
   * @param {*} buildRoot directory of CMake build
   */
async function loadCMakeApiReplies(buildRoot) {
  if (isDirectoryEmpty(buildRoot)) {
    throw new Error("CMake build root must exist, be non-empty and be configured with CMake");
  }

  // validate CMake is findable on the path
  await io.which("cmake", true);

  // create CMake api query file for the generation of replies needed
  const apiDir = path.join(buildRoot, ".cmake/api/v1");
  await createApiQuery(apiDir);

  // regenerate CMake build directory to acquire CMake file API reply
  const exitCode = await exec.exec("cmake", [ buildRoot ])
  if (exitCode != 0) {
    throw new Error(`CMake failed to run with non-zero exit code: ${exitCode}`);
  }

  // load reply index generated from the CMake Api
  const replyIndexInfo = getApiReplyIndex(apiDir);
  if (replyIndexInfo.version < "3.20.5") {
    throw new Error("Action requires CMake version >= 3.20.5");
  }

  return replyIndexInfo;
}

function IncludePath(path, isSystem) {
  this.path = path;
  this.isSystem = isSystem;
}

function ToolchainInfo(toolchain) {
  this.language = toolchain.language;
  this.path = toolchain.compiler.path;
  this.version = toolchain.compiler.version;
  this.includes = [];
  for (const include of toolchain.compiler.implicit.includeDirectories) {
    this.includes.push(new IncludePath(include, true));
  }
}

/**
 * 
 * @param {*} replyIndexInfo 
 * @returns 
 */
function loadToolchainMap(replyIndexInfo) {
  if (!fs.existsSync(replyIndexInfo.toolchainsResponseFile)) {
    throw new Error("Failed to load toolchains response from CMake API");
  }

  const toolchainMap = {};
  const toolchains = parseReplyFile(replyIndexInfo.toolchainsResponseFile);
  const cToolchain = toolchains.toolchains.find(
    (t) => t.language == "C" && t.compiler.id == "MSVC");
  if (cToolchain) {
    toolchainMap[cToolchain.language] = new ToolchainInfo(cToolchain);
  }

  const cxxToolchain = toolchains.toolchains.find(
    (t) => t.language == "CXX" && t.compiler.id == "MSVC");
  if (cxxToolchain) {
    toolchainMap[cxxToolchain.language] = new ToolchainInfo(cxxToolchain);
  }


  if (Object.keys(toolchainMap).length === 0) {
    throw new Error("Action requires use of MSVC for either/both C or C++.");
  }

  return toolchainMap;
}

function CompileCommand(group, source) {
  // Filepath to source file being compiled
  this.source = source;
  // Compiler language used
  this.language = group.language;
  // Compile command line fragments appended into a single string
  this.args = "";
  for (const command of iterateIfExists(group, 'compileCommandFragments')) {
    this.args += ` ${command.fragment}`;
  }

  // includes, both regular and system
  this.includes = [];
  for (const include of iterateIfExists(group, 'includes')) {
    this.includes.push(new IncludePath(include.path, include.isSystem ? true : false));
  }

  // defines
  this.defines = [];
  for (const define of iterateIfExists(group, 'defines')) {
    this.defines.push(define.define);
  }
}

/**
 * 
 * @param {*} replyIndexInfo 
 * @returns 
 */
function loadCompileCommands(replyIndexInfo) {
  if (!fs.existsSync(replyIndexInfo.codemodelResponseFile)) {
    throw new Error("Failed to load codemodel response from CMake API");
  }

  let compileCommands = [];
  const codemodel = parseReplyFile(replyIndexInfo.codemodelResponseFile);
  const sourceRoot = codemodel.paths.source;
  const replyDir = path.dirname(replyIndexInfo.codemodelResponseFile);
  for (const targetInfo of iterateIfExists(codemodel.configurations[0], 'targets')) {
    const target = parseReplyFile(path.join(replyDir, targetInfo.jsonFile));
    for (const group of iterateIfExists(target, 'compileGroups')) {
      for (let sourceIndex of iterateIfExists(group, 'sourceIndexes')) {
        const source = path.join(sourceRoot, target.sources[sourceIndex].path);
        compileCommands.push(new CompileCommand(group, source));
      }
    }
  }

  return compileCommands;
}

/**
 * Find EspXEngine.dll as it only exists in host/target bin for MSVC Visual Studio release.
 * @param {*} clPath path to the MSVC compiler
 * @returns path to EspXEngine.dll
 */
function findEspXEngine(clPath) {
  const clDir = path.dirname(clPath);

  // check if we already have the correct host/target pair
  let dllPath = path.join(clDir, 'EspXEngine.dll');
  if (fs.existsSync(dllPath)) {
    return dllPath;
  }

  let targetName = '';
  const hostDir = path.dirname(clDir);
  switch (path.basename(hostDir)) {
    case 'HostX86':
      targetName = 'x86';
      break;
    case 'HostX64':
      targetName = 'x64';
      break;
    default:
      throw new Error('Unknown MSVC toolset layout');
  }

  dllPath = path.join(hostDir, targetName, 'EspXEngine.dll');
  if (fs.existsSync(dllPath)) {
    return dllPath;
  }

  throw new Error('Unable to find EspXEngine.dll');
}

/**
 * Find official ruleset directory using the known path of MSVC compiler in Visual Studio.
 * @param {*} clPath path to the MSVC compiler
 * @returns path to directory containing all Visual Studio rulesets
 */
function findRulesetDirectory(clPath) {
  const rulesetDirectory = path.normalize(path.join(path.dirname(clPath), RelativeRulesetPath));
  return fs.existsSync(rulesetDirectory) ? rulesetDirectory : undefined;
}

/**
 * Find ruleset first searching relative to GitHub repository and then relative to the official ruleset directory
 * shipped in Visual Studio.
 * @param {*} rulesetDirectory path to directory containing all Visual Studio rulesets
 * @returns path to ruleset found locally or inside Visual Studio
 */
function findRuleset(rulesetDirectory) {
  const repoRulesetPath = resolveInputPath("ruleset");
  if (!repoRulesetPath) {
    return undefined;
  } else if (fs.existsSync(repoRulesetPath)) {
    core.info(`Found local ruleset: ${repoRulesetPath}`);
    return repoRulesetPath;
  }

  // search official ruleset directory that ships inside of Visual Studio
  const rulesetPath = core.getInput("ruleset");
  if (rulesetDirectory != undefined) {
    const officialRulesetPath = path.join(rulesetDirectory, rulesetPath);
    if (fs.existsSync(officialRulesetPath)) {
      core.info(`Found official ruleset: ${officialRulesetPath}`);
      return officialRulesetPath;
    }
  } else {
    core.warning("Unable to find official rulesets shipped with Visual Studio");
  }

  throw new Error(`Unable to find local or official ruleset specified: ${rulesetPath}`);
}

/**
 * Construct all command-line arguments that will be common among all sources files of a given compiler.
 * @param {*} clPath path to the MSVC compiler
 * @param {CompilerCommandOptions} options options for different compiler features
 * @returns list of analyze arguments
 */
function getCommonAnalyzeArguments(clPath, options) {
  const args = [" /analyze:quiet", "/analyze:log:format:sarif"];

  const espXEngine = findEspXEngine(clPath);
  args.push(`/analyze:plugin${espXEngine}`);

  const rulesetDirectory = findRulesetDirectory(clPath);
  const rulesetPath = findRuleset(rulesetDirectory);
  if (rulesetPath != undefined) {
    args.push(`/analyze:ruleset${rulesetPath}`);

    // add ruleset directories incase user includes any official rulesets
    if (rulesetDirectory != undefined) {
      args.push(`/analyze:rulesetdirectory${rulesetDirectory}`);
    }
  } else {
    core.warning('Ruleset is not being used, all warnings will be enabled.');
  }

  if (options.useExternalIncludes) {
    args.push(`/external:W0`);
    args.push(`/analyze:external-`);
  }

  return args;
}

/**
 * Extract the the implicit includes that should be used with the given compiler as MSVC
 * does not populate the Toolchain.implicit.includeDirectories property.
 * @param {*} path path to the MSVC compiler
 * @returns array of default includes used by the given MSVC toolset
 */
 function extractIncludesFromCompilerPath(compilerPath) {
   // TODO: run vcvarsXXX.bat and extract includes/libs as we are missing windows SDK.
  const RelativeIncludes = [
    "..\\..\\..\\include",
    "..\\..\\..\\ATLMFC\\include"
  ];

  const implicitIncludes = [];
  for (const include in RelativeIncludes) {
    const includePath = path.normalize(path.join(compilerPath, include));
    implicitIncludes.push(includePath);
  }

  return implicitIncludes;
}

/**
 * Construct all environment variables that will be common among all sources files of a given compiler.
 * @param {*} clPath path to the MSVC compiler
 * @param {CompilerCommandOptions} options options for different compiler features
 * @returns map of environment variables and their values
 */
function getCommonAnalyzeEnvironment(clPath, _options) {
  const implicitIncludes = extractIncludesFromCompilerPath(clPath).join(";");
  return {
    CAEmitSarifLog: 1,               // enable compatibility mode as GitHub does not support some sarif options
    CAExcludePath: implicitIncludes, // exclude all implicit includes
    INCLUDE: process.env.INCLUDE + ";" + implicitIncludes,
    PATH: path.dirname(clPath) + ";" + process.env.PATH
  };
}

/**
 * Options to enable/disable different compiler features.
 */
 function CompilerCommandOptions() {
  // Use /external command line options to ignore warnings in CMake SYSTEM headers.
  this.ignoreSystemHeaders = core.getInput("ignoreSystemHeaders");
  // TODO: add support to build precompiled headers before running analysis.
  this.usePrecompiledHeaders = false; // core.getInput("usePrecompiledHeaders");
}

function AnalyzeCommand(source, compiler, args, env) {
  this.source = source;
  this.compiler = compiler;
  this.args = args;
  this.env = env;
}

async function createAnalysisCommands(buildRoot, resultsDir, options) {
  const replyIndexInfo = await loadCMakeApiReplies(buildRoot);
  const toolchainMap = loadToolchainMap(replyIndexInfo);
  const compileCommands = loadCompileCommands(replyIndexInfo);

  let commonArgsMap = {};
  let commonEnvMap = {};
  for (const toolchain of Object.values(toolchainMap)) {
    if (!(toolchain.path in commonArgsMap)) {
      commonArgsMap[toolchain.path] = getCommonAnalyzeArguments(toolchain.path, options);
      commonEnvMap[toolchain.path] = getCommonAnalyzeEnvironment(toolchain.path, options);
    }
  }

  let analyzeCommands = []
  for (const command of compileCommands) {
    const toolchain = toolchainMap[command.language];
    if (toolchain) {
      const args = toolrunner.argStringToArray(command.args);
      const allIncludes = toolchain.includes.concat(command.includes);
      for (const include of allIncludes) {
        if (options.ignoreSystemHeaders && include.isSystem) {
          // TODO: filter compilers that don't support /external.
          args.push(`/external:I${include.path}`);
        } else {
          args.push(`/I${include.path}`);
        }
      }

      for (const define of command.defines) {
        args.push(`/D${define}`);
      }

      args.push(command.source);
      args.push(commonArgsMap[toolchain.path]);

      const sarifLog = createSarifFilepath(resultsDir, command.source, analyzeCommands.length);
      args.push(`/analyze:log${sarifLog}`);

      analyzeCommands.push(new AnalyzeCommand(command.source, toolchain.path, args, commonEnvMap[toolchain.path]));
    }
  }

  return analyzeCommands;
}

/**
 * Get 'results' directory action input and cleanup any stale SARIF files.
 * @returns the absolute path to the 'results' directory for SARIF files.
 */
 function prepareResultsDir() {
  const  resultsDir = resolveInputPath("resultsDirectory", true);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true }, err => {
      if (err) {
        throw new Error("Failed to create 'results' directory which did not exist.");
      }
    });
  }

  const cleanSarif = core.getInput('cleanSarif');
  switch (cleanSarif.toLowerCase()) {
    case 'true':
    {
      // delete existing Sarif files that are consider stale
      for (const entry of fs.readdirSync(resultsDir, { withFileTypes : true })) {
        if (entry.isFile() && path.extname(entry.name).toLowerCase() == '.sarif') {
          fs.unlinkSync(path.join(resultsDir, entry.name));
        }
      }
      break;
    }
    case 'false':
      break;
    default:
      throw new Error('Unsupported value for \'cleanSarif\'. Must be either \'True\' or \'False\'');
  }

  return resultsDir;
}

if (require.main === module) {
  (async () => {
    try {
      const buildDir = resolveInputPath("cmakeBuildDirectory", true);
      if (!fs.existsSync(buildDir)) {
        throw new Error("CMake build directory does not exist. Ensure CMake is already configured.");
      }

      const resultsDir = prepareResultsDir();
      const options = new CompilerCommandOptions();
      const analyzeCommands = await createAnalysisCommands(buildDir, resultsDir, options);

      if (analyzeCommands.length == 0) {
        throw new Error('No C/C++ files were found in the project that could be analyzed.');
      }

      // TODO: parallelism
      for (const command of analyzeCommands) {
        let output = "";
        try {
          const execOptions = {
            cwd: buildDir,
            env: command.env,
            listeners: {
              stdout: (data) => {
                output += data.toString();
              },
              stderr: (data) => {
                output += data.toString();
              }
            }
          };

          // TODO: stdout/stderr to log files
          // TODO: timeouts
          core.info(`Running analysis on: ${command.source}`);
          core.debug(`Environment: ${execOptions.env}`);
          core.debug(`"${command.compiler}" ${command.args.join(" ")}`);
          await exec.exec(`"${command.compiler}"`, command.args, execOptions);
        } catch (err) {
          core.warning(`Compilation failed with error: ${err}`);
          core.info("Stdout/Stderr:");
          core.info(output);
        }
      }

    } catch (error) {
      if (core.isDebug()) {
        core.setFailed(error.stack)
      } else {
        core.setFailed(error)
      }
    }
  })();
}