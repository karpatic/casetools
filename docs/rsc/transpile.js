const importList = [];

document.addEventListener("DOMContentLoaded", async () => { await transpileJSX(); });

async function transpileJSX(){
    const scriptTags = document.querySelectorAll("script[type='text/jsx']");

    if (scriptTags.length === 0) {
        console.warn("No JSX scripts found.");
        return;
    }

    if (typeof Babel === "undefined") {
        const babelScript = document.createElement("script");
        babelScript.src = "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.22.9/babel.min.js";
        babelScript.onload = () => processScripts(scriptTags);
        document.head.appendChild(babelScript);
    } else {
        processScripts(scriptTags);
    }
}

async function processScripts(scriptTags) { 
    for (let scriptTag of scriptTags) {
        try {

            const basePath = scriptTag.src.split('/').slice(0, -1).join('/');
            // console.log('Transpiler: Base Path:', {basePath});

            // Grab the JSX code from the script tag
            let jsxCode; 
            if (scriptTag.src) {
                const response = await fetch(scriptTag.src);
                if (!response.ok) throw new Error(`Failed to load ${scriptTag.src}`);
                jsxCode = await response.text();
            } else { jsxCode = scriptTag.textContent; }

            // Process imports and transpile the JSX code
            const processedCode = await handleImports(jsxCode, basePath); 
            const transpiledCode = Babel.transform(processedCode, { presets: ['react', ['env', { modules: false }]] }).code; 

            // console.log('Transpiler Processed:', {processedCode});
            // Execute the transpiled code
            const scriptElement = document.createElement("script");
            scriptElement.type = "module";
            scriptElement.textContent = transpiledCode;
            document.body.appendChild(scriptElement);
        } catch (error) {
            console.error("Error processing JSX script:", error); 
        }
    }
    // console.log('Transpiler: Imported Modules:', importList);
}

async function handleImports(code, basePath) {
    // console.log('Transpiler: Handling Imports:', {basePath}, code);
    const lines = code.split("\n");
    const transformedLines = [];

    for (let line of lines) {
        if (line.includes("export")) continue;
        if (line.includes("import")) {

            // Skip comments
            const commentedOut = line.trim().startsWith('//');
            if (commentedOut) { 
                transformedLines.push(line);
                continue;
            }
            let importParts = line.trim().split(" ");
            let importPath = importParts.at(-1).replaceAll(/['";]/g, "");
            let moduleName = importPath.split('/').slice(-1)[0];  
 
            let done = false
            let inBrackets = false;
            let defaultExport = false;
            let namedExports = [];
            let imported = importParts.map((part) => { 
                part = part.trim().replaceAll(/['";]/g, "").replaceAll(',', '');
                if (done || ['import'].includes(part)) {
                    return false;
                }  
                if(['}', 'from'].includes(part)){  
                    done = true;
                    return false;
                } 
                if(part == '{' ){ 
                    inBrackets = true
                    return false
                }
                if (importList.includes(part)) {
                    return false;
                } else {  
                    // console.log('Transpiler: Part:', part);
                    importList.push(part); 
                    if(inBrackets){
                        namedExports.push(part)
                    }
                    else{
                        defaultExport = part;
                    }
                    return part;
                }             
            }).filter(Boolean);  

            // continue if nothing was added
            if(imported.length == 0) continue;

            // recreate the import line 
            // -> import React, {useEffect, useState} from 'react';
            // -> import React from 'react';
            // -> import {useEffect, useState} from 'react';
            let defaultAndNamed = defaultExport && namedExports.length > 0 ? `${defaultExport}, {${namedExports.join(', ')}}` : '';
            if(defaultAndNamed){
                line = `import ${defaultAndNamed} from '${importPath}'`
            }
            else if(defaultExport && !namedExports.length){
                line = `import ${defaultExport} from '${importPath}'`
            }
            else if(namedExports.length){
                line = `import {${namedExports.join(', ')}} from '${importPath}'`
            }
            else{
                console.log('Transpiler: ERROR: CHECK THIS OUT:', line);
                continue;
            }

            
            
            // ...existing import processing code...
            const hasNoExtension = !line.includes('.');  
            if (hasNoExtension) { 
                let alreadyLoaded = window[importParts[1]];  
                if (alreadyLoaded) { 
                    // console.log(`Transpiler: ScripTag: Window.${importParts[1]}`);
                    continue;
                }  
                const url = isInImportMap(importPath);
                if (url) {  
                    const newLine = line.replace(new RegExp(importPath + '(?!.*' + importPath + ')'), url);
                    transformedLines.push(newLine); 
                    continue;
                }
                else{
                    console.log('Transpiler: ERROR: CHECK THIS OUT:', line);
                    continue;
                }
            }   
 
            let formatPath = (path) => {
                // update path to handle ../ and ./
                let parts = path.split('/');
                let newPath = [];
                for (let part of parts) {
                    if (part == '..') {
                        newPath.pop();
                    } else if (part != '.') {
                        newPath.push(part);
                    }
                }
                return newPath.join('/');
            }

            // Get the full path for relative imports
            const isRelativePath = importPath.startsWith(".");
            let newBasePath = basePath;
            if (isRelativePath) {   
                const relBasePath = `${basePath}/${importPath.split('/').slice(0, -1).join('/')}`;
                importPath = `${relBasePath}/${importPath.split('/').slice(-1)}`;
                newBasePath = formatPath(relBasePath);
            }   
            // console.log(`%cTranspiler: Handling : ${importPath}`, 'background: #bada55; color: #222');

            // check if .js 
            const isJS = line.includes(".js");
            if(isJS) { 
                // created an animated console message with background color 
                const response = await fetch(importPath);
                if (!response.ok) throw new Error(`Failed to load ${importPath}`);
                const jsxContent = await response.text();

                const isJSX = line.includes(".jsx");
                if(isJSX){ 
                    // console.log('Transpiler: Transpiling:', line);  
                    const jsxText = await handleImports(jsxContent, newBasePath); 
                    transformedLines.push( jsxText ); 
                }
                else{
                    const jsxText = await handleImports(jsxContent, newBasePath); 
                    transformedLines.push( jsxText ); 
                }
            } 
        } else {
            transformedLines.push(line);
        }
    }

    return transformedLines.join("\n");
}

function isInImportMap(moduleName) { 
    const scriptTag = document.querySelector('script[type="importmap"]');
    if (!scriptTag) return false;
    
    try {
        const importMap = JSON.parse(scriptTag.textContent); 
        return importMap.imports && importMap.imports[moduleName];
    } catch (error) {
        console.error("Error parsing import map:", error);
        return false;
    }
}
