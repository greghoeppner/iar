import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Iar from './iar';
import * as xml2js from 'xml2js';

var iar: Iar.Iar | undefined = undefined;

function resolve(path: string) {
    var folder = vscode.workspace.rootPath ?? "";
    var out = path.split("${workspaceRoot}").join(folder);
    out = out.split("${workspaceFolder}").join(folder);
    return out;
}

export async function activate(context: vscode.ExtensionContext) {
    if (!vscode.workspace.rootPath)
        return;

    var folder = vscode.workspace.rootPath;

    let disposable = vscode.commands.registerCommand('iar.build', async function () {
        var iarConfig = vscode.workspace.getConfiguration("iar");
        var settings = vscode.workspace.getConfiguration("iar.settings");
        var path = settings.path as string;
        var settingsUpdated = false;
        
        if (path == null) {
            try {
                var dir = fs.readdirSync("C:\\Program Files (x86)\\IAR Systems", {withFileTypes: true})
                    .filter(file => file.isDirectory && file.name.toUpperCase().startsWith("EMBEDDED WORKBENCH"));
                if (dir.length > 0) {
                    path = "C:\\Program Files (x86)\\IAR Systems" + "\\" + dir[0].name + "\\";
                    settingsUpdated = true;
                }
            } catch (e) {
                console.log(e.message);
            }
        }

        if (!fs.existsSync(path)) {
            vscode.window.showInformationMessage("Unable to locate the IAR installation directory");
        }

        var project = "";
        if (settings.project == null) {
            await vscode.workspace.findFiles("*.ewp").then((value) => {
                project = value[0].fsPath;
                settingsUpdated = true;
            })
        } else {
            project = settings.project as string;
        }

        if (!fs.existsSync(project)) {
            vscode.window.showInformationMessage("Unable to locate an EWARM project file (.ewp)");
            return;
        }

        var config = "";
        if (!settings.has("config") || settings.config == null) {
            config = await parseProjectForConfig(project);
            settingsUpdated = true;
        } else {
            config = settings.config as string;
        }

        if (config === "") {
            vscode.window.showInformationMessage("Unable to locate the project configuration");
            return;
        }

        if (settingsUpdated) {
            iarConfig
                .update("settings", { path: path, project: project, config: config }, vscode.ConfigurationTarget.Workspace)
                .then(undefined, (reason) => {
                    console.log("Unable to update the IAR path: " + reason);
            });
        }

        if (typeof iar === 'undefined' || iar === null) { 
            iar = new Iar.Iar(resolve(path), resolve(project), config, folder);
        }

        if(iar.inProgress() == false) {
            iar.setVerbose(iarConfig.verbose);
            iar.build();
        }
    });

    context.subscriptions.push(disposable);
}

async function parseProjectForConfig(projectFile: any): Promise<string> {
    let projectXml = fs.readFileSync(projectFile, "utf8");

    return await xml2js.parseStringPromise(projectXml).then((projectData) => {
        if (projectData.project.hasOwnProperty("configuration")) {
            return projectData.project.configuration[0].name[0] as string;
        }
        return "";
    });
}

export function deactivate() { }
