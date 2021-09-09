/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 303:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issue = exports.issueCommand = void 0;
const os = __importStar(__nccwpck_require__(87));
const utils_1 = __nccwpck_require__(15);
/**
 * Commands
 *
 * Command Format:
 *   ::name key=value,key=value::message
 *
 * Examples:
 *   ::warning::This is the message
 *   ::set-env name=MY_VAR::some value
 */
function issueCommand(command, properties, message) {
    const cmd = new Command(command, properties, message);
    process.stdout.write(cmd.toString() + os.EOL);
}
exports.issueCommand = issueCommand;
function issue(name, message = '') {
    issueCommand(name, {}, message);
}
exports.issue = issue;
const CMD_STRING = '::';
class Command {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }
        this.command = command;
        this.properties = properties;
        this.message = message;
    }
    toString() {
        let cmdStr = CMD_STRING + this.command;
        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            let first = true;
            for (const key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    const val = this.properties[key];
                    if (val) {
                        if (first) {
                            first = false;
                        }
                        else {
                            cmdStr += ',';
                        }
                        cmdStr += `${key}=${escapeProperty(val)}`;
                    }
                }
            }
        }
        cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
        return cmdStr;
    }
}
function escapeData(s) {
    return utils_1.toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
    return utils_1.toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C');
}
//# sourceMappingURL=command.js.map

/***/ }),

/***/ 366:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getState = exports.saveState = exports.group = exports.endGroup = exports.startGroup = exports.info = exports.warning = exports.error = exports.debug = exports.isDebug = exports.setFailed = exports.setCommandEcho = exports.setOutput = exports.getBooleanInput = exports.getMultilineInput = exports.getInput = exports.addPath = exports.setSecret = exports.exportVariable = exports.ExitCode = void 0;
const command_1 = __nccwpck_require__(303);
const file_command_1 = __nccwpck_require__(271);
const utils_1 = __nccwpck_require__(15);
const os = __importStar(__nccwpck_require__(87));
const path = __importStar(__nccwpck_require__(622));
/**
 * The code to exit an action
 */
var ExitCode;
(function (ExitCode) {
    /**
     * A code indicating that the action was successful
     */
    ExitCode[ExitCode["Success"] = 0] = "Success";
    /**
     * A code indicating that the action was a failure
     */
    ExitCode[ExitCode["Failure"] = 1] = "Failure";
})(ExitCode = exports.ExitCode || (exports.ExitCode = {}));
//-----------------------------------------------------------------------
// Variables
//-----------------------------------------------------------------------
/**
 * Sets env variable for this action and future actions in the job
 * @param name the name of the variable to set
 * @param val the value of the variable. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportVariable(name, val) {
    const convertedVal = utils_1.toCommandValue(val);
    process.env[name] = convertedVal;
    const filePath = process.env['GITHUB_ENV'] || '';
    if (filePath) {
        const delimiter = '_GitHubActionsFileCommandDelimeter_';
        const commandValue = `${name}<<${delimiter}${os.EOL}${convertedVal}${os.EOL}${delimiter}`;
        file_command_1.issueCommand('ENV', commandValue);
    }
    else {
        command_1.issueCommand('set-env', { name }, convertedVal);
    }
}
exports.exportVariable = exportVariable;
/**
 * Registers a secret which will get masked from logs
 * @param secret value of the secret
 */
function setSecret(secret) {
    command_1.issueCommand('add-mask', {}, secret);
}
exports.setSecret = setSecret;
/**
 * Prepends inputPath to the PATH (for this action and future actions)
 * @param inputPath
 */
function addPath(inputPath) {
    const filePath = process.env['GITHUB_PATH'] || '';
    if (filePath) {
        file_command_1.issueCommand('PATH', inputPath);
    }
    else {
        command_1.issueCommand('add-path', {}, inputPath);
    }
    process.env['PATH'] = `${inputPath}${path.delimiter}${process.env['PATH']}`;
}
exports.addPath = addPath;
/**
 * Gets the value of an input.
 * Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
 * Returns an empty string if the value is not defined.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string
 */
function getInput(name, options) {
    const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
    if (options && options.required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    if (options && options.trimWhitespace === false) {
        return val;
    }
    return val.trim();
}
exports.getInput = getInput;
/**
 * Gets the values of an multiline input.  Each value is also trimmed.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string[]
 *
 */
function getMultilineInput(name, options) {
    const inputs = getInput(name, options)
        .split('\n')
        .filter(x => x !== '');
    return inputs;
}
exports.getMultilineInput = getMultilineInput;
/**
 * Gets the input value of the boolean type in the YAML 1.2 "core schema" specification.
 * Support boolean input list: `true | True | TRUE | false | False | FALSE` .
 * The return value is also in boolean type.
 * ref: https://yaml.org/spec/1.2/spec.html#id2804923
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   boolean
 */
function getBooleanInput(name, options) {
    const trueValue = ['true', 'True', 'TRUE'];
    const falseValue = ['false', 'False', 'FALSE'];
    const val = getInput(name, options);
    if (trueValue.includes(val))
        return true;
    if (falseValue.includes(val))
        return false;
    throw new TypeError(`Input does not meet YAML 1.2 "Core Schema" specification: ${name}\n` +
        `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``);
}
exports.getBooleanInput = getBooleanInput;
/**
 * Sets the value of an output.
 *
 * @param     name     name of the output to set
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setOutput(name, value) {
    process.stdout.write(os.EOL);
    command_1.issueCommand('set-output', { name }, value);
}
exports.setOutput = setOutput;
/**
 * Enables or disables the echoing of commands into stdout for the rest of the step.
 * Echoing is disabled by default if ACTIONS_STEP_DEBUG is not set.
 *
 */
function setCommandEcho(enabled) {
    command_1.issue('echo', enabled ? 'on' : 'off');
}
exports.setCommandEcho = setCommandEcho;
//-----------------------------------------------------------------------
// Results
//-----------------------------------------------------------------------
/**
 * Sets the action status to failed.
 * When the action exits it will be with an exit code of 1
 * @param message add error issue message
 */
function setFailed(message) {
    process.exitCode = ExitCode.Failure;
    error(message);
}
exports.setFailed = setFailed;
//-----------------------------------------------------------------------
// Logging Commands
//-----------------------------------------------------------------------
/**
 * Gets whether Actions Step Debug is on or not
 */
function isDebug() {
    return process.env['RUNNER_DEBUG'] === '1';
}
exports.isDebug = isDebug;
/**
 * Writes debug message to user log
 * @param message debug message
 */
function debug(message) {
    command_1.issueCommand('debug', {}, message);
}
exports.debug = debug;
/**
 * Adds an error issue
 * @param message error issue message. Errors will be converted to string via toString()
 */
function error(message) {
    command_1.issue('error', message instanceof Error ? message.toString() : message);
}
exports.error = error;
/**
 * Adds an warning issue
 * @param message warning issue message. Errors will be converted to string via toString()
 */
function warning(message) {
    command_1.issue('warning', message instanceof Error ? message.toString() : message);
}
exports.warning = warning;
/**
 * Writes info to log with console.log.
 * @param message info message
 */
function info(message) {
    process.stdout.write(message + os.EOL);
}
exports.info = info;
/**
 * Begin an output group.
 *
 * Output until the next `groupEnd` will be foldable in this group
 *
 * @param name The name of the output group
 */
function startGroup(name) {
    command_1.issue('group', name);
}
exports.startGroup = startGroup;
/**
 * End an output group.
 */
function endGroup() {
    command_1.issue('endgroup');
}
exports.endGroup = endGroup;
/**
 * Wrap an asynchronous function call in a group.
 *
 * Returns the same type as the function itself.
 *
 * @param name The name of the group
 * @param fn The function to wrap in the group
 */
function group(name, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        startGroup(name);
        let result;
        try {
            result = yield fn();
        }
        finally {
            endGroup();
        }
        return result;
    });
}
exports.group = group;
//-----------------------------------------------------------------------
// Wrapper action state
//-----------------------------------------------------------------------
/**
 * Saves state for current action, the state can only be retrieved by this action's post job execution.
 *
 * @param     name     name of the state to store
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveState(name, value) {
    command_1.issueCommand('save-state', { name }, value);
}
exports.saveState = saveState;
/**
 * Gets the value of an state set by this action's main execution.
 *
 * @param     name     name of the state to get
 * @returns   string
 */
function getState(name) {
    return process.env[`STATE_${name}`] || '';
}
exports.getState = getState;
//# sourceMappingURL=core.js.map

/***/ }),

/***/ 271:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


// For internal use, subject to change.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issueCommand = void 0;
// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs = __importStar(__nccwpck_require__(747));
const os = __importStar(__nccwpck_require__(87));
const utils_1 = __nccwpck_require__(15);
function issueCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`];
    if (!filePath) {
        throw new Error(`Unable to find environment variable for file command ${command}`);
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file at path: ${filePath}`);
    }
    fs.appendFileSync(filePath, `${utils_1.toCommandValue(message)}${os.EOL}`, {
        encoding: 'utf8'
    });
}
exports.issueCommand = issueCommand;
//# sourceMappingURL=file-command.js.map

/***/ }),

/***/ 15:
/***/ ((__unused_webpack_module, exports) => {


// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toCommandValue = void 0;
/**
 * Sanitizes an input into a string so it can be passed into issueCommand safely
 * @param input input to sanitize into a string
 */
function toCommandValue(input) {
    if (input === null || input === undefined) {
        return '';
    }
    else if (typeof input === 'string' || input instanceof String) {
        return input;
    }
    return JSON.stringify(input);
}
exports.toCommandValue = toCommandValue;
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 129:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 82:
/***/ ((module) => {

module.exports = require("console");

/***/ }),

/***/ 747:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 87:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 622:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 669:
/***/ ((module) => {

module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {


const core = __nccwpck_require__(366);
const fs = __nccwpck_require__(747);
const path = __nccwpck_require__(622);
const child_process = __nccwpck_require__(129);
const util = __nccwpck_require__(669);
const { assert } = __nccwpck_require__(82);

const RelativeRulesetPath = '..\\..\\..\\..\\..\\..\\..\\Team Tools\\Static Analysis Tools\\Rule Sets';

/**
 * Add Quoted command-line argument for MSVC that handles spaces and trailing backslashes.
 * @param {*} arg           command-line argument to quote
 * @returns Promise<string> quoted command-lin argument
 */
function escapeArgument(arg) {
  // find number of consecutive trailing backslashes
  let i = 0;
  while (i < arg.length && arg[arg.length - 1 - i] == '\\') {
    i++;
  }

  // escape all trailing backslashes
  if (i > 0) {
    arg += new Array(i + 1).join('\\');
  }

  return '"' + arg + '"';
}

/**
 * Extract the version number of the compiler by depending on the known filepath format inside of
 * Visual Studio.
 * @param {*} path path to the MSVC compiler
 * @returns the MSVC toolset version number
 */
function extractVersionFromCompilerPath(compilerPath) {
  let versionDir = path.join(compilerPath, "../../..");
  return path.basename(versionDir);
}

/**
 * Extract the default compiler includes by searching known directories in the toolset + OS.
 * @param {*} path path to the MSVC compiler
 * @returns array of default includes used by the given MSVC toolset
 */
function extractIncludesFromCompilerPath(compilerPath) {
  let includeDir = path.join(compilerPath, "../../../include");
  // TODO: extract includes from Windows SDK tied to the given toolset.
  return [ path.normalize(includeDir) ];
}

// TODO: replace with io.where
// Find executable relative to the CWD or the system PATH
function findExecutableOnPath(executable) {
  var paths = process.cwd() + ';' + process.env.PATH;
  for (const pathDir of paths.split(';')) {
    const executablePath = path.join(pathDir, executable);
    if (fs.existsSync(executablePath)) {
      return executablePath;
    }
  }

  throw new Error(executable + ' is not accessible on the PATH');
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

/**
 * Options to enable/disable different compiler features.
 */
function CompilerCommandOptions() {
  // Use /external command line options to ignore warnings in CMake SYSTEM headers.
  this.ignoreSystemHeaders = core.getInput("ignoreSystemHeaders");
  // TODO: add support to build precompiled headers before running analysis.
  this.usePrecompiledHeaders = false; // core.getInput("usePrecompiledHeaders");
}

/**
 * Class for interacting with the CMake file API.
 */
class CMakeApi {
  constructor() {
    this.loaded = false;

    this.cCompilerInfo = undefined;
    this.cxxCompilerInfo = undefined;

    this.sourceRoot = undefined;
    this.cache = {};
    this.targetFilepaths = [];
  }

  static clientName = "client-msvc-ca-action";

  /**
   * Read and parse json reply file
   * @param {*} replyFile Absolute path to json reply
   * @returns Parsed json data of the reply file
   */
  _parseReplyFile(replyFile) {
    if (!fs.existsSync(replyFile)) {
      throw new Error("Failed to find CMake API reply file: " + replyFile);
    }

    let jsonData = fs.readFileSync(replyFile, err => {
      if (err) {
        throw new Error("Failed to read CMake API reply file: " + replyFile, err);
      }
    });

    return JSON.parse(jsonData);
  }

  /**
   * Create a query file for the CMake API
   * @param {*} apiDir CMake API directory '.cmake/api/v1'
   * @param {*} cmakeVersion CMake version to limit data that can be requested
   */
  _createApiQuery(apiDir) {
    const queryDir = path.join(apiDir, "query", CMakeApi.clientName);
    if (!fs.existsSync(queryDir)) {
      fs.mkdirSync(queryDir, { recursive : true }, err => {
        if (err) {
          throw new Error("Failed to create CMake Api Query directory.", err);
        }
      });
    }

    const queryData = {
      "requests": [
        { kind: "cache", version: "2" },
        { kind: "codemodel", version: "2" },
        { kind: "toolchains", version: "1" }
    ]};
    const queryFile = path.join(queryDir, "query.json");
    fs.writeFile(queryFile, JSON.stringify(queryData), err => {
      if (err) {
        throw new Error("Failed to write query.json file for CMake API.", err);
      }
    });
  }

  /**
   * Load the reply index file for the CMake API
   * @param {*} apiDir CMake API directory '.cmake/api/v1'
   * @returns parsed json data for reply/index-xxx.json
   */
  _getApiReplyIndex(apiDir) {
    const replyDir = path.join(apiDir, "reply");
    if (!fs.existsSync(replyDir)) {
      throw new Error("Failed to generate CMake Api Reply files");
    }

    let indexFilepath;
    for (const filename of fs.readdirSync(replyDir)) {
      if (filename.startsWith("index-")) {
        // Get the most recent index query file (ordered lexicographically)
        const filepath = path.join(replyDir, filename);
        if (!indexFilepath || filepath > indexFilepath) {
          indexFilepath = filepath;
        }
      };
    }

    if (!indexFilepath) {
      throw new Error("Failed to find CMake API index reply file.");
    }

    return this._parseReplyFile(indexFilepath);
  }

  /**
   * Load the reply cache file for the CMake API
   * @param {*} cacheJsonFile json filepath for the cache reply data
   */
  _loadCache(cacheJsonFile) {
    const data = this._parseReplyFile(cacheJsonFile);

    // ignore entry type and just store name and string-value pair.
    for (const entry of iterateIfExists(data, 'entries')) {
      this.cache[entry.name] = entry.value;
    }
  }

  /**
   * Load the reply codemodel file for the CMake API
   * @param {*} replyDir directory for CMake API reply files
   * @param {*} codemodelJsonFile json filepath for the codemodel reply data
   */
  _loadCodemodel(replyDir, codemodelJsonFile) {
    const data = this._parseReplyFile(codemodelJsonFile);

    // TODO: let the user decide which configuration in multi-config generators
    for (const target of iterateIfExists(data.configurations[0], 'targets')) {
      this.targetFilepaths.push(path.join(replyDir, target.jsonFile));
    }

    this.sourceRoot = data.paths.source;
  }

  /**
   * Load the reply toolset file for the CMake API
   * @param {*} toolsetJsonFile json filepath for the toolset reply data
   */
  _loadToolchains(toolsetJsonFile) {
    const data = this._parseReplyFile(toolsetJsonFile);

    for (const toolchain of iterateIfExists(data, 'toolchains')) {
      let compiler = toolchain.compiler;
      if (toolchain.language == "C" && compiler.id == "MSVC") {
        this.cCompilerInfo = {
          path: compiler.path,
          version: compiler.version,
          includes: compiler.includeDirectories
        };
      } else if (toolchain.language == "CXX" && compiler.id == "MSVC") {
        this.cxxCompilerInfo = {
          path: compiler.path,
          version: compiler.version,
          includes: compiler.includeDirectories
        };
      }
    }

    if (!this.cCompilerInfo && !this.cxxCompilerInfo) {
      throw new Error("Action requires use of MSVC for either/both C or C++.");
    }
  }

  /**
   * Attempt to load toolset information from CMake cache and known paths because the toolset reply
   * API is not available in CMake version < 3.20
   */
  _loadToolchainsFromCache() {
    let cPath = this.cache["CMAKE_C_COMPILER"];
    if (cPath.endsWith("cl.exe") || cPath.endsWith("cl")) {
      this.cCompilerInfo = {
        path: cPath,
        version: extractVersionFromCompilerPath(cPath),
        includes: extractIncludesFromCompilerPath(cPath)
      };
    }

    let cxxPath = this.cache["CMAKE_CXX_COMPILER"];
    if (cxxPath.endsWith("cl.exe") || cxxPath.endsWith("cl")) {
      this.cxxCompilerInfo = {
        path: cxxPath,
        version: extractVersionFromCompilerPath(cxxPath),
        includes: extractIncludesFromCompilerPath(cxxPath)
      };
    }

    if (!this.cCompilerInfo && !this.cxxCompilerInfo) {
      throw new Error("Action requires use of MSVC for either/both C or C++.");
    }
  }

  /**
   * Load the reply index file for CMake API and load all requested reply responses
   * @param {*} apiDir CMake API directory '.cmake/api/v1'
   */
  _loadReplyFiles(apiDir) {
    const indexReply = this._getApiReplyIndex(apiDir);
    if (indexReply.cmake.version.string < "3.13.7") {
      throw new Error("Action requires CMake version >= 3.13.7");
    }

    core.info(`Loading responses from index-xxx.json with CMake version ${indexReply.cmake.version.string}`);
    core.debug(`Reply contents: ${JSON.stringify(indexReply, null, "  ")}`);

    let cacheLoaded = false;
    let codemodelLoaded = false;
    let toolchainLoaded = false;
    const replyDir = path.join(apiDir, "reply");
    const clientReplies = indexReply.reply[CMakeApi.clientName];
    for (const response of iterateIfExists(clientReplies["query.json"], 'responses')) {
      switch (response["kind"]) {
        case "cache":
          cacheLoaded = true;
          this._loadCache(path.join(replyDir, response.jsonFile));
          break;
        case "codemodel":
          codemodelLoaded = true;
          this._loadCodemodel(replyDir, path.join(replyDir, response.jsonFile));
          break;
        case "toolchains":
          toolchainLoaded = true;
          this._loadToolchains(path.join(replyDir, response.jsonFile));
          break;
        default:
          // do nothing as unsupported responses will be { "error" : "unknown request kind 'xxx'" }
      }
    }

    if (!cacheLoaded) {
      throw new Error("Failed to load cache response from CMake API");
    }

    if (!codemodelLoaded) {
      throw new Error("Failed to load codemodel response from CMake API");
    }

    if (!toolchainLoaded) {
      // toolchains is only available in CMake >= 3.20.5. Attempt to load from cache.
      this._loadToolchainsFromCache();
    }
  }

  /**
   * Construct compile-command arguments from compile group information.
   * @param {*} group json data for compile-command data
   * @param {*} options options for different command-line options (see getCompileCommands)
   * @returns compile-command arguments joined into one string
   */
  _getCompileGroupArguments(group, options)
  {
    let compileArguments = [];
    for (const command of iterateIfExists(group, 'compileCommandFragments')) {
      compileArguments.push(command.fragment);
    }

    for (const include of iterateIfExists(group, 'includes')) {
      if (options.ignoreSystemHeaders && include.isSystem) {
        // TODO: filter compilers that don't support /external.
        compileArguments.push(escapeArgument(util.format('/external:I%s', include.path)));
      } else {
        compileArguments.push(escapeArgument(util.format('/I%s', include.path)));
      }
    }

    for (const define of iterateIfExists(group, 'defines')) {
      compileArguments.push(escapeArgument(util.format('/D%s', define.define)));
    }

    if (options.usePrecompiledHeaders) {
      // TODO: handle pre-compiled headers
    }

    return compileArguments.join(" ");
  }

  // --------------
  // Public methods
  // --------------

  /**
   * Create a query to the CMake API of an existing already configured CMake project. This will:
   *  - Read existing default reply data to find CMake
   *  - Create a query file for all data needed
   *  - Re-run CMake config to generated reply data
   *  - Read reply data and collect all non-target related info
   * 
   * loadApi is required to call any other methods on this class.
   * @param {*} buildRoot directory of CMake build
   */
  loadApi(buildRoot) {
    if (!buildRoot) {
      throw new Error("CMakeApi: 'buildRoot' can not be null or empty.");
    } else if (!fs.existsSync(buildRoot)) {
      throw new Error("CMake build root not found at: " + buildRoot);
    } else if (fs.readdirSync(buildRoot).length == 0) {
      throw new Error("CMake build root must be non-empty as project should already be configured");
    }

    // TODO: make code async and replace with io.which("cmake")
    const cmakePath = findExecutableOnPath("cmake.exe");

    const apiDir = path.join(buildRoot, ".cmake/api/v1");
    this._createApiQuery(apiDir)

    // regenerate CMake build directory to acquire CMake file API reply
    let cmake = child_process.spawnSync(cmakePath, [ buildRoot ]);
    if (cmake.error) {
      throw new Error(`Failed to run CMake with error: ${cmake.error}.`);
    }

    if (!fs.existsSync(apiDir)) {
      throw new Error(".cmake/api/v1 missing, run CMake config before using action.");
    }

    this._loadReplyFiles(apiDir);

    this.loaded = true;
  }

  /**
   * Iterate through all CMake targets loaded in the call to 'loadApi' and extract both the compiler and command-line
   * information from every compilation unit in the project. This will only capture C and CXX compilation units that
   * are compiled with MSVC.
   * @param {*} target json filepath for the target reply data
   * @param {CompilerCommandOptions} options options for different compiler features
   * @returns command-line data for each source file in the given target
   */
  * compileCommandsIterator(options = {}) {
    if (!this.loaded) {
      throw new Error("CMakeApi: getCompileCommands called before API is loaded");
    }

    for (let target of this.targetFilepaths) {
      let targetData = this._parseReplyFile(target);
      for (let group of iterateIfExists(targetData, 'compileGroups')) {
        let compilerInfo = undefined;
        switch (group.language) {
          case 'C':
            compilerInfo = this.cCompilerInfo;
            break;
          case 'CXX':
            compilerInfo = this.cxxCompilerInfo;
            break;
        }

        if (compilerInfo) {
          let args = this._getCompileGroupArguments(group, options);
          for (let sourceIndex of iterateIfExists(group, 'sourceIndexes')) {
            let source = path.join(this.sourceRoot, targetData.sources[sourceIndex].path);
            let compileCommand = {
              source: source,
              args: args,
              compiler: compilerInfo
            };
            yield compileCommand;
          }
        }
      }
    }
  }
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
  let hostDir = path.dirname(clDir);
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
  let repoRulesetPath = resolveInputPath("ruleset");
  if (!repoRulesetPath) {
    return undefined;
  } else if (fs.existsSync(repoRulesetPath)) {
    return repoRulesetPath;
  }

  // search official ruleset directory that ships inside of Visual Studio
  const rulesetPath = core.getInput("ruleset");
  if (rulesetDirectory != undefined) {
    const officialRulesetPath = path.join(rulesetDirectory, rulesetPath);
    if (fs.existsSync(officialRulesetPath)) {
      return officialRulesetPath;
    }
  } else {
    core.warning("Unable to find official rulesets shipped with Visual Studio");
  }

  throw new Error("Unable to fine ruleset specified: " + rulesetPath);
}

/**
 * Construct all command-line arguments that will be common among all sources files of a given compiler.
 * @param {*} clPath path to the MSVC compiler
 * @param {CompilerCommandOptions} options options for different compiler features
 * @returns analyze arguments concatenated into a single string.
 */
function getCommonAnalyzeArguments(clPath, options = {}) {
  args = " /analyze:quiet /analyze:log:format:sarif";

  espXEngine = findEspXEngine(clPath);
  args += escapeArgument(util.format(" /analyze:plugin%s", espXEngine));

  const rulesetDirectory = findRulesetDirectory(clPath);
  const rulesetPath = findRuleset(rulesetDirectory);``
  if (rulesetPath != undefined) {
    args += escapeArgument(util.format(" /analyze:ruleset%s", rulesetPath))

    // add ruleset directories incase user includes any official rulesets
    if (rulesetDirectory != undefined) {
      args += escapeArgument(util.format(" /analyze:rulesetdirectory%s", rulesetDirectory));
    }
  } else {
    core.warning('Ruleset is not being used, all warnings will be enabled.');
  }

  if (options.useExternalIncludes) {
    args += "/analyze:external-";
  }

  return args;
}

/**
 * Get 'results' directory action input and cleanup any stale SARIF files.
 * @returns the absolute path to the 'results' directory for SARIF files.
 */
 function prepareResultsDir() {
  let resultsDir = resolveInputPath("resultsDirectory", true);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true }, err => {
      if (err) {
        throw new Error("Failed to create 'results' directory which did not exist.");
      }
    });
  }

  let cleanSarif = core.getInput('cleanSarif');
  switch (cleanSarif.toLowerCase()) {
    case 'true':
    {
      // delete existing Sarif files that are consider stale
      for (let entry of fs.readdirSync(resultsDir, { withFileTypes : true })) {
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

/**
 * Main
 */
if (require.main === require.cache[eval('__filename')]) {
  try {
    let buildDir = resolveInputPath("cmakeBuildDirectory", true);
    if (!fs.existsSync(buildDir)) {
      throw new Error("CMake build directory does not exist. Ensure CMake is already configured.");
    }

    let api = new CMakeApi();
    api.loadApi(buildDir);

    let resultsDir = prepareResultsDir();

    let analysisRan = false;
    let options = CompilerCommandOptions();
    for (let compileCommand of api.compileCommandsIterator(options)) {
      // add cmake and analyze arguments
      let clPath = compileCommand.compiler.path;
      clArguments = compileCommand.args + " " + getCommonAnalyzeArguments(clPath);

      // add argument for unique log filepath in results directory
      // TODO: handle clashing source filenames in project
      sarifFile = path.join(resultsDir, path.basename(compileCommand.source));
      clArguments += escapeArgument(util.format(" /analyze:log%s", sarifFile));

      // add source file
      clArguments += compileCommand.source;

      // enable compatibility mode as GitHub does not support some sarif options
      // TODO: only set on child process (NIT)
      process.env.CAEmitSarifLog = 1;

      // TODO: stdout/stderr to log files
      // TODO: timeouts
      try {
        child_process.execSync(`'${clPath}' ${clArguments}`);
      } catch (err) {
        core.warning(`Compilation failed for source file.`)
        core.info("Stdout:");
        core.info(err.stdout);
        core.info("Stderr:");
        core.info(err.stderr);
      }

      analysisRan = true;
    }

    if (!analysisRan) {
      throw new Error('No C/C++ files were found in the project that could be analyzed.');
    }

  } catch (error) {
    core.setFailed(error.stack)
  }
}
})();

module.exports = __webpack_exports__;
/******/ })()
;