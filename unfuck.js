'use strict';
// 混淆逻辑主模块（浏览器、Node共用）
const TOKENS=["!","+","[]","[","]"],MATCH={"[":"]","(":")"},
      IGNORED='\'"`',QUOTE_CHARS='\'"';
const SAFE_OPERATORS=`"+-=<>!&|^~{[(`; // 优先级等于或低于"+"，可安全修改后面的代码
const CACHE_MAXLEN=7;

export function genCache(cache,maxlen=CACHE_MAXLEN,str=""){
    // 生成jsfuck表达式缓存
    if(maxlen<=0)return;
    for(const c of TOKENS){
        if(str.slice(-2)=="!!" && c=="!")
            continue;
        let new_str=str+c;
        try{
            cache[new_str]=JSON.stringify(eval(new_str));
        } catch(err){}
        genCache(cache,maxlen-1,new_str);
    }
}

function isEscapedQuote(str,i){ // 是否为已经转义的引号
    let idx=i-1;
    while(idx>=0 && str[idx]=="\\")idx--;
    return idx>=0 && (i-idx+1) % 2 === 1;
}
function getStrBoundary(code,quote_chars=IGNORED){
    // 获取全部字符串边界，如："string"
    //                        ^开头 ^结尾索引(不包含)
    const stack=[],boundaries=[];
    let in_str_literal=false,pre_start=-1;
    for(let i=0;i<code.length;i++){
        if(quote_chars.includes(code[i])){
            if(in_str_literal){
                if(code[i]===stack[stack.length-1] && !isEscapedQuote(code,i)){
                    stack.pop();
                    in_str_literal=false;
                    boundaries.push([pre_start,i]);
                }
            } else if(!in_str_literal){
                stack.push(code[i]);
                in_str_literal=true;
                pre_start=i+1;
            }
        }
    }
    if(stack.length)
        throw new Error(`endless string literal ${stack[stack.length-1]}`);
    return boundaries;
}
function isInBoundary(boundaries,idx){
    // boundaries包含左边，不包含右边
    let l=0,r=boundaries.length-1;
    while(l<=r){
        const mid=Math.floor((l+r)/2);
        const [left,right]=boundaries[mid];
        if(idx>=right) l=mid+1;
        else if(idx<left) r=mid-1;
        else return true;
    }
    return false;
}
function escapeQuotes(str){
    // 将字符串中的",'转换为\",\'
    let pre_end=0;
    const result=[];
    for(let i=0;i<str.length;i++){
        if(QUOTE_CHARS.includes(str[i]) && !isEscapedQuote(str,i)){
            result.push(str.slice(pre_end,i));
            result.push(`\\${str[i]}`);
            pre_end=i+1;
        }
    }
    result.push(str.slice(pre_end));
    return result.join("");
}

function canEval(code){ // 是否可执行eval
    const strBoundary=getStrBoundary(code);
    const stack=[];
    for(let i=0;i<code.length;i++){
        if(!isInBoundary(strBoundary,i))
            if(code[i]==="("){
                let j=i-1;
                while(j>=0 && code[j]===" ") j--; // 跳过空格
                if(j>=0 && !SAFE_OPERATORS.includes(code[j]))
                    return false;
                stack.push(code[i])
            } else if("[{".includes(code[i])){
                stack.push(code[i]);
            } else if(code[i]==="," && !stack.length){
                return false; // 不允许外层逗号
            } else if(")]}".includes(code[i])) {
                if(!stack.length)return false;
                stack.pop();
            }
    }
    if(stack.length)return false;
    return true;
}
function simplifySource(expr){
    // 尝试用eval缩短表达式，可能返回null
    if(canEval(expr)){
        try{
            const res=eval(expr);
            if(["number","string"].includes(typeof res))
                return JSON.stringify(res);
        } catch(err){}
    }
    return null;
}
export function replaceExpr(code,cache,useEval=true){
    // 替换cache中已存在的表达式
    const stack=[],result=[],pre_ends=[];
    const strBoundary=getStrBoundary(code);
    for(let i=0;i<code.length;i++){
        if(isInBoundary(strBoundary,i))
            continue;
        if("([".includes(code[i])){
            stack.push([i,code[i]]);
        } else if("])".includes(code[i])){
            if(!stack.length)
                throw new Error(`extra ${code[i]} at ${i}`);
            const [start,char]=stack.pop();
            if(MATCH[char]!=code[i])
                throw new Error(`${char}${code[i]} mismatch at ${i}`);
            const slice=code.slice(start+1,i);
            let replaced=null;
            if(slice in cache){
                replaced=cache[slice];
            } else if(useEval) {
                replaced=simplifySource(slice);
            }
            if(replaced!==null){
                let pre_end=pre_ends[pre_ends.length-1];
                while(pre_end>start){ // fallback
                    result.splice(-2,2);pre_ends.pop();
                    pre_end=pre_ends[pre_ends.length-1];
                }
                result.push(code.slice(pre_end,start+1));
                result.push(replaced);
                pre_ends.push(i);
            }
        }
    }
    result.push(code.slice(pre_ends[pre_ends.length-1]));
    if(stack.length)
        throw new Error(`endless parenthese ${stack[stack.length-1][1]} at ${stack[stack.length-1][0]}`);

    const new_code = result.join("");
    const simplified = simplifySource(new_code); // 优化整段代码
    if(simplified!==null) return simplified;
    return new_code;
}

export function extractChars(code){
    // 提取字符，如将("str")[1]转换为"t"
    const strBoundary=getStrBoundary(code,QUOTE_CHARS);
    return code.replace(
        /\((["'])([^"']*?)\1\)\[(["']?)(\d+)\3\]/g, (match, quote, str, idxQuote, index, idx) => {
            if(isInBoundary(strBoundary,idx))
                return match;
            if(idx>=1 && !SAFE_OPERATORS.includes(code[idx-1]))
                return match;
            try {
                // 解析字符串字面量
                const parsedStr = JSON.parse(`"${str}"`);
                const char = parsedStr[parseInt(index)];
                const newStr = JSON.stringify(char);
                return newStr;
            } catch (err) {
                return match; // 解析失败，保留原样
            }
        }
    );
}

export function convertNumConcats(code){
    // 将"s"+[1]+[2]的格式转换为"s12"
    let strBoundary=getStrBoundary(code,QUOTE_CHARS);
    code = code.replace(/(["'])((\+\[\d+\])+)/g, function(match, quote, numStr, _, idx) {
        if(isInBoundary(strBoundary,idx+1))
            return match;
        return `${quote}+"${numStr.replace(/[\+\[\]]/g,"")}"`;
    });
    strBoundary=getStrBoundary(code,QUOTE_CHARS);
    code = code.replace(/((\[\d+\]\+)+)(["'])/g, function(match, numStr, _, quote, idx) {
        if(isInBoundary(strBoundary,idx))
            return match;
        let head="";
        if(idx>0 && !SAFE_OPERATORS.includes(code[idx-1])){
            head=numStr.match(/^\[\d+\]\+/)[0];
            numStr=numStr.slice(head.length);
        }
        return `${head}"${numStr.replace(/[\+\[\]]/g,"")}"+${quote}`;
    });
    return code;
}

function joinGroups(code,group){
    // 解析并拼接多组字符串
    const strs=[];
    for(const [l,r] of group){
        strs.push(JSON.parse(`"${escapeQuotes(code.slice(l,r))}"`));
    }
    return JSON.stringify(strs.join(""));
}
export function mergeStrConcats(code){
    // 合并类似"a"+"b"的字符串为"ab"
    const strBoundary=getStrBoundary(code,QUOTE_CHARS);
    if(!strBoundary.length) return code;
    const result=[],group=[strBoundary[0]];let pre_end=0;
    let [lastStart,lastEnd]=strBoundary[0];
    for(const [start,end] of strBoundary.slice(1)){
        if(start-1-lastEnd>2 || code[lastEnd+1]!=="+"){
            if(group.length>=2){
                result.push(code.slice(pre_end,group[0][0]-1));
                result.push(joinGroups(code,group));
                pre_end=group[group.length-1][1]+1;
            }
            group.length=0;
        }
        group.push([start,end]);
        [lastStart,lastEnd]=[start,end];
    }
    if(group.length>=2){
        result.push(code.slice(pre_end,group[0][0]-1));
        result.push(joinGroups(code,group));
        pre_end=group[group.length-1][1]+1;
    }
    result.push(code.slice(pre_end));
    return result.join("");
}

export function unfuckJS(code,cache,level=-1,loop=true){
    // level: 反混淆级别, loop: 是否多次反混淆
    let pre_code=code;
    while(true){
        if(level>=1 || level<0) code=replaceExpr(code,cache,level==1?false:true);
        if(level>=3 || level<0) code=extractChars(code);
        if(level>=5 || level<0) code=convertNumConcats(code);
        if(level>=4 || level<0) code=mergeStrConcats(code);
        if(!loop || pre_code===code)break;
        pre_code=code;
    }
    return code;
}