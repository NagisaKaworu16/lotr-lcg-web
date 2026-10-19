/* Developer refresh: Node 18+, preserves prior snapshot on failed/invalid responses. */
const fs=require('node:fs'),path=require('node:path'),P=require('./player-cards.js');
(async()=>{
 const target=path.join(__dirname,'ringsdb-snapshot.js');let old;try{old=P.verify(require(target));}catch{}
 const age=old?Date.now()-Date.parse(old.fetchedAt):Infinity;if(age>=0&&age<600000){console.log('RingsDB snapshot still fresh (10-minute cache).');return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const headers={};if(old?.lastModified)headers['If-Modified-Since']=old.lastModified;
  const response=await fetch('https://ringsdb.com/api/public/cards/Core.json',{headers,signal:controller.signal});
  let next;if(response.status===304&&old){next={...old,fetchedAt:new Date().toISOString()};}else{if(!response.ok)throw Error('HTTP '+response.status);next=P.normalizePack(await response.json(),{endpoint:'https://ringsdb.com/api/public/cards/Core.json',fetchedAt:new Date().toISOString(),lastModified:response.headers.get('Last-Modified'),cacheControl:response.headers.get('Cache-Control')});}
  P.verify(next);let text='/* RingsDB Core metadata and rules; no flavor text or card art. */\nconst RINGSDB_SNAPSHOT = '+JSON.stringify(next,null,2)+';\nif(typeof module!=="undefined")module.exports=RINGSDB_SNAPSHOT;\n';
  if(text.toLowerCase().includes('</script'))throw Error('Unsafe embedded script sequence');
  fs.writeFileSync(target+'.tmp',text,'utf8');fs.renameSync(target+'.tmp',target);console.log(`Validated ${next.cards.length} Core player cards. Run python3 build.py to rebuild index.html.`);
 }finally{clearTimeout(timer);}
})().catch(e=>{console.error('Refresh failed; prior snapshot preserved:',e.message);process.exitCode=1;});
