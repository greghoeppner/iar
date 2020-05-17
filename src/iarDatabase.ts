import * as path from 'path';
import * as ch from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

export class IarDatabase {
    private defines: string[] = [];
    private includes: string[] = [];

    constructor(private workspaceRoot: string, private iarPath: string, private project: string) {
        this.addDefaultDefines();
    }

    private addDefaultDefines() {
        this.defines.push("_Pragma(x) =");
        this.defines.push("__nounwind =");
        this.defines.push("__absolute =");
        this.defines.push("__arm =");
        this.defines.push("__big_endian =");
        this.defines.push("__fiq =");
        this.defines.push("__interwork =");
        this.defines.push("__intrinsic =");
        this.defines.push("__irq =");
        this.defines.push("__little_endian =");
        this.defines.push("__nested =");
        this.defines.push("__no_init =");
        this.defines.push("__noreturn =");
        this.defines.push("__packed =");
        this.defines.push("__pcrel =");
        this.defines.push("__ramfunc =");
        this.defines.push("__root =");
        this.defines.push("__sbrel =");
        this.defines.push("__stackless =");
        this.defines.push("__swi =");
        this.defines.push("__task =");
        this.defines.push("__thumb =");
        this.defines.push("__weak =");
    }

    build(buildCommand: string) {
        var tempFilePath = path.join(os.tmpdir(), "temp1234.c");
        this.createTempFile(tempFilePath);
        var command = tempFilePath + " " + buildCommand;
        this.buildDatabaseSingle(command);
        fs.unlinkSync(tempFilePath);
    }

    private createTempFile(tempFilePath: string) {
        fs.writeFileSync(tempFilePath, "#include <stdio.h>\nint main(void) {return 0;}\n");
    }

    private buildDatabaseSingle(cmd: string) {
        var args = this.getBuildArgs(cmd);
        var tmpfile = os.tmpdir() + "\\" + path.basename(args[2].replace("\"", "")) + ".tmp";
        args.push(tmpfile);
        var spw = ch.spawnSync(this.iarPath + "arm\\bin\\iccarm.exe", args);

        this.buildIncludesFromOutput(spw.output.toString());

        if (fs.existsSync(tmpfile)) {
            var fileData = fs.readFileSync(tmpfile).toString();
            this.buildDefinesFromOutput(fileData);
            fs.unlinkSync(tmpfile);
        }
    }

    private buildIncludesFromOutput(output: string) {
        const includesRegExp = new RegExp("^(\\$\\$TOOL_BEGIN\\s\\$\\$VERSION\\s\".*\"\\s\\$\\$INC_BEGIN\\s\\$\\$FILEPATH\\s\")(.*?)(\"\\s\\$\\$TOOL_END\\s)$", "gm");
        var result;
        while (result = includesRegExp.exec(output)) {
            var include = path.normalize(result[2].split("\\\\").join("\\"));
            if (this.includes.indexOf(include) < 0) {
                this.includes.unshift(include);
            }
        }
    }

    private buildDefinesFromOutput(fileData: string) {
        const definesRegExp = new RegExp("^(#define\\s)([^\\s]+\\s)(.*)$", "gm");
        var result;
        while (result = definesRegExp.exec(fileData)) {
            this.defines.push(result[2] + '=' + result[3]);
        }
    }

    private getBuildArgs(cmd: string) {
        cmd += " --predef_macros"
        var next: boolean = true;
        var fixedArgs = cmd.replace(/([a-zA-Z]:\\.*?)( -\S|$)/gm, "\"$1\"$2");
        var regex = /'.*?'|".*?"|\S+/g;
        var args = ['--IDE3', '--NCG'];
        var result;
        while (result = regex.exec(fixedArgs)) {
            var string = result[0];
            if (string == '-o') {
                next = false;
            }
            else if (next) {
                args.push(string.split('"').join(''));
            }
            else {
                next = true;
            }
        }
        return args;
    }

    writeConfig() {
        if (this.defines.length > 0 || this.includes.length > 0) {
            var browse: string[] = [];
            this.parseProjectPaths(browse);
            this.addCompilerIncludes(browse);
    
            // Put the system includes at the end
            this.includes.sort((item1: string, item2: string) => this.sortIncludes(item1, item2));
            browse.sort((item1: string, item2: string) => this.sortIncludes(item1, item2));

            var name = this.workspaceRoot + '\\.vscode\\c_cpp_properties.json';
            var browseConfig = {
                path: browse,
                limitSymbolsToIncludedHeaders: true,
                databaseFilename: ".vscode/browse.db"
            }

            var iarConfig = {
                name: "IAR",
                intelliSenseMode: "clang-x64",
                compilerPath: "",
                browse: browseConfig,
                includePath: this.includes,
                defines: this.defines
            }

            var properties = {
                version: 3,
                configurations: [iarConfig]
            }

            if (fs.existsSync(name)) {
                fs.unlinkSync(name);
            }

            fs.writeFileSync(name, JSON.stringify(properties, null, 4));
        }
    }

    private parseProjectPaths(browse: string[]) {
        if (fs.existsSync(this.project)) {
            var buffer = fs.readFileSync(this.project);
            var regex = new RegExp("<file>[\\s\\S]*?<name>([\\s\\S]*?)<\\/name>[\\s\\S]*?<\\/file>", "gm");
            var projectFolder = path.dirname(this.project);
            var result;
            while (result = regex.exec(buffer.toString())) {
                var browsedir = path.dirname(path.normalize(result[1].replace("$PROJ_DIR$", projectFolder))) + "\\";
                if (browse.indexOf(browsedir) < 0) {
                    browse.push(browsedir);
                }
            }
        }
    }

    private addCompilerIncludes(browse: string[]) {
        for (var i = 0; i < this.includes.length; i++) {
            if (browse.indexOf(this.includes[i]) < 0) {
                browse.push(this.includes[i]);
            }
        }
    }

    private sortIncludes(item1: string, item2: string): number {
        var item1IsSystemInclude = item1.toUpperCase().startsWith(this.iarPath.toUpperCase());
        var item2IsSystemInclude = item2.toUpperCase().startsWith(this.iarPath.toUpperCase());

        if (item1IsSystemInclude && !item2IsSystemInclude) {
            return 1;
        }

        if (!item1IsSystemInclude && item2IsSystemInclude) {
            return -1;
        }

        return 0;
    }
}