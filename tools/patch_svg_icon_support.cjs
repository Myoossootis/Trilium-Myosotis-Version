// Preserve all unrelated ASAR content and unpacked entries; append changed files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const helper=fs.readFileSync(path.join(root,'customizations/svg-icons/runtime.js'),'utf8');
function replace(source, before, after) {
    if(source.split(before).length!==2) throw Error('Runtime patch anchor missing/ambiguous: '+before.slice(0,100));
    return source.replace(before,after);
}
function transform(file,source) {
    if(source.includes('function myoSafeSvg(')) {
        source=source.replace('content:""!important;display:block;position:absolute;inset:0;background-color:currentColor;', 'content:""!important;display:block;position:absolute;inset:0;width:1em;height:1em;margin:auto;flex-shrink:0;background-color:currentColor;');
        if(file!=='main.cjs')source=source.replace('svg:t.format===`svg`?myoSafeSvg(n?.svg):void 0','svg:typeof n?.svg===`string`?myoSafeSvg(n.svg):void 0').replace('+`\\\\n`+v','+`\\n`+v');
        return source;
    }
    if(file==='main.cjs') {
        source=replace(source,'function n9r(e){',helper+'\nfunction n9r(e){');
        source=replace(source,'let r=i9r(e);if(!r||!r.attachmentId)', 'if(t.format==="svg"){try{myoSvgCss(t,"myo-validate")}catch(err){Ee().error("Invalid SVG icon pack: "+err.message);return}}let r=t.format==="svg"?{mime:"image/svg+xml",attachmentId:"svg-inline"}:i9r(e);if(!r||!r.attachmentId)');
        source=replace(source,'function REt({manifest:e,fontMime:t,builtin:r,fontAttachmentId:n,prefix:i},a){try{','function REt({manifest:e,fontMime:t,builtin:r,fontAttachmentId:n,prefix:i},a){try{if(e.format==="svg")return myoSvgCss(e,i);');
        source=replace(source,'for(let i of this.iconPacks){let a=GA.MIME_TO_EXTENSION_MAPPINGS[i.fontMime]', 'for(let i of this.iconPacks){if(i.manifest.format==="svg")continue;let a=GA.MIME_TO_EXTENSION_MAPPINGS[i.fontMime]');
    } else {
        source=helper+'\n'+source;
        source=replace(source,'f=a(()=>A(c),[c])','f=a(()=>u.ok&&u.format===`svg`?myoSvgCss({icons:Object.fromEntries(u.icons.map(e=>[e.id,e]))},`myo-svg-preview`)+`\n`+v:A(c),[c,u])');
        source=replace(source,'className:`ip-glyph`,children:e.glyph','className:e.svg?`ip-glyph myo-svg-preview ${e.id}`:`ip-glyph`,children:e.svg?``:e.glyph');
        source=replace(source,'{ok:!0,icons:Object.entries(n)', '{ok:!0,format:t.format,icons:Object.entries(n)');
        source=replace(source,'return{id:e,glyph:typeof n?.glyph', 'return{id:e,svg:typeof n?.svg===`string`?myoSafeSvg(n.svg):void 0,glyph:typeof n?.glyph');
        source=replace(source,'let n=t?.icons;return!n', 'let n=t?.icons;if(t?.format===`svg`){try{myoSvgCss(t,`myo-validate`)}catch{return{ok:!1}}}return!n');
    }
    return source;
}
function entry(header,file){return file.split('/').reduce((n,s)=>n.files[s],header);}
function readArchive(file){const bytes=fs.readFileSync(file),size=bytes.readUInt32LE(4),len=bytes.readUInt32LE(12);return{bytes,start:8+size,header:JSON.parse(bytes.subarray(16,16+len))};}
function headerHash(bytes){return crypto.createHash('sha256').update(bytes.subarray(16,16+bytes.readUInt32LE(12))).digest('hex');}
function updateExecutableIntegrity(input,oldHash,newHash){
    const exe=Buffer.from(input),pe=exe.readUInt32LE(0x3c);
    if(exe.toString('ascii',pe,pe+4)!=='PE\0\0')throw Error('Invalid PE executable');
    const optional=pe+24,magic=exe.readUInt16LE(optional),directory=optional+(magic===0x20b?112:magic===0x10b?96:0);
    if(directory===optional)throw Error('Unsupported PE executable');
    const sections=pe+24+exe.readUInt16LE(pe+20),count=exe.readUInt16LE(pe+6);
    let resource=null;
    for(let i=0;i<count;i++){const s=sections+i*40;if(exe.toString('ascii',s,s+8).replace(/\0/g,'')==='.rsrc')resource={start:exe.readUInt32LE(s+20),size:exe.readUInt32LE(s+16)};}
    if(!resource)throw Error('PE resource section missing');
    const expected=`"file":"resources\\\\app.asar","alg":"SHA256","value":"${oldHash}"`;
    const area=exe.subarray(resource.start,resource.start+resource.size),at=area.indexOf(expected);
    if(at<0||area.indexOf(expected,at+1)>=0)throw Error('Executable/ASAR integrity mismatch or ambiguous resource; refusing deployment');
    const location=resource.start+at+expected.indexOf(oldHash);
    exe.write(newHash,location,64,'ascii');
    // This is a custom build: detach the now-invalid official Authenticode
    // signature rather than present an invalid official signature to Windows.
    exe.fill(0,directory+4*8,directory+5*8);exe.writeUInt32LE(0,optional+64);
    return exe;
}
function patchArchive(archive){
    if(process.platform==='win32'){
        const target=path.resolve(path.dirname(archive),'..','trilium.exe').replace(/'/g,"''");
        const running=require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-Command',`@(Get-Process trilium -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${target}' }).Count`],{encoding:'utf8',windowsHide:true}).trim();
        if(running!=='0')throw Error('Close all Trilium windows before updating its executable and archive');
    }
    const {bytes,start,header}=readArchive(archive),chunks=[bytes.subarray(start)];let offset=chunks[0].length,changed=0;
    for(const file of ['main.cjs','public/src/IconPackPreview-C_UIBQX5.js']){
        const node=entry(header,file),source=bytes.subarray(start+Number(node.offset),start+Number(node.offset)+node.size).toString('utf8');
        const next=transform(file,source);if(next===source)continue;
        const data=Buffer.from(next);node.offset=String(offset);node.size=data.length;offset+=data.length;chunks.push(data);changed++;
        if(node.integrity){const size=node.integrity.blockSize||4194304,hash=b=>crypto.createHash('sha256').update(b).digest('hex');node.integrity={algorithm:'SHA256',hash:hash(data),blockSize:size,blocks:[]};for(let i=0;i<data.length;i+=size)node.integrity.blocks.push(hash(data.subarray(i,i+size)));}
    }
    if(!changed){
        const executable=path.resolve(path.dirname(archive),'..','trilium.exe');
        updateExecutableIntegrity(fs.readFileSync(executable),headerHash(bytes),headerHash(bytes));
        return console.log('Already supports SVG; executable/ASAR integrity pair verified:',archive);
    }
    const json=Buffer.from(JSON.stringify(header)),padding=(4-json.length%4)%4,h=Buffer.alloc(8+json.length+padding);
    h.writeUInt32LE(4+json.length+padding,0);h.writeUInt32LE(json.length,4);json.copy(h,8);
    const prefix=Buffer.alloc(8);prefix.writeUInt32LE(4,0);prefix.writeUInt32LE(h.length,4);
    const output=Buffer.concat([prefix,h,...chunks]);
    const exePath=path.resolve(path.dirname(archive),'..','trilium.exe'),originalExe=fs.readFileSync(exePath);
    const newExe=updateExecutableIntegrity(originalExe,headerHash(bytes),headerHash(output));
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const backup=archive+'.before-svg-'+stamp,exeBackup=exePath+'.before-svg-'+stamp;
    fs.copyFileSync(archive,backup);fs.copyFileSync(exePath,exeBackup);
    const pending=archive+'.svg-pending',exePending=exePath+'.svg-pending';
    fs.writeFileSync(pending,output);fs.writeFileSync(exePending,newExe);
    try{fs.writeFileSync(exePath,newExe);fs.writeFileSync(archive,output);}
    catch(error){fs.writeFileSync(exePath,originalExe);fs.writeFileSync(archive,bytes);throw error;}
    const verify=readArchive(archive);for(const file of ['main.cjs','public/src/IconPackPreview-C_UIBQX5.js']){const n=entry(verify.header,file);if(!verify.bytes.subarray(verify.start+Number(n.offset),verify.start+Number(n.offset)+n.size).includes(Buffer.from('function myoSafeSvg(')))throw Error('Archive verification failed');}
    const deployedExe=fs.readFileSync(exePath);
    if(!deployedExe.includes(Buffer.from(headerHash(verify.bytes))))throw Error('Deployed executable header digest mismatch');
    console.log('SVG support installed with matching EXE integrity resource (unsigned custom build), backups:',backup,exeBackup);
}
if(require.main===module){
    const args=process.argv.slice(2);
    if(args[0]==='--source'){
        const directory=path.resolve(args[1]);
        for(const file of ['main.cjs','public/src/IconPackPreview-C_UIBQX5.js']){
            const target=path.join(directory,file);const source=fs.readFileSync(target,'utf8');const next=transform(file,source);
            if(next!==source){fs.copyFileSync(target,target+'.before-svg');fs.writeFileSync(target,next);}
        }
    }else for(const archive of args)patchArchive(path.resolve(archive));
}
module.exports={transform,readArchive,headerHash,updateExecutableIntegrity};
