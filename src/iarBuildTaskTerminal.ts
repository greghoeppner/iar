import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import * as ch from 'child_process';
import {IarParameters} from './iarParameters';
import {IarDatabase} from "./iarDatabase";

export class IarBuildTaskTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<void>();
    onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    constructor(private workspaceRoot: string, private configuration: string, private buildType: string, 
        private verbose: boolean, private getOutputChannel: () => vscode.OutputChannel) {
    }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.doBuild();
    }

    close(): void {
    }

    private write(message: string) {
        // Problem Matches for Pseudoterminals don't seem to work, so write it to terminal instead.
        this.writeEmitter.fire(message + os.EOL);
        this.getOutputChannel().appendLine(message);
    }

    private async doBuild(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.getOutputChannel().clear();
            this.getOutputChannel().show();
            var project = IarParameters.getProjectFile();
            var iarPath = IarParameters.getIarPath();

            if (project == undefined) {
                this.write("Unable to build due to missing project file");
                this.closeEmitter.fire();
                resolve();
                return;
            }

            if (iarPath == undefined) {
                this.write("Unable to build due to missing IAR installation path");
                this.closeEmitter.fire();
                resolve();
                return;
            }

            this.write('Building project: ' + project + ' configuration: ' + this.configuration);

            var args: string[] = [project.split("\\").join("\\\\"), '-' + this.buildType, this.configuration ,'-log', 'all', '-parallel', os.cpus().length.toString()];
            var out = ch.spawn(iarPath + "common\\bin\\IarBuild.exe", args, { stdio: ['ignore', 'pipe', 'ignore'] });
    
            var buildOutput = '';
            out.stdout.on('data', (data: any) => {
                if (this.verbose) {
                    this.write(data.toString());
                } else {
                    var temp;
                    var asm_regex = new RegExp("^iasmarm.exe (.*\\.s) (.*)$", "gmi");
                    while (temp = asm_regex.exec(data)) {
                        this.write(path.basename(temp[1]));
                    }
                    var icc_regex = new RegExp("^iccarm.exe (.*\\.c|.*\\.cpp) (.*)$", "gmi");
                    while (temp = icc_regex.exec(data)) {
                        this.write(path.basename(temp[1]));
                    }
                    var link_regex = new RegExp("^ilinkarm.exe.*\\.o.*$", "gmi");
                    if (temp = link_regex.exec(data)) {
                        this.write(os.EOL + "Linking...");
                    }
                }
                buildOutput += data;
            });
    
            out.on('close', (code: number) => {
                console.log('IAR build result: ' + code.toString());
                
                if (buildOutput) {
                    var errors = this.getBuildErrors(buildOutput);
                    if (errors.length > 0) {
                        this.write(' ');
                        errors.forEach(error => {
                            this.write(error);
                        });
                    }

                    var upToDateMessage = this.getConfigurationUpToDateMessage(buildOutput);
                    if (upToDateMessage) {
                        this.write(' ');
                        this.write(upToDateMessage);
                    }

                    var command = this.getCompileCommand(buildOutput);
                    if (command) {
                        this.write(' ');
                        this.write('Building database...');
                        var database = new IarDatabase(this.workspaceRoot, iarPath ? iarPath : "", project ? project : "");
                        database.build(command);
                        database.writeConfig();
                    }
    
                    var totalWarnings = this.getTotalWarnings(buildOutput);
                    var totalErrors = this.getTotalErrors(buildOutput);
                    if (totalWarnings && totalErrors) {
                        this.write(' ');
                        this.write('Errors: ' + totalErrors);
                        this.write('Warnings: ' + totalWarnings);
                    }  
                }
                else
                {
                    this.write('Something went wrong...');
                }
    
                this.write(' ');
                this.closeEmitter.fire();
                resolve();
            })
    
            out.on('error', (data: Error) => {
                console.log('IAR build error message: ' + data.message);
                this.write('Error while starting IarBuild.exe. Open it with IAR Ide to fix it.');
                this.closeEmitter.fire();
                resolve();
            })
        });
    }

    private getBuildErrors(buildOutput: string): string[] {
        const buildErrorRegExp = new RegExp("^(.*)(Warning|Error|Fatal Error)\\[.*\\]:\\s(.*)$", "gm");
        var problems: string[] = [];
        var result;
        while (result = buildErrorRegExp.exec(buildOutput)) {
            problems.push(result[0]);
        }

        const errorMessageRegExp = new RegExp("^(.*)(ERROR,).*$", "gm");
        while (result = errorMessageRegExp.exec(buildOutput)) {
            problems.push(result[0]);
        }

        return problems;
    }

    private getConfigurationUpToDateMessage(buildOutput: string): string | undefined {
        return this.findStringRegExp(buildOutput, "^(.*)(Configuration is up).*$", 0);
    }

    private getTotalErrors(buildOutput: string): string | undefined {
        return this.findStringRegExp(buildOutput, "^Total number of errors: (\\d+)$", 1);
    }

    private getTotalWarnings(buildOutput: string): string | undefined {
        return this.findStringRegExp(buildOutput, "^Total number of warnings: (\\d+)$", 1);
    }

    private getCompileCommand(buildOutput: string): string | undefined {
        return this.findStringRegExp(buildOutput, "^iccarm.exe (.*\\.c|.*\\.cpp) (.*)$", 2);
    }

    private findStringRegExp(data: string, pattern: string, index: number): string | undefined {
        const regExp = new RegExp(pattern, "gm");
        var result;
        while (result = regExp.exec(data)) {
            return result[index];
        }
        return undefined;
    }
}
