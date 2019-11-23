"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const tmp = require("tmp");
const iconvlite = require("iconv-lite");
const shell = require("shelljs");
function makeInsertScriptHistoryQuery(fileName) {
    return "rollback;\n\n"
        + `insert into script_history(recdate, name) values(sysdate, '${fileName}');\n\n`
        + "commit;\n\n";
}
exports.makeInsertScriptHistoryQuery = makeInsertScriptHistoryQuery;
function makeTmpFileWithSql(sqlText) {
    const tmpFile = tmp.fileSync({ postfix: '.sql' });
    const docText1251Buffer = iconvlite.encode(sqlText, 'win1251');
    fs.writeFileSync(tmpFile.fd, docText1251Buffer);
    return tmpFile.name;
}
function runInSqlplus(db, sqlText) {
    const sqlFileName = makeTmpFileWithSql(sqlText);
    const login = `${db.schema}/${db.schema}@${db.server}`;
    const sqlplusCmd = `echo rollback; | sqlplus -S ${login} @${sqlFileName}`;
    shell.config.execPath = shell.which('node').toString(); // bug in shelljs. see https://github.com/shelljs/shelljs/issues/480
    const sqlplusProc = shell.exec(sqlplusCmd, { encoding: 'buffer' });
    const stdout = sqlplusProc.stdout;
    return iconvlite.decode(stdout, 'win1251');
}
exports.runInSqlplus = runInSqlplus;
//# sourceMappingURL=db-utils.js.map