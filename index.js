// For review purposes, will remove before merge.

const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const util = require('util');

const RelativeRulesetPath = '..\\..\\..\\..\\..\\..\\..\\Team Tools\\Static Analysis Tools\\Rule Sets';
const DefaultRulesetName = 'NativeRecommendedRules.ruleset';

//
// Utility functions
//

// Add Quoted command-line argument for MSVC that handles spaces and trailing backslashes.
function addArg(clArgs, arg) {
  // find number of consecutive trailing backslashes
  var i = 0;
  while (i < arg.length && arg[arg.length - 1 - i] == '\\') {
    i++;
  }

  // escape all trailing backslashes
  if (i > 0) {
    arg += new Array(i + 1).join('\\');
  }

  clArgs.push('"' + arg + '"');
}

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

// Ensure results directory for SARIF files exists and delete stale files if needed.
function prepareResultsDir() {
  var outputDir = core.getInput('results');
  if (outputDir == '') {
    throw new Error('`results` must exist and contain all intermediate build directories.');
  }

  // make relative path relative to the repo root
  if (!path.isAbsolute(outputDir)) {
    outputDir = path.join(process.env.GITHUB_WORKSPACE, outputDir);
  }

  if (!fs.existsSync(outputDir)) {
    throw new Error('`results` must exist and contain all intermediate build directories.');
  }

  var cleanSarif = core.getInput('cleanSarif');
  switch (cleanSarif.toLowerCase()) {
    case 'true':
    {
      // delete existing Sarif files that are consider stale
      files = fs.readdirSync(outputDir, { withFileTypes: true });
      files.forEach(file => {
        if (file.isFile() && path.extname(file.name).toLowerCase() == '.sarif') {
          fs.unlinkSync(path.join(outputDir, file.name));
        }
      });
      break;
    }
    case 'false':
      break;
    default:
      throw new Error('Unsupported value for \'cleanSarif\'. Must be either \'True\' or \'False\'');
  }

  return outputDir;
}

// EspXEngine.dll only exists in host/target bin for MSVC Visual Studio release.
function findEspXEngine(clPath) {
  const clDir = path.dirname(clPath);

  // check if we already have the correct host/target pair
  var dllPath = path.join(clDir, 'EspXEngine.dll');
  if (fs.existsSync(dllPath)) {
    return dllPath;
  }

  var targetName = '';
  var hostDir = path.dirname(clDir);
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

// Find official ruleset directory using the known path of MSVC compiler in Visual Studio.
function findRulesetDirectory(clPath) {
  const rulesetDirectory = path.normalize(path.join(path.dirname(clPath), RelativeRulesetPath));
  return fs.existsSync(rulesetDirectory) ? rulesetDirectory : undefined;
}

function findRuleset(rulesetDirectory) {
  var rulesetPath = core.getInput('ruleset');
  if (rulesetPath == '') {
    return undefined;
  }

  if (path.isAbsolute(rulesetPath)) {
    return fs.existsSync(rulesetPath) ? rulesetPath : undefined;
  }

  // search for a path relative to the project directory
  const repoRulesetPath = path.join(process.env.GITHUB_WORKSPACE, rulesetPath);
  if (fs.existsSync(repoRulesetPath)) {
    return repoRulesetPath;
  }

  // search official ruleset directory that ships inside of Visual Studio
  if (rulesetDirectory != undefined) {
    const officialRulesetPath = path.join(rulesetDirectory, rulesetPath);
    if (fs.existsSync(officialRulesetPath)) {
      return officialRulesetPath;
    }
  } else {
    core.warning('Unable to find official rulesets shipped with Visual Studio');
  }

  throw new Error('Unable to fine ruleset specified: ' + rulesetPath);
}

//
// Build 'mode' functions
//

// Configuration if (mode == General).
function configureGeneralProject() {
  const clArgs = ["/analyze:quiet", "/analyze:log:format:sarif"];

  // fine cl.exe on the corresponding EspXEngine.dll
  const clPath = findExecutableOnPath('cl.exe');
  const espXEngine = findEspXEngine(clPath);
  addArg(clArgs, util.format('/analyze:plugin%s', espXEngine));

  // find ruleset directory that ships inside of Visual Studio
  const rulesetDirectory = findRulesetDirectory(clPath);

  // find ruleset if specified
  const rulesetPath = findRuleset(rulesetDirectory);
  if (rulesetPath != undefined) {
    addArg(clArgs, util.format('/analyze:ruleset%s', rulesetPath));

    // add ruleset directories incase user includes any official rulesets
    if (rulesetDirectory != undefined) {
      addArg(clArgs, util.format('/analyze:rulesetdirectory%s', rulesetDirectory));
    }
  }

  // add additional command-line arguments to MSVC if specified
  const additionalArgs =  core.getInput('args');
  if (additionalArgs != '') {
    clArgs.push(additionalArgs);
  }

  // add analysis arguments to _CL_ env variable
  core.exportVariable('_CL_', clArgs.join(' '));

  // enable compatibility mode as GitHub does not support some sarif options
  core.exportVariable('CAEmitSarifLog', '1');
}

// Configuration if (mode == MSBuild).
function configureMSBuildProject() {

  // ensure ruleset is empty or not modified from default
  var rulesetPath = core.getInput('ruleset');
  if (rulesetPath != '' || rulesetPath != DefaultRulesetName) {
    throw new Error(
      'Custom ruleset not support in MSBuild mode. Configure ruleset in project or use /p:CodeAnalysisRuleset=XXX');
  }

  // add additional command-line arguments to MSVC if specified
  const additionalArgs =  core.getInput('args');
  if (additionalArgs != '') {
    core.exportVariable('_CL_', additionalArgs);
  }

  // force Code Analysis to run
  core.exportVariable('RunCodeAnalysis', 'true');

  // extra redundancy in case the user has RunCodeAnalysis manually configured in project
  core.exportVariable('RunCodeAnalysisOnce', 'true');

  // force generation of Sarif output that us only used in the IDE experience
  core.exportVariable('VCCodeAnalysisUX', 'true');
}

//
// Main
//

try { 
  const mode = core.getInput('mode');
  switch (mode.toLowerCase()) {
    case 'general':
      configureGeneralProject()
      break;
    case 'msbuild':
      configureMSBuildProject()
      break;
    default:
      throw new Error('Unknown operation mode: ' + mode);
  }

  prepareResultsDir();

} catch (error) {
  core.setFailed(error.message);
}