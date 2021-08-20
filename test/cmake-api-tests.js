"use strict";

const chai = require("chai");
const path = require("path");
const rewire = require("rewire");
const td = require("testdouble");

const expect = chai.expect;
chai.should();

const cmakeExePath = path.normalize("C:\\path\\to\\cmake.exe");
const cmakeBuildDir = path.normalize("path\\to\\cmake\\build");
const cmakeSrcDir = path.normalize("path\\to\\project/src");

const cmakeApiDir = path.join(cmakeBuildDir, path.normalize(".cmake\\api\\v1"));
const cmakeQueryDir = path.join(cmakeApiDir, "query");
const cmakeReplyDir = path.join(cmakeApiDir, "reply");

const clPath = "C:/VS/root/Tools/MSVC/14.29.30133/bin/Hostx86/x86/cl.exe";
const clInclude = "C:/VS/root/Tools/MSVC/14.29.30133/include";

const cmakeIndexReply = path.join(cmakeReplyDir, "index-1.json");
const cmakeCacheReply = path.join(cmakeReplyDir, "cache-1.json");
const cmakeCodemodelReply = path.join(cmakeReplyDir, "codemodel-1.json");
const cmakeToolchainsReply = path.join(cmakeReplyDir, "toolchains-1.json");
const cmakeTarget1Reply = path.join(cmakeReplyDir, "target-1.json");
const cmakeTarget2Reply = path.join(cmakeReplyDir, "target-2.json");

let defaultFileContents = {};
defaultFileContents[cmakeIndexReply] = {
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
    "reply" : {
        "client-fake": {
            "invalid": "data"
        },
        "client-msvc-ca-action" : {
            "query.json" : {
                "responses": [
                    { "kind" : "cache", "jsonFile" : path.basename(cmakeCacheReply) },
                    { "kind" : "codemodel", "jsonFile" : path.basename(cmakeCodemodelReply) },
                    { "kind" : "toolchains", "jsonFile" : path.basename(cmakeToolchainsReply) }
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
            "targets": [
                { "jsonFile": path.basename(cmakeTarget1Reply) },
                { "jsonFile": path.basename(cmakeTarget2Reply) }
            ]
        },
        {
            "name": "OnlyTarget2",
            "targets": [
                { "jsonFile": path.basename(cmakeTarget2Reply) }
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
    let child_process;
    let fs;
    let action;
    let api;
    let options;

    function setFileContents(filepath) {
        td.when(fs.existsSync(filepath)).thenReturn(true);
        td.when(fs.readFileSync(filepath, td.matchers.anything())).thenReturn(
            JSON.stringify(defaultFileContents[filepath]));
    }

    function editFileContents(filepath, editCallback) {
        let contents = JSON.parse(JSON.stringify(defaultFileContents[filepath]));
        editCallback(contents);
        td.when(fs.readFileSync(filepath, td.matchers.anything())).thenReturn(JSON.stringify(contents));
    }
 
    function validateCompileCommands() {
        let compileCommands = [...api.compileCommandsIterator(options)];
        for (let compileCommand of compileCommands) {
            let args = compileCommand.args;

            args.should.contain(sharedArgs);
            args.should.contain('"/Iregular/include"');
            if (options.ignoreSystemHeaders) {
                args.should.contain('"/external:Iexternal/include"');
            } else {
                args.should.contain('"/Iexternal/include"');
            }

            switch (path.basename(compileCommand.source)) {
                case "file1.cpp":
                case "file3.cxx":
                    args.should.contain(uniqueArgs);
                    break;
                case "file2.c":
                    break;
                case "file4.cpp":
                    args.should.contain('"/Da=b" "/Dc=d"');
                    break;
                default:
                    assert.fail("Unknown source file: " + compileCommand.source);
            }
        }

        return compileCommands;
    }

    beforeEach(() => {
        // modules
        child_process = td.replace("child_process");
        fs = td.replace("fs");
        action = rewire("../index.js");
        api = new (action.__get__("CMakeApi"))();

        // default compiler options
        options = new (action.__get__("CompilerCommandOptions"));
        options.ignoreSystemHeaders = false;

        // default cmake folders
        td.when(fs.existsSync(cmakeBuildDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeSrcDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeExePath)).thenReturn(true);
        td.when(fs.existsSync(cmakeApiDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeQueryDir)).thenReturn(true);
        td.when(fs.existsSync(cmakeReplyDir)).thenReturn(true);

        // default MSVC toolset
        td.when(fs.existsSync(clPath)).thenReturn(true);
        td.when(fs.existsSync(clInclude)).thenReturn(true);

        // default reply files
        td.when(fs.readdirSync(cmakeReplyDir)).thenReturn(Object.keys(defaultFileContents));
        for (const file of Object.keys(defaultFileContents)) {
            setFileContents(file);
        }
    });

    afterEach(() => {
        td.reset();
    });

    // Common tests.

    let basicTests = function () {
        it("get compile commands", () => {
            api.loadApi(cmakeBuildDir);
            let commands = validateCompileCommands();
            commands.length.should.equal(totalCompileCommands);
        });
    };

    let msvcNotUsedTests = function() {
        beforeEach(() => {
            editFileContents(cmakeCacheReply, (reply) => {
                reply.entries[CLangIndex].value = "clang.exe";
                reply.entries[CXXLangIndex].value = "clang.exe";
            });
            editFileContents(cmakeToolchainsReply, (reply) => {
                reply.toolchains[CLangIndex].compiler.path = "clang.exe";
                reply.toolchains[CLangIndex].compiler.id = "Clang";
                reply.toolchains[CXXLangIndex].compiler.path = "clang.exe";
                reply.toolchains[CXXLangIndex].compiler.id = "Clang";
            });
        });

        it("msvc for neither C/C++", () => {
            expect(() => api.loadApi(cmakeBuildDir)).to.throw(
                "Action requires use of MSVC for either/both C or C++.");
        });
    }

    basicTests();

    // only testing user errors, assume format of query/reply files is valid
    describe("errors", () => {
        it("empty buildRoot", () => {
            expect(() => api.loadApi("")).to.throw("CMakeApi: 'buildRoot' can not be null or empty.");
        });

        it("buildRoot does not exist", () => {
            td.when(fs.existsSync(cmakeBuildDir)).thenReturn(false);
            expect(() => api.loadApi(cmakeBuildDir)).to.throw("Generated build root for CMake not found at: ");
        });
        
        it("cmake not run (missing .cmake/api dir)", () => {
            td.when(fs.existsSync(cmakeApiDir)).thenReturn(false);
            expect(() => api.loadApi(cmakeBuildDir)).to.throw(
                ".cmake/api/v1 missing, run CMake config before using action.");
        });

        it("cmake version < 3.13.7", () => {
            editFileContents(cmakeIndexReply, (reply) => {
                reply.version.string = "3.13.6";
            });
            expect(() => api.loadApi(cmakeBuildDir)).to.throw("Action requires CMake version >= 3.13.7" );
        });

        it("cmake exe does not exist", () => {
            td.when(fs.existsSync(cmakeExePath)).thenReturn(false);
            expect(() => api.loadApi(cmakeBuildDir)).to.throw("Unable to find CMake used to build project at: ");
        });

        it("cmake.exe failed to run", () => {
            td.when(child_process.spawn(td.matchers.anything(), td.matchers.anything()))
                .thenCallback(new Error(".exe failed"));
            expect(() => api.loadApi(cmakeBuildDir)).to.throw(
                "Unable to run CMake used previously to build cmake project.");
        });

        msvcNotUsedTests();
    });

    describe("ignore system headers", () => {
        beforeEach(() => {
            options.ignoreSystemHeaders = true;
        });

        basicTests();
    });

    describe("no toolchains", () => {
        beforeEach(() => {
            editFileContents(cmakeIndexReply, (reply) => {
                reply.version.string = "3.13.7";
                reply.reply["client-msvc-ca-action"]["query.json"].responses = [
                    { "kind" : "cache", "jsonFile" : path.basename(cmakeCacheReply) },
                    { "kind" : "codemodel", "jsonFile" : path.basename(cmakeCodemodelReply) }
                ];
            });
        });

        basicTests();

        describe("errors", () => {
            msvcNotUsedTests();
        });
    });
});