import * as vscode from 'vscode';
import { IarBuildTaskTerminal } from './iarBuildTaskTerminal';
import { IarParameters } from './iarParameters';
import { IarProject } from './iarProject';

interface IarBuildTaskDefinition extends vscode.TaskDefinition {
    configuration: string;
    buildType: string;
    verbose?: boolean;
}

export class IarBuildTaskProvider implements vscode.TaskProvider {
    static IarBuildScriptType: string = 'iar';
    private tasks: vscode.Task[] | undefined;

    private outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("IAR");

    constructor(private workspaceRoot: string) { }

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        const configuration: string = _task.definition.configuration;
        const buildType: string = _task.definition.buildType;
        if (configuration && buildType) {
            const definition: IarBuildTaskDefinition = <any>_task.definition;
            return this.getTask(definition.configuration, definition.buildType, definition.verbose, definition);
        }
        return undefined;
    }

    private async getTasks(): Promise<vscode.Task[]> {
        if (this.tasks !== undefined) {
            return this.tasks;
        }
        
        this.tasks = [];
        var projectFile = IarParameters.getProjectFile();
        if (projectFile) {
            const configurations: string[] = await IarProject.parseProjectConfigurations(projectFile);
            const buildTypes: string[] = ['make', 'build', 'clean'];

            configurations.forEach(configuration => {
                buildTypes.forEach(buildType => {
                    this.tasks!.push(this.getTask(configuration, buildType));
                });
            });
        }
        return this.tasks;
    }

    private getTask(configuration: string, buildType: string, verbose?: boolean, definition?: IarBuildTaskDefinition): vscode.Task {
        if (definition === undefined) {
            definition = {
                type: IarBuildTaskProvider.IarBuildScriptType,
                configuration,
                buildType,
                verbose
            };
        }
        return new vscode.Task(definition, vscode.TaskScope.Workspace, `${configuration} ${buildType}`,
            IarBuildTaskProvider.IarBuildScriptType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                return new IarBuildTaskTerminal(this.workspaceRoot, configuration, buildType, verbose ? verbose : false, () => this.outputChannel);
            }));
    }
}

