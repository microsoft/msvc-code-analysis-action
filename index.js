"use strict";

const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const io = require('@actions/io');
const path = require('path');
const toolrunner = require('@actions/exec/lib/toolrunner');
const util = require('util');

const CMakeApiClientName = "client-msvc-ca-action";
// Paths relative to absolute path to cl.exe
const RelativeRulesetPath = '..\\..\\..\\..\\..\\..\\..\\..\\Team Tools\\Static Analysis Tools\\Rule Sets';
const RelativeCommandPromptPath = '..\\..\\..\\..\\..\\..\\..\\Auxiliary\\Build\\vcvarsall.bat';

/**
 * Validate if the given directory both exists and is non-empty.
 * @returns Promise<string> true if the directory is empty
 */
function isDirectoryEmpty(buildRoot) {
  return !buildRoot || !fs.existsSync(buildRoot) || (fs.readdirSync(buildRoot).length) == 0;
}

function getRelativeTo(fromPath, relativePath) {
  return path.normalize(path.join(fromPath, relativePath))
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
  this.includes = (toolchain.compiler.implicit.includeDirectories || []).map(
    (include) => new IncludePath(include, true));
  // extract host/target arch from folder layout in VS
  const targetDir = path.dirname(this.path);
  const hostDir = path.dirname(targetDir);
  this.targetArch = path.basename(targetDir);
  switch (path.basename(hostDir)) {
    case 'Hostx86':
      this.hostArch = 'x86';
      break;
    case 'Hostx64':
      this.hostArch = 'x64';
      break;
    default:
      throw new Error('Unknown MSVC toolset layout');
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
  this.args = (group.compileCommandFragments || []).map((c) => c.fragment).join(" ");
  // includes, both regular and system
  this.includes = (group.includes || []).map((inc) =>
    new IncludePath(inc.path, inc.isSystem || false));
  // defines
  this.defines = (group.defines || []).map((d) => d.define);
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
  for (const targetInfo of codemodel.configurations[0].targets) {
    const target = parseReplyFile(path.join(replyDir, targetInfo.jsonFile));
    for (const group of target.compileGroups || []) {
      for (const sourceIndex of group.sourceIndexes) {
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
function findEspXEngine(toolchain) {
  const hostDir = path.dirname(path.dirname(toolchain.path));
  const espXEnginePath = path.join(hostDir, toolchain.hostArch, 'EspXEngine.dll');
  if (fs.existsSync(espXEnginePath)) {
    return espXEnginePath;
  }

  throw new Error(`Unable to find: ${espXEnginePath}`);
}

/**
 * Find official ruleset directory using the known path of MSVC compiler in Visual Studio.
 * @param {*} clPath path to the MSVC compiler
 * @returns path to directory containing all Visual Studio rulesets
 */
function findRulesetDirectory(toolchain) {
  const rulesetDirectory = getRelativeTo(toolchain.path, RelativeRulesetPath);
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
 * @param {*} toolchain MSVC compiler info
 * @param {CompilerCommandOptions} options options for different compiler features
 * @returns list of analyze arguments
 */
function getCommonAnalyzeArguments(toolchain, options) {
  const args = ["/analyze:quiet", "/analyze:log:format:sarif"];

  const espXEngine = findEspXEngine(toolchain);
  args.push(`/analyze:plugin${espXEngine}`);

  const rulesetDirectory = findRulesetDirectory(toolchain);
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

  if (options.ignoreSystemHeaders) {
    args.push(`/external:W0`);
    args.push(`/analyze:external-`);
  }

  return args;
}

/**
 * Extract the the implicit includes that should be used with the given compiler as MSVC
 * does not populate the Toolchain.implicit.includeDirectories property.
 * @param {*} toolchain MSVC compiler info
 * @returns array of default includes used by the given MSVC toolset
 */
async function extractEnvironmentFromCommandPrompt(toolchain) {
  const vcEnvScript = path.join(__dirname, "vc_env.bat");
  const commandPromptPath = getRelativeTo(toolchain.path, RelativeCommandPromptPath);
  const arch = (toolchain.hostArch == toolchain.targetArch) ? 
    toolchain.hostArch : `${toolchain.hostArch}_${toolchain.targetArch}`;

  core.info("Extracting environment from VS Command Prompt");
  const execOutput = await exec.getExecOutput(vcEnvScript, [commandPromptPath, arch, toolchain.version]);
  if (execOutput.exitCode != 0) {
    throw new Error("Failed to run VS Command Prompt to collect implicit includes/libs");
  }

  core.debug(execOutput.stdout);
  const env = {
    "INCLUDE": "",
    "LIB": ""
  };
  for (const line of execOutput.stdout.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index != -1) {
      core.debug(line);
      const envVar = line.substring(0, index);
      if (envVar in env) {
        env[envVar] = line.substring(index + 1, 0);
      }
    }
  }

  return env;
}

/**
 * Construct all environment variables that will be common among all sources files of a given compiler.
 * @param {*} clPath path to the MSVC compiler
 * @param {CompilerCommandOptions} options options for different compiler features
 * @returns map of environment variables and their values
 */
async function getCommonAnalyzeEnvironment(toolchain, _options) {
  const commandPromptEnv = await extractEnvironmentFromCommandPrompt(toolchain);
  return {
    CAEmitSarifLog: "1", // enable compatibility mode as GitHub does not support some sarif options
    CAExcludePath: `${process.env.CAExcludePath || ""};${commandPromptEnv.INCLUDE}`, // exclude all implicit includes
    INCLUDE: `${process.env.INCLUDE || ""};${commandPromptEnv.INCLUDE}`,
    LIB: `${process.env.LIB || ""};${commandPromptEnv.LIB}`,
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
      commonArgsMap[toolchain.path] = getCommonAnalyzeArguments(toolchain, options);
      commonEnvMap[toolchain.path] = await getCommonAnalyzeEnvironment(toolchain, options);
    }
  }

  let analyzeCommands = []
  for (const command of compileCommands) {
    const toolchain = toolchainMap[command.language];
    if (toolchain) {
      let args = toolrunner.argStringToArray(command.args);
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

      const sarifLog = createSarifFilepath(resultsDir, command.source, analyzeCommands.length);
      args.push(`/analyze:log${sarifLog}`);

      args = args.concat(commonArgsMap[toolchain.path]);
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
  const resultsDir = resolveInputPath("resultsDirectory", true);
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
        const execOptions = {
          cwd: buildDir,
          env: command.env,
        };

        // TODO: stdout/stderr to log files
        // TODO: timeouts
        core.info(`Running analysis on: ${command.source}`);
        core.debug("Environment:");
        core.debug(execOptions.env);
        try {
          await exec.exec(`"${command.compiler}"`, command.args, execOptions);
        } catch (err) {
          core.warning(`Compilation failed with error: ${err}`);
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