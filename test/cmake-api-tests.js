"use strict";

const assert = require("assert");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const path = require("path");
const rewire = require("rewire");
const td = require("testdouble");

chai.use(chaiAsPromised);
const expect = chai.expect;
chai.should();

const cmakeExePath = path.normalize("C:\\path\\to\\cmake.exe");
const cmakeBuildDir = path.normalize("path\\to\\cmake\\build");
const cmakeSrcDir = path.normalize("path\\to\\project\\src");

const cmakeApiDir = path.join(cmakeBuildDir, path.normalize(".cmake\\api\\v1"));
const cmakeQueryDir = path.join(cmakeApiDir, "query");
const cmakeReplyDir = path.join(cmakeApiDir, "reply");

const clPath = "C:/VS/root/Tools/MSVC/14.29.30133/bin/Hostx86/x86/cl.exe";
const clInclude = "C:/VS/root/Tools/MSVC/14.29.30133/include";

const PATHEnv = [
    path.dirname(clPath),
    path.dirname(cmakeExePath)
].join(";");

const cmakeIndexReply = "index-1.json";
const cmakeCacheReply = "cache-1.json";
const cmakeCodemodelReply = "codemodel-1.json";
const cmakeToolchainsReply = "toolchains-1.json";
const cmakeTarget1Reply = "target-1.json";
const cmakeTarget2Reply = "target-2.json";

let defaultFileContents = {};
defaultFileContents[cmakeIndexReply] = {
    "cmake": {
        "generator": {
            "multiConfig": true,
            "name": "Visual Studio 17 2022"
        },
        "paths": {
            "cmake": cmakeExePath
        },
        "version": {
            "string": "3.21.6"
        },
    },
    "reply" : {
        "client-fake": {
            "invalid": "data"
        },
        "client-msvc-ca-action" : {
            "query.json" : {
                "responses": [
                    { "kind" : "cache", "jsonFile" : cmakeCacheReply },
                    { "kind" : "codemodel", "jsonFile" : cmakeCodemodelReply },
                    { "kind" : "toolchains", "jsonFile" : cmakeToolchainsReply }
                ]
            }
        }
    }
};

defaultFileContents[cmakeCodemodelReply] = {
    "kind": "codemodel",
    "paths": {
        "build": cmakeBuildDir,
        "source": cmakeSrcDir
    },
    "configurations" : [
        {
            "name": "Regular",
            "directories": [
                { "source": "." },
                { "source": "test" }
            ],
            "targets": [
                { 
                    "directoryIndex": 0,
                    "jsonFile": cmakeTarget1Reply
                },
                {
                    "directoryIndex": 0,
                    "jsonFile": cmakeTarget2Reply
                }
            ]
        },
        {
            "name": "OnlyTarget2",
            "directories": [
                { "source": "." }
            ],
            "targets": [
                { 
                    "directoryIndex": 0,
                    "jsonFile": cmakeTarget2Reply
                }
            ]
        }
    ]
};

const CLangIndex = 0;
const CXXLangIndex = 1;
defaultFileContents[cmakeCacheReply] = {
    "kind": "cache",
    "entries": [
        { // CLangIndex
            "name": "CMAKE_C_COMPILER",
            "value": clPath
        },
        { // CXXLangIndex
            "name": "CMAKE_CXX_COMPILER",
            "value": clPath
        }
    ]
};

defaultFileContents[cmakeToolchainsReply] = {
    "kind": "toolchains",
    "toolchains": [
        { // CLangIndex
            "language": "C",
            "compiler" : {
                "path": clPath,
                "id": "MSVC",
                "version": "14.29.30133",
                "implicit": {
                    "includeDirectories": [
                        clInclude
                    ]
                }
            }
        },
        { // CXXLangIndex
            "language": "CXX",
            "compiler" : {
                "path": clPath,
                "id": "MSVC",
                "version": "14.29.30133",
                "implicit": {
                    "includeDirectories": [
                        clInclude
                    ]
                }
            }
        }

    ]
};

const sharedArgs = "/a /b /c";
const uniqueArgs = "/e /f";
const totalCompileCommands = 4;
defaultFileContents[cmakeTarget1Reply] = {
    "compileGroups": [
        {
            "compileCommandFragments": [
                { "fragment": sharedArgs },
                { "fragment": uniqueArgs }
            ],
            "includes": [
                { "path": "regular/include"},
                { "path": "external/include", "isSystem": true }
            ],
            "language": "CXX",
            "sourceIndexes": [
                0,
                2
            ]
        },
        {
            "compileCommandFragments": [
                { "fragment": sharedArgs }
            ],
            "includes": [
                { "path": "regular/include", "isSystem": false },
                { "path": "external/include", "isSystem": true }
            ],
            "language": "C",
            "sourceIndexes": [
                1
            ]
        },
    ],
    "sources": [
        { "path" : "src/file1.cpp"},
        { "path" : "src/file2.c"},
        { "path" : "src/file3.cxx"},
    ]
};

defaultFileContents[cmakeTarget2Reply] = {
    "compileGroups": [
        {
            "compileCommandFragments": [
                { "fragment": sharedArgs }
            ],
            "includes": [
                { "path": "regular/include" },
                { "path": "external/include", "isSystem": true }
            ],
            "defines": [
                { "define": "a=b"},
                { "define": "c=d"},
            ],
            "language": "CXX",
            "sourceIndexes": [
                0
            ]
        },
    ],
    "sources": [
        { "path" : "src/file4.cpp"},
    ]
};

describe("CMakeApi", () => {
    let action;
    let exec;
    let fs;
    let io;

    let getApiReplyIndex;
    let loadCMakeApiReplies;
    let loadToolchainMap;
    let loadCompileCommands;

    function setReplyContents(filename) {
        const filepath = path.join(cmakeReplyDir, filename);
        td.when(fs.existsSync(filepath)).thenReturn(true);
        td.when(fs.readFileSync(filepath, td.matchers.anything())).thenReturn(
            JSON.stringify(defaultFileContents[filename]));
    }

    function editReplyContents(filename, editCallback) {
        const filepath = path.join(cmakeReplyDir, filename);
        let contents = JSON.parse(JSON.stringify(defaultFileContents[filename]));
        editCallback(contents);
        td.when(fs.readFileSync(filepath, td.matchers.anything())).thenReturn(JSON.stringify(contents));
    }
 
    function validateCompileCommands(compileCommands) {
        for (const command of compileCommands) {
            command.args.should.contain(sharedArgs);
            command.includes.length.should.equal(2);
            switch (path.basename(command.source)) {
                case "file1.cpp":
                case "file3.cxx":
                    command.args.should.contain(uniqueArgs);
                    break;
                case "file2.c":
                    break;
                case "file4.cpp":
                    command.defines.should.contain("a=b");
                    command.defines.should.contain("c=d");
                    break;
                default:
                    assert.fail("Unknown source file: " + compileCommand.source);
            }
        }
    }

    beforeEach(() => {
        // modules
        exec = td.replace('@actions/exec');
        fs = td.replace("fs");
        io = td.replace('@actions/io');
        action = rewire("../index.js");

        getApiReplyIndex = action.__get__("getApiReplyIndex");
        loadCMakeApiReplies = action.__get__("loadCMakeApiReplies");
        loadToolchainMap = action.__get__("loadToolchainMap");
        loadCompileCommands = action.__get__("loadCompileCommands");

        // default cmake folders
        td.when(fs.existsSync(cmakeBuildDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeSrcDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeApiDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeQueryDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeReplyDir)).thenReturn(true);
        // cmakeBuildDir must be non-empty
        td.when(fs.readdirSync(cmakeBuildDir)).thenReturn([".cmake"]);

        // cmake discoverable and successfully executable
        td.when(io.which("cmake", true)).thenResolve(cmakeExePath);
        td.when(exec.exec("cmake", [cmakeBuildDir])).thenResolve(0);

        // default MSVC toolset
        td.when(fs.existsSync(clPath)).thenReturn(true);
        td.when(fs.existsSync(clInclude)).thenReturn(true);

        // default reply files
        td.when(fs.readdirSync(cmakeReplyDir)).thenReturn(Object.keys(defaultFileContents));
        for (const filename of Object.keys(defaultFileContents)) {
            setReplyContents(filename);
        }
    });

    afterEach(() => {
        td.reset();
    });

    // Common tests.
    it("loadCompileCommands", async () => {
        const replyIndexInfo = getApiReplyIndex(cmakeApiDir);
        const compileCommands = loadCompileCommands(replyIndexInfo, []);
        validateCompileCommands(compileCommands);
        compileCommands.length.should.equal(totalCompileCommands);
    });

    it("filterAllCommands", async () => {
        const replyIndexInfo = getApiReplyIndex(cmakeApiDir);
        const compileCommands = loadCompileCommands(replyIndexInfo, [cmakeSrcDir]);
        validateCompileCommands(compileCommands);
        compileCommands.length.should.equal(0);
    });

    it("loadToolchainMap", async () => {
        const replyIndexInfo = getApiReplyIndex(cmakeApiDir);
        const toolchainMap = loadToolchainMap(replyIndexInfo);
        toolchainMap.should.have.keys(["C", "CXX"]);
    });

    // only testing user errors, assume format of query/reply files is valid
    describe("errors", () => {
        it("empty buildRoot", async () => {
            await expect(loadCMakeApiReplies("")).to.be.rejectedWith(
                "CMake build root must exist, be non-empty and be configured with CMake");
        });

        it("buildRoot does not exist", async () => {
            td.when(fs.existsSync(cmakeBuildDir)).thenReturn(false);
            await expect(loadCMakeApiReplies(cmakeBuildDir)).to.be.rejectedWith(
                "CMake build root must exist, be non-empty and be configured with CMake");
        });

        it("cmake not on path", async () => {
            td.when(io.which("cmake", true)).thenReject(new Error("cmake missing"));
            await expect(loadCMakeApiReplies(cmakeBuildDir)).to.be.rejectedWith("cmake missing");
        });

        it("cmake.exe failed to run", async () => {
            td.when(exec.exec("cmake", td.matchers.anything())).thenReject(new Error());
            await expect(loadCMakeApiReplies(cmakeBuildDir)).to.be.rejectedWith(
                "CMake failed to reconfigure project with error:");
        });

        it("cmake not run (missing .cmake/api dir)", async () => {
            td.when(fs.existsSync(cmakeReplyDir)).thenReturn(false);
            await expect(loadCMakeApiReplies(cmakeBuildDir)).to.be.rejectedWith(
                "Failed to find CMake API index reply file.");
        });

        it("cmake version < 3.20.5", async () => {
            editReplyContents(cmakeIndexReply, (reply) => {
                reply.cmake.version.string = "3.20.4";
            });
            await expect(loadCMakeApiReplies(cmakeBuildDir)).to.be.rejectedWith(
                "Action requires CMake version >= 3.20.5");
        });

        it("msvc for neither C/C++", async () => {
            editReplyContents(cmakeToolchainsReply, (reply) => {
                reply.toolchains[CLangIndex].compiler.path = "clang.exe";
                reply.toolchains[CLangIndex].compiler.id = "Clang";
                reply.toolchains[CXXLangIndex].compiler.path = "clang.exe";
                reply.toolchains[CXXLangIndex].compiler.id = "Clang";
            });

            const replyIndexInfo = getApiReplyIndex(cmakeApiDir);
            expect(() => loadToolchainMap(replyIndexInfo)).to.throw(
                "Action requires use of MSVC for either/both C or C++.");
        });
    });
});