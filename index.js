import { getInput, warning, exportVariable, setFailed } from '@actions/core';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { join, isAbsolute, extname, dirname, basename, normalize } from 'path';
import { format } from 'util';

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
    const executablePath = join(pathDir, executable);
    if (existsSync(executablePath)) {
      return executablePath;
    }
  }

  throw new Error(executable + ' is not accessible on the PATH');
}

// Ensure results directory for SARIF files exists and delete stale files if needed.
function prepareResultsDir() {
  var outputDir = getInput('results');
  if (outputDir == '') {
    throw new Error('`results` must exist and contain all intermediate build directories.');
  }

  // make relative path relative to the repo root
  if (!isAbsolute(outputDir)) {
    outputDir = join(process.env.GITHUB_WORKSPACE, outputDir);
  }

  if (!existsSync(outputDir)) {
    throw new Error('`results` must exist and contain all intermediate build directories.');
  }

  var cleanSarif = getInput('cleanSarif');
  switch (cleanSarif.toLowerCase()) {
    case 'true':
    {
      // delete existing Sarif files that are consider stale
      files = readdirSync(outputDir, { withFileTypes: true });
      files.forEach(file => {
        if (file.isFile() && extname(file.name).toLowerCase() == '.sarif') {
          unlinkSync(join(outputDir, file.name));
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
  const clDir = dirname(clPath);

  // check if we already have the correct host/target pair
  var dllPath = join(clDir, 'EspXEngine.dll');
  if (existsSync(dllPath)) {
    return dllPath;
  }

  var targetName = '';
  var hostDir = dirname(clDir);
  switch (basename(hostDir)) {
    case 'HostX86':
      targetName = 'x86';
      break;
    case 'HostX64':
      targetName = 'x64';
      break;
    default:
      throw new Error('Unknown MSVC toolset layout');
  }

  dllPath = join(hostDir, targetName, 'EspXEngine.dll');
  if (existsSync(dllPath)) {
    return dllPath;
  }

  throw new Error('Unable to find EspXEngine.dll');
}

// Find official ruleset directory using the known path of MSVC compiler in Visual Studio.
function findRulesetDirectory(clPath) {
  const rulesetDirectory = normalize(join(dirname(clPath), RelativeRulesetPath));
  return existsSync(rulesetDirectory) ? rulesetDirectory : undefined;
}

function findRuleset(rulesetDirectory) {
  var rulesetPath = getInput('ruleset');
  if (rulesetPath == '') {
    return undefined;
  }

  if (isAbsolute(rulesetPath)) {
    return existsSync(rulesetPath) ? rulesetPath : undefined;
  }

  // search for a path relative to the project directory
  const repoRulesetPath = join(process.env.GITHUB_WORKSPACE, rulesetPath);
  if (existsSync(repoRulesetPath)) {
    return repoRulesetPath;
  }

  // search official ruleset directory that ships inside of Visual Studio
  if (rulesetDirectory != undefined) {
    const officialRulesetPath = join(rulesetDirectory, rulesetPath);
    if (existsSync(officialRulesetPath)) {
      return officialRulesetPath;
    }
  } else {
    warning('Unable to find official rulesets shipped with Visual Studio');
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
  addArg(clArgs, format('/analyze:plugin%s', espXEngine));

  // find ruleset directory that ships inside of Visual Studio
  const rulesetDirectory = findRulesetDirectory(clPath);

  // find ruleset if specified
  const rulesetPath = findRuleset(rulesetDirectory);
  if (rulesetPath != undefined) {
    addArg(clArgs, format('/analyze:ruleset%s', rulesetPath));

    // add ruleset directories incase user includes any official rulesets
    if (rulesetDirectory != undefined) {
      addArg(clArgs, format('/analyze:rulesetdirectory%s', rulesetDirectory));
    }
  }

  // add additional command-line arguments to MSVC if specified
  const additionalArgs =  getInput('args');
  if (additionalArgs != '') {
    clArgs.push(additionalArgs);
  }

  // add analysis arguments to _CL_ env variable
  exportVariable('_CL_', clArgs.join(' '));

  // enable compatibility mode as GitHub does not support some sarif options
  exportVariable('CAEmitSarifLog', '1');
}

// Configuration if (mode == MSBuild).
function configureMSBuildProject() {

  // ensure ruleset is empty or not modified from default
  var rulesetPath = getInput('ruleset');
  if (rulesetPath != '' || rulesetPath != DefaultRulesetName) {
    throw new Error(
      'Custom ruleset not support in MSBuild mode. Configure ruleset in project or use /p:CodeAnalysisRuleset=XXX');
  }

  // add additional command-line arguments to MSVC if specified
  const additionalArgs =  getInput('args');
  if (additionalArgs != '') {
    exportVariable('_CL_', additionalArgs);
  }
  
  // force Code Analysis to run
  exportVariable('RunCodeAnalysis', 'true');

  // extra redundancy in case the user has RunCodeAnalysis manually configured in project
  exportVariable('RunCodeAnalysisOnce', 'true');

  // force generation of Sarif output that us only used in the IDE experience
  exportVariable('VCCodeAnalysisUX', 'true');
}

//
// Main
//

try { 
  const mode = getInput('mode');
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
  setFailed(error.message);
}