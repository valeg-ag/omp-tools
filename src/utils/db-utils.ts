import * as fs from 'fs';
import * as tmp from 'tmp';
import * as iconvlite from 'iconv-lite';
import * as shell from 'shelljs';

export function makeInsertScriptHistoryQuery(fileName: string) {
  return   "rollback;\n\n"
         + `insert into script_history(name) values('${fileName}');\n\n`
         + "commit;\n\n";
}

function makeTmpFileWithSql(sqlText: string) {
  const tmpFile = tmp.fileSync({ postfix: '.sql' });

  const docText1251Buffer = iconvlite.encode(sqlText, 'win1251');
  fs.writeFileSync( tmpFile.fd,  docText1251Buffer);

  return tmpFile.name;
}

export function runInSqlplusOrPsql(db: any, sqlText: string) {
  if( db.server_type === 'oracle') {
    return runInSqlplus(db, sqlText);
  } else {
    return runInPsql(db, sqlText);
  }
}

function runInSqlplus(db: any, sqlText: string) {
  const sqlFileName = makeTmpFileWithSql(sqlText);

  const login =`${db.schema}/${db.schema}@${db.server}`;
  const sqlplusCmd = `echo rollback; | sqlplus -S ${login} @${sqlFileName}`;

  const nodePath = shell.which('node'); // bug in shelljs. see https://github.com/shelljs/shelljs/issues/480
  if (!nodePath) {
      throw new Error('Не удалось найти node. Для работы данной команды необходимо наличие установленного node.js');
  }
  shell.config.execPath = nodePath.toString();

  const sqlplusProc = shell.exec(sqlplusCmd, { encoding: 'buffer' } );
  const stdout: any = sqlplusProc.stdout;

  return iconvlite.decode(stdout, 'win1251');
}

function runInPsql(db: any, sqlText: string) {
  const sqlFileName = makeTmpFileWithSql(sqlText);

// "-h " + database + " -U " + user + " -d " + user + " -p 5432"
// $ psql postgresql://work_dl:work_dl@omp07:5432
// set PGPASSWORD=work_dl| psql -h omp07 -U work_dl -d work_dl -p 5432 -a --file=d:/select1fromdual.sql
  //const uri_str =`postgresql://${db.schema.toLowerCase()}:${db.schema.toLowerCase()}@${db.server}:${db.server_port}`;
// set PGPASSWORD=work_dl& echo rollback; | psql -h omp07 -U work_dl -d work_dl -p 5432 -a --file=C:\\Users\\AVS\\AppData\\Local\\Temp\\tmp-7400lJaodXEIeZQX.sql
  const db_name = db.schema.toLowerCase();
  const uri_str =`psql -h ${db.server} -U ${db_name} -d ${db_name} -p ${db.server_port} -a`;
  const sqlplusCmd = `SET PGCLIENTENCODING=windows1251\ & set PGPASSWORD=${db_name}& echo rollback; | ${uri_str} --file=${sqlFileName}`;

  const nodePath = shell.which('node'); // bug in shelljs. see https://github.com/shelljs/shelljs/issues/480
  if (!nodePath) {
      throw new Error('Не удалось найти node. Для работы данной команды необходимо наличие установленного node.js');
  }
  shell.config.execPath = nodePath.toString();

  const sqlplusProc = shell.exec(sqlplusCmd, { encoding: 'buffer' } );
  const stdout: any = sqlplusProc.stdout;
  const stderr: any = sqlplusProc.stderr;

  const stdoutStr = iconvlite.decode(stdout, 'win1251');
  const stderrStr = iconvlite.decode(stderr, 'win1251');

  return stdoutStr + "\n" + stderrStr;
}
