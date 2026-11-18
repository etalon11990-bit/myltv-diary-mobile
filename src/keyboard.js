// Recorded CC0 samples from the desktop bank. No pitch shifting or synthesized clicks.
export function keyPlan(events, seed, samples) {
 let state=seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
 const groups={},queues={},last={};for(const sample of samples)(groups[sample.kind]??=[]).push(sample);
 return events.map((e,index)=>{const kind=e.char===' '? 'space':e.char==='\n'?'enter':e.char==='\b'?'backspace':'key';
  if(!queues[kind]?.length){const bag=[...(groups[kind]||groups.key||[])];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.length>1&&bag[0]?.id===last[kind]) [bag[0],bag[1]]=[bag[1],bag[0]];queues[kind]=bag;}
  const sample=queues[kind].shift();last[kind]=sample?.id;return {index,at:e.frame/30,sample,gain:.88+random()*.18,end:(events[index+1]?.frame??Infinity)/30};
 });
}
export class Keyboard {
 constructor(ctx,destination){this.ctx=ctx;this.voices=new Set();this.gain=ctx.createGain();this.gain.connect(ctx.destination);this.gain.connect(destination);}
 async load(){if(this.samples)return;this.loading??=(async()=>{const response=await fetch(new URL('../sounds/keyboard/pack.json',import.meta.url));if(!response.ok)throw Error('Библиотека клавиш не загружена: откройте приложение онлайн один раз');const manifest=await response.json();const samples=[];
 // Sequential decode bounds transient allocations; these are short individual WAVs.
 for(const s of manifest.samples){const r=await fetch(new URL('../sounds/keyboard/'+s.file,import.meta.url));if(!r.ok)throw Error('Не загружен звук '+s.file);samples.push({...s,buffer:await this.ctx.decodeAudioData(await r.arrayBuffer())});}this.samples=samples;})();try{await this.loading;}catch(e){this.loading=null;throw e;}}
 start(events,p,offset){this.stop();this.p=p;this.plan=keyPlan(events,p.seed,this.samples||[]);this.next=this.plan.findIndex(e=>e.at>=offset-1e-6);if(this.next<0)this.next=this.plan.length;this.gain.gain.value=p.keyboardEnabled?p.keyboardVolume/100*.75:0;}
 pump(base,time){if(!this.p?.keyboardEnabled)return;while(this.next<this.plan.length&&this.plan[this.next].at<=time+.10){const e=this.plan[this.next++];if(e.at<time-.05||!e.sample)continue;this.voice(e,base+e.at);}}
 voice(e,at){const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();source.buffer=e.sample.buffer;filter.type='lowpass';filter.frequency.value=this.p.keyboardSound==='soft'?1500:3200;source.connect(filter);filter.connect(gain);gain.connect(this.gain);const start=Math.max(at,ctx.currentTime),length=Math.min(source.buffer.duration,Math.max(.005,e.end-e.at)),level=e.gain*(this.p.keyboardSound==='quiet'?.35:1);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.min(.001,length/4));gain.gain.setValueAtTime(level,start+Math.max(.001,length-.005));gain.gain.linearRampToValueAtTime(0,start+length);source.start(start);source.stop(start+length);this.voices.add(source);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices.delete(source);};}
 stop(){for(const s of this.voices){try{s.stop();s.disconnect();}catch{}}this.voices.clear();this.plan=[];}
}
