"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const dbIniParser = require("./utils/db-ini-parser");
const dbUtils = require("./utils/db-utils");
const path = require("path");
const oracledb = require("oracledb");
const async = require("async");
const select_results_panel_1 = require("./select-results-panel");
function showError(msg) {
    vscode.window.showErrorMessage(msg);
}
function showInfo(msg) {
    vscode.window.showInformationMessage(msg);
}
function ascForDbAndDoSqlCommand(cmd) {
    let te = vscode.window.activeTextEditor;
    if (!te) {
        showError('Команда доступа только при открытом редакторе');
        return;
    }
    const { dbIndex, dbDescs } = dbIniParser.parseDbIni();
    vscode.window.showQuickPick(dbDescs, { canPickMany: false, placeHolder: 'Choose Database...' })
        .then((chosen) => {
        if (undefined === chosen)
            return;
        let db = dbIndex[chosen];
        cmd(db, te);
    }, (err) => {
        showError(err.message);
    });
}
function activate(context) {
    let channel = vscode.window.createOutputChannel('Omega SQL');
    function showSqlResults(db, sqlplusStdout) {
        showInfo(`Скрипт был запущен на '${db.schema}@${db.server}' - ${db.name}`);
        let formatedSqlplusStdout = sqlplusStdout.split('\r\n\r\n').join('\n');
        channel.clear();
        channel.appendLine(`  --- ${db.schema}@${db.server} - ${db.name} ---`);
        channel.append(formatedSqlplusStdout);
        channel.show();
    }
    let disposable1 = vscode.commands.registerCommand('omp-tools.runScriptAtBase', function () {
        ascForDbAndDoSqlCommand((db, te) => {
            const sqlplusStdout = dbUtils.runInSqlplus(db, te.document.getText());
            showSqlResults(db, sqlplusStdout);
        });
    });
    let disposable2 = vscode.commands.registerCommand('omp-tools.runScriptAtBaseAndSaveHistory', function () {
        let te = vscode.window.activeTextEditor;
        if (!te) {
            vscode.window.showErrorMessage('Команда доступа только при открытом редакторе');
            return;
        }
        if (te.document.isUntitled) {
            vscode.window.showErrorMessage('Сохраните sql-скрипт под уникальным именем');
            return;
        }
        if (te.document.isDirty)
            te.document.save();
        const fileName = path.basename(te.document.fileName);
        let conn;
        ascForDbAndDoSqlCommand((db, te) => {
            oracledb.getConnection({ user: db.schema, password: db.schema, connectString: db.server })
                .then((c) => {
                conn = c;
                return conn.execute('select recdate from script_history where upper(name) = upper(:fileName)', [fileName]);
            })
                .then((result) => {
                if (result.rows.length !== 0) {
                    const dt = result.rows[0][0];
                    const dtStr = `${dt.toLocaleDateString('ru')} в ${dt.toLocaleTimeString('ru')}`;
                    vscode.window.showErrorMessage(`Скрипт ${fileName} уже запускался на базе ${db.schema}@${db.server} ${dtStr}`);
                    return;
                }
                const sqlText = te.document.getText() + "\n\n" + dbUtils.makeInsertScriptHistoryQuery(fileName);
                const sqlplusStdout = dbUtils.runInSqlplus(db, sqlText);
                showSqlResults(db, sqlplusStdout);
            })
                .catch((err) => {
                showError(err.message);
            })
                .then(() => {
                if (conn)
                    conn.close();
            });
        });
    });
    let disposable3 = vscode.commands.registerCommand('omp-tools.runScriptAtAllBases', function () {
        const { dbList } = dbIniParser.parseDbIni();
        let quickPick = vscode.window.createQuickPick();
        quickPick.items = dbList.map((db) => {
            return {
                label: db.name,
                description: db.version,
                detail: `${db.schema}/${db.server}`,
                'db': db
            };
        });
        quickPick.placeholder = "Choose databases...";
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.onDidAccept(() => {
            quickPick.hide();
            let te = vscode.window.activeTextEditor;
            if (!te) {
                vscode.window.showErrorMessage('Команда доступа только при открытом редакторе');
                return;
            }
            const sel = te.selection;
            let slqText = sel.isEmpty ? te.document.getText() : te.document.getText(sel);
            slqText = slqText.trim();
            if (slqText.lastIndexOf(';') === slqText.length - 1) {
                slqText = slqText.substr(0, slqText.length - 1);
            }
            const selResPanel = select_results_panel_1.SelectResultsPanel.createOrShow(context.extensionPath);
            const selDbList = quickPick.selectedItems.map((selItem) => selItem.db);
            selResPanel.addDatabases(selDbList);
            let q = async.queue((db, callback) => {
                const scriptStartTime = process.hrtime();
                let conn;
                async.series([
                    (next) => {
                        selResPanel.markAsStarted(db);
                        const connAttrs = {
                            user: db.schema,
                            password: db.schema,
                            connectString: db.server
                        };
                        oracledb.getConnection(connAttrs, (err, c) => {
                            if (err) {
                                selResPanel.addError(db, err.message);
                                return next(err);
                            }
                            conn = c;
                            next();
                        });
                    },
                    (next) => {
                        conn.execute(slqText, (err, res) => {
                            if (err) {
                                selResPanel.addError(db, err.message);
                                return next(err);
                            }
                            selResPanel.markAsSucceeded(db);
                            if (res.rows.length !== 0) {
                                selResPanel.appendResults(db, res);
                            }
                            next();
                        });
                    }
                ], (err) => {
                    const elapsed = process.hrtime(scriptStartTime)[1] / 1000000;
                    const elapsedStr = process.hrtime(scriptStartTime)[0] + " с, " + elapsed.toFixed(3) + " мс";
                    selResPanel.setDuration(db, elapsedStr);
                    if (conn) {
                        conn.close();
                    }
                    if (err) {
                        callback(err);
                    }
                    callback();
                });
            }, 6);
            q.drain(() => {
                console.log('all completed');
            });
            quickPick.selectedItems.forEach((selItem) => {
                q.push(selItem.db);
            });
        });
        quickPick.show();
    });
    context.subscriptions.push(disposable1);
    context.subscriptions.push(disposable2);
    context.subscriptions.push(disposable3);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map