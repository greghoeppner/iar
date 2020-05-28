# IAR Embedded Workbench extension

This extension provides IAR Embedded Workbench project integration to automatize build and Intellisense support.
As IAR works on Windows environment only, the extension is not been tested on different systems.

This is NOT an official IAR Systems extension.

Based on the extension from Leonardo Polito (https://github.com/politoleo/iar).

## Getting Started:

### 1) The extension will try to auto detect the IAR installation path and the project file. 

If you have multiple project files or an odd installation path, please update the following configuration options in the settings.json file as seen below.
```javascript
{
    "iar.installationPath": "C:\\Program Files (x86)\\IAR Systems\\Embedded Workbench 8.2\\",
    "iar.projectFile": "d:\\work\\HomeSystemEmbedded\\home_system.ewp"
}
```

### 2) Now required to configure your build task. 

1) Use the shift+ctrl+p and select Tasks: Configure default build task. 

2) Select the configuration from your IAR project and build type ('make' - Incremental, 'Build' - Full build everytime, or 'clean' - just cleans your output files). 

### 2) Run `ctrl+shift+b` to start build.

The extension automatically replaces your `c_cpp_properties.json` [Microsoft C++ Tools][cpptools] configuration to matches the IAR Project ones.
It supports browsing to external files, includepath, common defines and user included one.


## Debug

Example `launch.json` configuration for debug with J-Link:

```javascript
{
    "version": "0.2.1",
    "configurations": [
      {
        "name": "Debug J-Link",
        "type": "cppdbg",
        "request": "launch",
        "program": "C:/Projects/TEST.out",
        "stopAtEntry": true,
        "cwd": "${workspaceRoot}",
        "externalConsole": false,
        "MIMode": "gdb",
        "miDebuggerPath": "arm-none-eabi-gdb.exe",
        "debugServerPath": "JLinkGDBServerCL.exe",
        "debugServerArgs": "-if swd -singlerun -strict -endian little -speed auto -port 3333 -device STM32FXXXXX -vd -strict -halt",
        "serverStarted": "Connected\\ to\\ target",
        "serverLaunchTimeout": 5000,
        "filterStderr": false,
        "filterStdout": true,
        "setupCommands": [
          {"text": "target remote localhost:3333"},
          {"text": "monitor flash breakpoints = 1"},
          {"text": "monitor flash download = 1"},
          {"text": "monitor reset"},
          {"text": "load C:/Projects/TEST.out"},
          {"text": "monitor reset"}
        ]
      }
    ]
  }
```
[cpptools]: https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools
