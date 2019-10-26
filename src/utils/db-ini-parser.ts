import * as vscode from 'vscode';
import * as fs from 'fs';
import * as iconvlite from 'iconv-lite';

export function parseDbIni() {
    const ompDbIntPath = vscode.workspace.getConfiguration('ompDbIni').get<string>('path', '');

    const ompDbFileBuffer = fs.readFileSync(ompDbIntPath);
    const ompDbFileStr = iconvlite.decode(ompDbFileBuffer, 'win1251');

    let version = '';

    let lines = ompDbFileStr.split(/\r?\n/) 
    let dbList = lines.map( (line: string) => {
        if( !line.startsWith('Schema') )
            return undefined;

        let n = line.indexOf('=');
        if( -1 === n )
            return undefined;

        line = line.substr( n + 1 );

        n = line.indexOf('@');
        if( -1 === n )
            return undefined;
      
        let server = line.substr(0, n).trim();
//    if( server === 'O' )
//      return undefined;

        line = line.substr(n + 1);

        n = line.indexOf('@');
        if( -1 === n )
            return undefined;

        let schema = line.substr(0, n).trim()

        line = line.substr(n + 1);

        if(server === 'O') {
            if( line.startsWith('---- только для Daily')) {
                version = 'daily';
            }
            else if( line.startsWith('---- только для Weekly')) {
                version = 'weekly';
            }
            else if( line.startsWith('---- только для Stable')) {
                version = 'stable';
            }

            return undefined;
        }

        return {
            'server': server,
            'schema': schema,
            'name': line,
            'version': version,
            'desc': line + ' - ' + schema + '/' + server
        }
    }).filter( (db: any) => {
        return ( undefined !== db );
    });

    let dbIndex : any = {};
    dbList.forEach( ( db: any ) => { dbIndex[ db.desc ] = db; });

    const dbDescs = dbList.map( (db: any) => db.desc );
    
    return {dbList, dbIndex, dbDescs};
}
