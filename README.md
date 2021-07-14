# msvc-code-analysis-action

This action enables code analysis to run while building a project with the Microsoft Visual C++ Compiler. The analysis
will produce SARIF results that can be uploaded to the GitHub Code Scanning Alerts experience.

## Usage

### Pre-requisites

Include a workflow `.yml` file using an [example](#example) below as a template. Run the `msvc-code-analysis-action`
before re-building your project using the appropriate operation mode detailed below.

### Inputs
- `mode` (**default:** General) operation mode given different environments and build systems:
   - **General:** enable Code Analysis for any build system. The MSVC compiler with the desired host and target
   architecture must be available on the PATH. 
   - **MSBuild:** enable MSBuild Code Analysis experience. This is the preferred method if using MSBuild projects as it
   can use Code Analysis settings as configured in Visual Studio.
- `results` (**default:** ${{ github.workspace }}) root directory containing all SARIF files produced in build.
This is commonly the root directory of the project (i.e. MSBuild) or build folder (i.e. CMake).
- `ruleset` (**default:** NativeRecommendedRules.ruleset) ruleset file used to determine what checks are run. This can
reference a ruleset that ships with Visual Studio or a custom file in the project.
- `cleanSarif` (**default:** true) SARIF files will under `results` directory are considered stale and be deleted.
- `args` optional parameters to pass to every instance of the compiler.

### Examples

#### CMake

```yml
  # Use VCPKG to make MSVC discoverable on the PATH
- name: Add MSVC to the PATH
  uses: lukka/run-vcpkg@v7
  with:
    setupOnly: true

  # Configure MSVC to run code analysis during build
- name: Initialize MSVC Code Analysis 
  uses: microsoft/msvc-code-analysis-action
  with:
    # Path to directory that will contain produced sarif files
    results: build
    # Ruleset file that will determine what checks will be run
    ruleset: NativeRecommendRules.ruleset

  # Rebuild the project using any MSVC compatible build system
- name: Build Project
  run: cmake -G Ninja -B build --clean-first

  # Upload all SARIF files generated in the build directory tree
- name: Upload SARIF files
  uses: github/codeql-action/upload-sarif@v1
  with:
    sarif_file: build
```

#### MSBuild

```yml
  # Make MSBuild discoverable on the PATH
- name: Add MSBuild to PATH
  uses: microsoft/setup-msbuild@v1.0.2

  # Configure MSVC to run code analysis during build
- name: Initialize MSVC Code Analysis 
  uses: microsoft/msvc-code-analysis-action@v1
  with:
    # Root of MSBuild Solution containing all project directories
    result: ${{ github.workspace }}

  # Rebuild the project using MSBuild
- name: Build Project
  run: msbuild Project.sln /p:Configuration=Release /p:Platform=x64 /t:rebuild

  # Upload all SARIF files generated in the build directory tree
- name: Upload SARIF files
  uses: github/codeql-action/upload-sarif@v1
  with:
    # Root of MSBuild Solution containing all project directories
    sarif_file: ${{ github.workspace }}
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
