// Node.js中运行
import {genCache,unfuckJS,CACHE_MAXLEN} from "./unfuck.js";
import fs from 'fs';

const CACHE_FILE="cache.json";

let _cache={};
if(fs.existsSync(CACHE_FILE)){
    console.log("Loading cache ...");
    _cache=JSON.parse(fs.readFileSync(CACHE_FILE,"utf8"));
} else {
    console.log(`Building cache (maxlen=${CACHE_MAXLEN}), please wait ...`);
    genCache(_cache);
    console.log(`Build complete, size: ${Object.keys(_cache).length}.`)
    fs.writeFileSync(CACHE_FILE,JSON.stringify(_cache),"utf8");
}

for(const filename of process.argv.slice(2)){
    const code=fs.readFileSync(filename,"utf8");
    const outputFile=filename.slice(0,filename.lastIndexOf("."))+"_deobfuscated.js";
    fs.writeFileSync(outputFile,unfuckJS(code,_cache),"utf8");
    console.log(`Successfully deobfuscated ${filename} to ${outputFile}`);
}