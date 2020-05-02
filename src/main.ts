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

        var project = "";
        if (settings.project == null) {
            await vscode.workspace.findFiles("*.ewp").then((value) => {
                project = value[0].fsPath;
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
        } else {
            config = settings.config as string;
        }

        if (config === "") {
            vscode.window.showInformationMessage("Unable to locate the project configuration");
            return;
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
