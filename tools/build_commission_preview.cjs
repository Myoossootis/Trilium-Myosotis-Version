const esbuild = require('../tmp-commission-ui/node_modules/esbuild');
const fs = require('node:fs');
const path = require('node:path');
esbuild.build({
    entryPoints: [process.argv[2] || 'tools/commission-ui-preview.jsx'], bundle:true, outfile:process.argv[3] || 'tmp-commission-ui/preview.js',
    jsx:'automatic', jsxImportSource:'preact', nodePaths:[path.resolve('tmp-commission-ui/node_modules')],
    plugins:[{name:'trilium-preview',setup(build){
        build.onResolve({filter:/^trilium:preact$/},()=>({path:'hooks',namespace:'trilium'}));
        build.onResolve({filter:/^trilium:api$/},()=>({path:'api',namespace:'trilium-api'}));
        build.onLoad({filter:/.*/,namespace:'trilium-api'},()=>({contents:"export const originEntity = {noteId:'MyoQuestBoard'};"}));
        build.onLoad({filter:/.*/,namespace:'trilium'},()=>({contents:"export {useState,useEffect,useRef} from 'preact/hooks';",resolveDir:path.resolve('tmp-commission-ui')}));
        build.onResolve({filter:/\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'raw'}));
        build.onLoad({filter:/.*/,namespace:'raw'},args=>({contents:'export default '+JSON.stringify(fs.readFileSync(args.path,'utf8'))}));
    }}]
}).catch(()=>process.exit(1));
