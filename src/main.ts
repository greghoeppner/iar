import * as vscode from 'vscode';
import * as fs from 'fs';
import { IarBuildTaskProvider } from './iarTaskProvider';

let iarTaskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
    if (!vscode.workspace.workspaceFolders)
        return;

    var folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    var iarConfig = vscode.workspace.getConfiguration("iar");

    autoDetectInstallationFolder(iarConfig);
    autoDetectProjectFile(iarConfig);

    iarTaskProvider = vscode.tasks.registerTaskProvider(IarBuildTaskProvider.IarBuildScriptType, new IarBuildTaskProvider(folder));
}

function autoDetectInstallationFolder(config: vscode.WorkspaceConfiguration) {
    var path = config.installationPath;
    if (path == null) {
        try {
            var dir = fs.readdirSync("C:\\Program Files (x86)\\IAR Systems", {withFileTypes: true})
                .filter(file => file.isDirectory && file.name.toUpperCase().startsWith("EMBEDDED WORKBENCH"));
            if (dir.length > 0) {
                path = "C:\\Program Files (x86)\\IAR Systems" + "\\" + dir[0].name + "\\";
                config
                    .update("installationPath", path, vscode.ConfigurationTarget.Workspace)
                    .then(undefined, (reason) => {
                        console.log("Unable to update the IAR path: " + reason);
                    });
            }
        } catch (e) {
            console.log(e.message);
        }
    }
}

async function autoDetectProjectFile(config:vscode.WorkspaceConfiguration) {
    var project = config.projectFile;
    if (project == null) {
        await vscode.workspace.findFiles("*.ewp").then((value) => {
            project = value[0].fsPath;
            config
                .update("projectFile", project, vscode.ConfigurationTarget.Workspace)
                .then(undefined, (reason) => {
                    console.log("Unable to update the project path: " + reason);
                });
        })
    }
}

export function deactivate() { 
    if (iarTaskProvider) {
        iarTaskProvider.dispose();
    }
}
