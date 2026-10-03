const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dist=path.join(__dirname,'../dist');
const files=fs.readdirSync(dist).filter(n=>/^Nyapix-.*\.exe$/.test(n)).sort();
if(files.length!==2)throw new Error('Expected installer and portable executable');
const sums=files.map(n=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,n))).digest('hex')}  ${n}`).join('\n')+'\n';
fs.writeFileSync(path.join(dist,'SHA256SUMS.txt'),sums);console.log(sums);
