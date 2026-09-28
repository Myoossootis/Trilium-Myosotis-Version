const fs = require("fs");

const file = process.argv[2];
if (!file) throw new Error("Missing desktop_layout bundle path.");

let source = fs.readFileSync(file, "utf8");
const beforePattern = 'o=/<u>[\\s\\S]*?<\\/u>/g,s=``,c=``;';
const afterPattern = 'o=/<u>[\\s\\S]*?<\\/u>/g,p=/<blockquote(?:\\s[^>]*)?>[\\s\\S]*?<\\/blockquote>/gi,s=``,c=``;';
const beforeSelector = 't.includes(`underline`)&&(s+=`,u:not(section.include-note u)`,c+=`|${o.source}`),s=s.substring(1),c=`(${c.substring(1)})`;';
const afterSelector = 't.includes(`underline`)&&(s+=`,u:not(section.include-note u)`,c+=`|${o.source}`),t.includes(`blockquote`)&&(s+=`,blockquote:not(section.include-note blockquote)`,c+=`|${p.source}`),s=s.substring(1),c=`(${c.substring(1)})`;';

for (const [oldValue, newValue, description] of [
    [beforePattern, afterPattern, "blockquote regular expression"],
    [beforeSelector, afterSelector, "blockquote selector"]
]) {
    if (!source.includes(oldValue)) throw new Error(`Expected ${description} anchor was not found.`);
    source = source.replace(oldValue, newValue);
}

if (!source.includes("t.includes(`blockquote`)") || !source.includes("blockquote:not(section.include-note blockquote)")) {
    throw new Error("Warning-box patch verification failed.");
}
fs.writeFileSync(file, source, "utf8");
console.log("Patched warning-box support in", file);
