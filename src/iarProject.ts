import * as fs from 'fs';
import * as xml2js from 'xml2js';

export module IarProject {
    export async function parseProjectConfigurations(projectFile: any): Promise<string[]> {
        let projectXml = fs.readFileSync(projectFile, "utf8");
    
        return await xml2js.parseStringPromise(projectXml).then((projectData) => {
            if (projectData.project.hasOwnProperty("configuration")) {
                var configurations: string[] = [];
                projectData.project.configuration.forEach((configuration: { name: string[]; }) => {
                    configurations.push(configuration.name[0] as string);
                });
                return configurations;
            }
            return [];
        });
    }        
}