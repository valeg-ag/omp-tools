import * as fs from 'fs';
import * as tmp from 'tmp';
import * as iconvlite from 'iconv-lite';
import * as shell from 'shelljs';

export function makeInsertScriptHistoryQuery(fileName: string) {
  return   "rollback;\n\n"
         + `insert into script_history(recdate, name) values(sysdate, '${fileName}');\n\n`
         + "commit;\n\n";
}

function makeTmpFileWithSql(sqlText: string) {
  const tmpFile = tmp.fileSync({ postfix: '.sql' });

  const docText1251Buffer = iconvlite.encode(sqlText, 'win1251');
  fs.writeFileSync( tmpFile.fd,  docText1251Buffer);

  return tmpFile.name;
}

export function runInSqlplus(db: any, sqlText: string) {
  const sqlFileName = makeTmpFileWithSql(sqlText);

  const login =`${db.schema}/${db.schema}@${db.server}`;
  const sqlplusCmd = `echo rollback; | sqlplus -S ${login} @${sqlFileName}`;

  shell.config.execPath = shell.which('node').toString() // bug in shelljs. see https://github.com/shelljs/shelljs/issues/480

  const sqlplusProc = shell.exec(sqlplusCmd, { encoding: 'buffer' } );
  const stdout: any = sqlplusProc.stdout

  return iconvlite.decode(stdout, 'win1251')
}
