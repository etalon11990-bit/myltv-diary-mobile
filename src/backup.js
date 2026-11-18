import {validate,LIMITS} from './model.js';
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
const encoder=new TextEncoder();
function bytes(n){const b=new Uint8Array(n);return[b,new DataView(b.buffer)];}
export async function blobCRC(blob){let c=0xffffffff;for(let offset=0;offset<blob.size;offset+=1024*1024){const bytes=new Uint8Array(await blob.slice(offset,offset+1024*1024).arrayBuffer());for(const b of bytes)c=table[(c^b)&255]^(c>>>8);}return(c^0xffffffff)>>>0;}
export async function pack(project,assets){validate(project);const metadata={project,types:{video:assets.video?.type||'',music:assets.music?.type||'',background:assets.background?.type||''}};const entries=[['project.json',new Blob([JSON.stringify(metadata)])]];for(const k of ['video','music','background'])if(assets[k])entries.push([k+'.bin',assets[k]]);const parts=[],central=[];let offset=0;
for(const[name,blob]of entries){if(blob.size>=0xffffffff||offset+blob.size+128>=0xffffffff)throw Error('Формат резервной копии ZIP32 ограничен 4 ГБ. Сохраните исходные медиа отдельно.');const data={length:blob.size},nameBytes=encoder.encode(name),crc=await blobCRC(blob);const[h,v]=bytes(30+nameBytes.length);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,nameBytes.length,true);h.set(nameBytes,30);parts.push(h,blob);const[c,d]=bytes(46+nameBytes.length);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,nameBytes.length,true);d.setUint32(42,offset,true);c.set(nameBytes,46);central.push(c);offset+=h.length+data.length;}
const centralSize=central.reduce((n,x)=>n+x.length,0),[end,e]=bytes(22);if(offset+centralSize+22>=0xffffffff)throw Error('Резервная копия превышает предел ZIP32 (4 ГБ)');e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});}
export async function unpack(blob){
 if(blob.size<22||blob.size>=0xffffffff)throw Error('Неверная копия или превышено ограничение формата ZIP32 (4 ГБ)');
 const header=async(pos,length)=>new DataView(await blob.slice(pos,pos+length).arrayBuffer());
 let pos=0;const entries={};while(pos+30<=blob.size){const v=await header(pos,30);if(v.getUint32(0,true)!==0x04034b50)break;
 const flags=v.getUint16(6,true),method=v.getUint16(8,true),crc=v.getUint32(14,true),size=v.getUint32(18,true),raw=v.getUint32(22,true),nl=v.getUint16(26,true),extra=v.getUint16(28,true),start=pos+30+nl+extra,end=start+size;
 if(flags!==0||method!==0||size!==raw||end>blob.size||nl>256)throw Error('Поддерживаются только несжатые копии MYLTV');
 const name=await blob.slice(pos+30,pos+30+nl).text();if(!['project.json','video.bin','music.bin','background.bin'].includes(name)||entries[name])throw Error('Неизвестный или повторяющийся файл в копии');
 const content=blob.slice(start,end);if(await blobCRC(content)!==crc)throw Error('Копия повреждена: контрольная сумма');entries[name]=content;pos=end;}
 const end=blob.size-22,e=await header(end,22),central=await header(pos,4);
 if(!entries['project.json']||pos+22>blob.size||central.getUint32(0,true)!==0x02014b50||e.getUint32(0,true)!==0x06054b50||e.getUint32(16,true)!==pos||e.getUint32(12,true)+pos!==end||e.getUint16(10,true)!==Object.keys(entries).length)throw Error('Неверный или незавершённый архив MYLTV');
 if(entries['project.json'].size>1024*1024)throw Error('Некорректные метаданные');
 const meta=JSON.parse(await entries['project.json'].text()),project=validate(meta.project),assets={};for(const k of ['video','music','background'])if(entries[k+'.bin'])assets[k]=entries[k+'.bin'].slice(0,entries[k+'.bin'].size,meta.types?.[k]||'application/octet-stream');
 if(Boolean(project.videoName)!==Boolean(assets.video)||Boolean(project.musicName)!==Boolean(assets.music))throw Error('В копии не хватает медиафайла');return{project,assets};}
