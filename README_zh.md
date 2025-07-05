[[English](README.md) | 中文]

一个轻量级的JSFxxk反混淆工具，可反混淆[jsfuck.com](https://jsfuck.com)混淆过的js脚本。

## 用法

#### 浏览器

直接打开[js-deobfuscate.github.io](https://js-deobfuscate.github.io)即可。

#### Node.js

运行：
```
git clone https://github.com/qfcy/jsunfxxk
cd jsunfxxk
node main.js <1个或多个待反混淆js脚本的路径>
```
会在每个脚本的同一目录下，生成对应的`_deobfuscated.js`文件。