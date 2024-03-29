Dev installation:

1. Install dependencies.

```bash
> npm install
```

2. Rebuild oracledb against the current installed Electron version. Correct electron version is version from VSCode.

You need to install Python 2.7 if you don't have one.

```bash
> npm install -g nan
> npm root -g
C:\Users\AvsOmega\AppData\Roaming\npm\node_modules
> set NODE_PATH=C:\Users\AvsOmega\AppData\Roaming\npm\node_modules

> .\node_modules\.bin\electron-rebuild.cmd --version=6.1.2 --arch=x64
√ Rebuild Complete
```

If we get some msbuild errors, first of all ensure that  msbuild does not exist in PATH folders. You can check it with command:

```bash
> where msbuild
INFO: Could not find files for the given pattern(s).
```
3. Create vsix-package:

You need to install `vsce` if you don't have one.

```bash
npm install -g vsce
```

```bash
> vsce package
Created: D:\projects\ompext4\ompext-0.0.1.vsix (3114 files, 12.82MB)
```

4. Publish extension

There are two options to publish extension:

4.1 vsce publish

```bash
> vsce publish
```

4.2 manual

4.2.1 Open https://marketplace.visualstudio.com/manage/publishers/avs in browser
4.2.2 Right click on the row with extension
4.2.3 Choose `Update` command
