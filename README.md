# IAR Embedded Workbench extension

This extension provides IAR Embedded Workbench project integration to automatize build and Intellisense support.
As IAR works on Windows environment only, the extension is not been tested on different systems.

This is NOT an official IAR Systems extension.

Based on the extension from Leonardo politoleo (https://github.com/politoleo/iar).

## Getting Started:

### 1) Enable the extension on your workspace settings, `settings.json` file inside `.vscode` folder:
```javascript
{
    "iar.enabled":true,
}
```
If you have multiple project files or multiple configurations and it is not finding the project/configuration that you want to use. you can update the 'project' and 'config' with the appropriate values.
```javascript
{
  "iar.enabled":true,
  "iar.settings": {
        "path": "C:\\Program Files (x86)\\IAR Systems\\Embedded Workbench 8.2\\",
        "project": "d:\\work\\HomeSystemEmbedded\\home_system.ewp",
        "config": "Debug"
    }
}
```

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
