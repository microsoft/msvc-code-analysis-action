# Microsoft C++ Code Analysis Action

This actions run code analysis for any CMake project built with the Microsoft Visual C++ Compiler. The analysis
will produce SARIF results that can be uploaded to the GitHub Code Scanning Alerts experience and/or included as
an artifact to view locally in the Sarif Viewer VSCode Extension.

## Usage

### Pre-requisites

Include a workflow `.yml` file using an [example](#example) below as a template. Run the `msvc-code-analysis-action`
after configuring CMake for your project. Building the project is only required if the C++ source files involve the use
of generated files.


### Input Parameters

Description of all input parameters: [action.yml](https://github.com/microsoft/msvc-code-analysis-action/blob/main/action.yml)


### Example

```yml
env:
  # Path to the CMake build directory.
  build: '${{ github.workspace }}/build'
  config: 'Debug'

jobs:
  analyze:
    name: Analyze
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Configure CMake
        run: cmake -B ${{ env.build }} -DCMAKE_BUILD_TYPE=${{ env.config }}

      # Build is not required unless generated source files are used
      # - name: Build CMake
      #   run: cmake --build ${{ env.build }} --config ${{ env.config }}

      - name: Run MSVC Code Analysis
        uses: microsoft/msvc-code-analysis-action@v0.1.0
        # Provide a unique ID to access the sarif output path
        id: run-analysis
        with:
          cmakeBuildDirectory: ${{ env.build }}
          buildConfiguration: ${{ env.config }}
          # Ruleset file that will determine what checks will be run
          ruleset: NativeRecommendedRules.ruleset
          # Paths to ignore analysis of CMake targets and includes
          # ignoredPaths: ${{ github.workspace }}/dependencies;${{ github.workspace }}/test

      # Upload SARIF file to GitHub Code Scanning Alerts
      - name: Upload SARIF to GitHub
        uses: github/codeql-action/upload-sarif@v1
        with:
          sarif_file: ${{ steps.run-analysis.outputs.sarif }}

      # Upload SARIF file as an Artifact to download and view
      - name: Upload SARIF as an Artifact
        uses: actions/upload-artifact@v2
        with:
          name: sarif-file
          path: ${{ steps.run-analysis.outputs.sarif }}
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
