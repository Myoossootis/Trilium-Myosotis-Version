const fs = require("fs");

const archive = process.argv[2];
if (!archive) throw new Error("Missing app.asar path.");

const archiveBytes = fs.readFileSync(archive);
const headerSize = archiveBytes.readUInt32LE(4);
const jsonSize = archiveBytes.readUInt32LE(12);
const header = JSON.parse(archiveBytes.subarray(16, 16 + jsonSize).toString("utf8"));
const dataStart = 8 + headerSize;

function fileEntry(relativePath) {
    return relativePath.split("/").reduce((node, segment) => node.files[segment], header);
}

function patchSameSize(relativePath, transform) {
    const entry = fileEntry(relativePath);
    const start = dataStart + Number(entry.offset);
    const original = archiveBytes.subarray(start, start + entry.size).toString("utf8");
    let next = transform(original);
    const originalBytes = Buffer.byteLength(original);
    const nextBytes = Buffer.byteLength(next);
    if (nextBytes > originalBytes) {
        throw new Error(`${relativePath} grew by ${nextBytes - originalBytes} bytes; refusing unsafe in-place patch.`);
    }
    next += " ".repeat(originalBytes - nextBytes);
    const replacement = Buffer.from(next, "utf8");
    if (replacement.length !== entry.size) throw new Error(`Size mismatch for ${relativePath}.`);
    replacement.copy(archiveBytes, start);
}

patchSameSize("public/src/highlights_list_options-CDacMgg3.js", (source) => {
    const substitutions = [
        ["c.map(({val:e,titleKey:t})=>({val:e,title:i(t)}))", "c.map(({val:e,titleKey:t,title:r})=>({val:e,title:r||i(t)}))"],
        ["{val:`bgColor`,titleKey:`highlights_list.bg_color`,icon:`bx bx-highlight`}", "{val:`bgColor`,titleKey:`highlights_list.bg_color`},{val:`blockquote`,title:`警示框`}"],
        [",icon:`bx bx-bold`", ""],
        [",icon:`bx bx-italic`", ""],
        [",icon:`bx bx-underline`", ""],
        [",icon:`bx bx-font-color`", ""]
    ];
    for (const [before, after] of substitutions) {
        if (!source.includes(before)) throw new Error(`Options anchor missing: ${before}`);
        source = source.replace(before, after);
    }
    return source;
});

patchSameSize("public/src/desktop_layout-BMt2b2Ht.js", (source) => {
    const substitutions = [
        ["o=/<u>[\\s\\S]*?<\\/u>/g,s=``,c=``;", "o=/<u>[\\s\\S]*?<\\/u>/g,p=/<blockquote(?:\\s[^>]*)?>[\\s\\S]*?<\\/blockquote>/gi,s=``,c=``;"],
        ["t.includes(`underline`)&&(s+=`,u:not(section.include-note u)`,c+=`|${o.source}`),s=s.substring(1),c=`(${c.substring(1)})`;", "t.includes(`underline`)&&(s+=`,u:not(section.include-note u)`,c+=`|${o.source}`),t.includes(`blockquote`)&&(s+=`,blockquote:not(section.include-note blockquote)`,c+=`|${p.source}`),s=s.substring(1),c=`(${c.substring(1)})`;"],
        ["console.warn(`No parent set for <ContentHeader>.`)", "void 0"],
        ["console.warn(`Unable to find the target element in the highlights list.`)", "void 0"],
        ["console.warn(`Unable to get content element for doctype`)", "void 0"]
    ];
    for (const [before, after] of substitutions) {
        if (!source.includes(before)) throw new Error(`Desktop layout anchor missing: ${before}`);
        source = source.replace(before, after);
    }
    return source;
});

fs.writeFileSync(archive, archiveBytes);
console.log("Patched warning-box option in place without changing ASAR offsets.");
