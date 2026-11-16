import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {build} from 'esbuild';
const assets={};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
async function collect(dir,prefix=''){for(const file of await readdir(dir,{withFileTypes:true})){if(file.isDirectory())await collect(dir+'/'+file.name,prefix+'/'+file.name);else {const name=prefix+'/'+file.name;const ext=name.slice(name.lastIndexOf('.'));assets[name]={type:types[ext]||'application/octet-stream',body:(await readFile(dir+'/'+file.name)).toString('base64')};}}}
await collect('dist');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',banner:{js:'const ASSETS='+JSON.stringify(assets)+';'}});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built private translation Worker with embedded app assets');
