import * as vscode from 'vscode';

export module IarParameters {
    export function getProjectFile(): string | undefined {
        var config = vscode.workspace.getConfiguration("iar");
        return config.projectFile == null ? undefined : config.projectFile;
    }

    export function getIarPath(): string | undefined {
        var config = vscode.workspace.getConfiguration("iar");
        return config.installationPath == null ? undefined : config.installationPath;
    }
}