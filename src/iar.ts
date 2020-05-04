import * as vscode from 'vscode';
import * as ch from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class Iar {
    private path:string;
    private project:string;
    private config:string;
    private folder:string;
    private errors:any;
    private warnings:any;
    private terminal: vscode.OutputChannel;
    private problems: any;
    private commands: any;
    private includes: any;
    private defines: any;
    private browse: any;
    private progress: boolean;
    private verbose: boolean;

    constructor(path: string, project: string, config: string, folder: string) {
        this.path = path;
        this.project = project;
        this.config = config;
        this.folder = folder;
        this.errors = -1;
        this.warnings = -1;
        this.terminal = vscode.window.createOutputChannel('IAR');
        this.problems = [];
        this.commands = [];
        this.includes = [];
        this.defines = [];
        this.browse = [];
        this.progress = false;
        this.verbose = false;
    }

    buildDatabaseArgs(cmd: string) {
        cmd += " --predef_macros"
        var next = 1;
        var arg_fixed = cmd.replace(/([a-zA-Z]:\\.*?)( -\S|$)/gm, "\"$1\"$2");
        var regex = /'.*?'|".*?"|\S+/g;
        var args = ['--IDE3', '--NCG'];
        var temp;
        while (temp = regex.exec(arg_fixed)) {
            var string = temp[0];
            if (string == '-o') {
                next = 0;
            }
            else {
                if (next !== 0) {
                    args.push(string.split('"').join(''));
                }
                else {
                    next = 1;
                }
            }
        }
        return args;
    }

    buildDatabaseSingle(cmd: string, inc: string[], def: string[]) {
        var args = this.buildDatabaseArgs(cmd);
        var defs;
        var tmpfile = os.tmpdir() + "\\" + path.basename(args[2].replace("\"", "")) + ".tmp";
        args.push(tmpfile);
        var spw = ch.spawnSync(this.path + "arm\\bin\\iccarm.exe", args);
        var temp;
        var inc_regex = new RegExp("^(\\$\\$TOOL_BEGIN\\s\\$\\$VERSION\\s\".*\"\\s\\$\\$INC_BEGIN\\s\\$\\$FILEPATH\\s\")(.*?)(\"\\s\\$\\$TOOL_END\\s)$", "gm");
        var buf = spw.output.toString();
        while (temp = inc_regex.exec(buf)) {
            inc.push(temp[2].split("\\\\").join("\\"));
        }

        if (fs.existsSync(tmpfile)) {
            def.push("_Pragma(x) =");
            def.push("__nounwind =");
            def.push("__absolute =");
            def.push("__arm =");
            def.push("__big_endian =");
            def.push("__fiq =");
            def.push("__interwork =");
            def.push("__intrinsic =");
            def.push("__irq =");
            def.push("__little_endian =");
            def.push("__nested =");
            def.push("__no_init =");
            def.push("__noreturn =");
            def.push("__packed =");
            def.push("__pcrel =");
            def.push("__ramfunc =");
            def.push("__root =");
            def.push("__sbrel =");
            def.push("__stackless =");
            def.push("__swi =");
            def.push("__task =");
            def.push("__thumb =");
            def.push("__weak =");

            defs = fs.readFileSync(tmpfile).toString();
            var def_regex = new RegExp("^(#define\\s)([^\\s]+\\s)(.*)$", "gm");
            while (temp = def_regex.exec(defs)) {
                def.push(temp[2] + '=' + temp[3]);
            }
            fs.unlinkSync(tmpfile);
        }
    }

    buildDatabase() {
        var i = 0;
        if (this.commands.length > 0) {
            var inc: string[] = [];
            var def: string[] = [];
            var tmpfile = os.tmpdir() + "\\temp1234.c";
            fs.writeFileSync(tmpfile, "#include <stdio.h>\nint main(void) {return 0}\n");
            var command = tmpfile + " " + this.commands[i][2]
            this.buildDatabaseSingle(command, inc, def);
            fs.unlinkSync(tmpfile);
            for (var j = 0, inc_len = inc.length; j < inc_len; j++) {
                var tmp = path.normalize(inc[j]);
                if (this.includes.indexOf(tmp) < 0)
                    this.includes.unshift(path.normalize(tmp));
            }
            for (var j = 0, def_len = def.length; j < def_len; j++) {
                if (this.defines.indexOf(def[j]) < 0)
                    this.defines.push(def[j]);
            }
        }
    }

    parseBuildOutput(build_output: string) {
        var temp;

        //Check specific error or warning
        var problem_regex = new RegExp("^(.*)(Warning|Error|Fatal Error)\\[.*\\]:\\s(.*)$", "gm");
        while (temp = problem_regex.exec(build_output)) {
            this.problems.push(temp);
        }

        var problem_regex = new RegExp("^(.*)(ERROR,).*$", "gm");
        while (temp = problem_regex.exec(build_output)) {
            this.problems.push(temp);
        }

        var problem_regex = new RegExp("^(.*)(Configuration is up).*$", "gm");
        while (temp = problem_regex.exec(build_output)) {
            this.problems.push(temp);
        }

        //Check total errors
        var error_regex = new RegExp("^Total number of errors: (\\d+)$", "gm");
        var error_regex_result = error_regex.exec(build_output);
        if (error_regex_result) {
            this.errors = error_regex_result[1];
        }

        //Check total warnings
        var warning_regex = new RegExp("^Total number of warnings: (\\d+)$", "gm");
        var warning_regex_result = warning_regex.exec(build_output);
        if (warning_regex_result) {
            this.warnings = warning_regex_result[1];
        }

        //Check compile commands:
        var icc_regex = new RegExp("^iccarm.exe (.*\\.c|.*\\.cpp) (.*)$", "gm");
        while (temp = icc_regex.exec(build_output)) {
            this.commands.push(temp);
        }
    }

    buildDatabaseConfig() {
        if (this.defines.length > 0 || this.includes.length > 0) {

            for (var i = 0, len = this.includes.length; i < len; i++) {
                if (this.browse.indexOf(this.includes[i]) < 0)
                    this.browse.push(this.includes[i]);
            }

            // Put the system includes at the end
            this.includes.sort((item1: string, item2: string) => this.sortIncludes(item1, item2));
            this.browse.sort((item1: string, item2: string) => this.sortIncludes(item1, item2));

            var name = this.folder + '\\.vscode\\c_cpp_properties.json';
            var browseConfig = {
                path: this.browse,
                limitSymbolsToIncludedHeaders: true,
                databaseFilename: ".vscode/browse.db"
            }

            var iar_config = {
                name: "IAR",
                intelliSenseMode: "clang-x64",
                compilerPath:"",
                browse: browseConfig,
                includePath: this.includes,
                defines: this.defines
            }

            var properties = {
                version: 3,
                configurations: [iar_config]
            }

            if (fs.existsSync(name)) {
                fs.unlinkSync(name);
            }
            fs.writeFileSync(name, JSON.stringify(properties, null, 4));
        }
    }

    private sortIncludes(item1: string, item2: string): number {
        var item1IsSystemInclude = item1.toUpperCase().startsWith(this.path.toUpperCase());
        var item2IsSystemInclude = item2.toUpperCase().startsWith(this.path.toUpperCase());

        if (item1IsSystemInclude && !item2IsSystemInclude) {
            return 1;
        }

        if (!item1IsSystemInclude && item2IsSystemInclude) {
            return -1;
        }

        return 0;
    }

    parseProject() {
        if (fs.existsSync(this.project)) {
            var temp;
            var buffer = fs.readFileSync(this.project);
            var regex = new RegExp("<file>[\\s\\S]*?<name>([\\s\\S]*?)<\\/name>[\\s\\S]*?<\\/file>", "gm");
            var proj_dir = path.dirname(this.project);
            while (temp = regex.exec(buffer.toString())) {
                var browsedir = path.dirname(path.normalize(temp[1].replace("$PROJ_DIR$", proj_dir))) + "\\";
                if (this.browse.indexOf(browsedir) < 0)
                    this.browse.push(browsedir);
            }
        }
    }

    setVerbose(value: boolean) {
        this.verbose = value;
    }
    
    inProgress() {
        return this.progress;
    }

    build() {
        var iar = this;
        iar.errors = -1;
        iar.warnings = -1;
        iar.problems = [];
        iar.commands = [];
        iar.includes = [];
        iar.defines = [];
        iar.browse = [];
        iar.progress = true;

        iar.parseProject();

        iar.terminal.show();
		iar.terminal.clear();
		vscode.workspace.saveAll(false);

        iar.terminal.appendLine('Building project: ' + iar.project + ' configuration: ' + iar.config);
        
        var task = os.cpus().length;

        var args: string[] = [iar.project.split("\\").join("\\\\"), '-make', iar.config ,'-log', 'all', '-parallel', task.toString()];
        var out = ch.spawn(iar.path + "common\\bin\\IarBuild.exe", args, { stdio: ['ignore', 'pipe', 'ignore'] });

        var buildOutput = '';
        out.stdout.on('data', function (data: any) {
            var buffer = data;
            if (iar.verbose) {
                iar.terminal.append(buffer.toString());
            } else {
                var temp;
                var asm_regex = new RegExp("^iasmarm.exe (.*\\.s) (.*)$", "gmi");
                while (temp = asm_regex.exec(buffer)) {
                    iar.terminal.appendLine(path.basename(temp[1]));
                }
                var icc_regex = new RegExp("^iccarm.exe (.*\\.c|.*\\.cpp) (.*)$", "gmi");
                while (temp = icc_regex.exec(buffer)) {
                    iar.terminal.appendLine(path.basename(temp[1]));
                }
                var link_regex = new RegExp("^ilinkarm.exe.*\\.o.*$", "gmi");
                if (temp = link_regex.exec(buffer)) {
                    iar.terminal.appendLine(' ');
                    iar.terminal.appendLine("Linking...");
                }
            }
            buildOutput += buffer;
        });

        out.on('close', function (code: number) {
            console.log('IAR build result: ' + code.toString());
            
            if (buildOutput) {
                iar.parseBuildOutput(buildOutput);

                if (iar.problems.length > 0) {
                    iar.terminal.appendLine(' ');
                    for (var i = 0, len = iar.problems.length; i < len; i++) {
                        iar.terminal.appendLine(iar.problems[i][0]);
                    }
                }

                if (iar.errors >= 0 || iar.warnings >= 0) {
                    iar.terminal.appendLine(' ');
                    iar.terminal.appendLine('Building database...');
                    iar.buildDatabase();
                    iar.buildDatabaseConfig();
                    iar.terminal.appendLine(' ');

                    iar.terminal.appendLine('Errors: ' + iar.errors);
                    iar.terminal.appendLine('Warning: ' + iar.warnings);
                }
            }
            else
            {
                iar.terminal.appendLine('Something went wrong...');
            }

            iar.terminal.appendLine(' ');
            iar.progress = false;
        })

        out.on('error', function (data: Error) {
            console.log('IAR build error message: ' + data.message);
            
            iar.terminal.appendLine('Error while starting IarBuild.exe. Open it with IAR Ide to fix it.');
        })
    }
}

