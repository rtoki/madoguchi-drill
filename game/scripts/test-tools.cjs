// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function engineSource(name){
 const typed=fs.existsSync(path.join(root,'engine',name.replace(/\.js$/,'.ts')));
 return fs.readFileSync(path.join(root,typed?'build/typescript':'engine',name),'utf8');
}

// Every case runs in a fresh Node process, preserving fixture/cache isolation.
function runSuites(suites,filename){
 const {spawnSync}=require('node:child_process'),{createRequire}=require('node:module');
 if(process.argv[2]==='--suite'){
  const [,name]=process.argv.splice(2,2);
  if(!Object.hasOwn(suites,name)){console.error('Unknown verification case: '+name);process.exitCode=1;return;}
  suites[name](createRequire(filename),{exports:{}},filename,path.dirname(filename));
  return;
 }
 for(const name of Object.keys(suites)){
  const result=spawnSync(process.execPath,[filename,'--suite',name,...process.argv.slice(2)],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status||1;return;}
 }
}
module.exports={engineSource,runSuites};
