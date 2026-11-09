import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),check=args.includes('--check');
const requested=args.filter(arg=>arg!=='--check');
if(requested.length>1||(check&&requested.length))throw Error('Usage: node scripts/version.mjs [X.Y.Z | --check]');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,text)=>{if(read(file)!==text)fs.writeFileSync(path.join(root,file),text);};
const version=requested[0]||read('VERSION').trim();
if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))throw Error('VERSION must be X.Y.Z');

const projects=['apps/tizen','services/keremhub-portal','services/keremflix','services/xxxkerem','services/keremkitabevi','services/kerem-drive'];
const jsonFiles=['package.json',...projects.flatMap(project=>[project+'/package.json',project+'/package-lock.json'])];
const problems=[];
for(const file of jsonFiles){
  const data=JSON.parse(read(file));
  if(check){
    if(data.version!==version)problems.push(file);
    if(file.endsWith('package-lock.json')&&data.packages?.['']?.version!==version)problems.push(file+' packages[""]');
  }else{
    data.version=version;
    if(file.endsWith('package-lock.json')&&data.packages?.[''])data.packages[''].version=version;
    write(file,JSON.stringify(data,null,2)+'\n');
  }
}

const manifest='apps/android/app/src/main/AndroidManifest.xml';
let android=read(manifest);
const oldVersion=android.match(/android:versionName="([^"]+)"/)?.[1];
const code=Number(android.match(/android:versionCode="(\d+)"/)?.[1]);
if(!oldVersion||!Number.isSafeInteger(code)||code<=0)throw Error('Invalid Android manifest version');
if(check){if(oldVersion!==version)problems.push(manifest);}
else if(oldVersion!==version){
  if(code>=2100000000)throw Error('Android versionCode limit reached');
  android=android.replace(/android:versionName="[^"]+"/,'android:versionName="'+version+'"').replace(/android:versionCode="\d+"/,'android:versionCode="'+(code+1)+'"');
  write(manifest,android);
}

const tizenManifest='apps/tizen/app/config.xml';
let tizen=read(tizenManifest);
const tizenVersion=tizen.match(/<widget\b[^>]*\bversion="([^"]+)"/)?.[1];
if(!tizenVersion)throw Error('Invalid Tizen manifest');
if(check){if(tizenVersion!==version)problems.push(tizenManifest);}
else write(tizenManifest,tizen.replace(/(<widget\b[^>]*\bversion=")[^"]+"/,'$1'+version+'"'));

const activity='apps/android/app/src/main/java/com/keremhub/app/MainActivity.java';
const activityText=read(activity),activityVersion=activityText.match(/Keremhub (\d+\.\d+\.\d+)/)?.[1];
if(check){if(activityVersion!==version)problems.push(activity+' settings label');}
else write(activity,activityText.replace(/Keremhub \d+\.\d+\.\d+/g,'Keremhub '+version));

if(!check){
  write('README.md',read('README.md').replace(/^# Keremhub \d+\.\d+\.\d+/,'# Keremhub '+version));
  const androidReadme='apps/android/README.md';
  const finalCode=Number(read(manifest).match(/android:versionCode="(\d+)"/)[1]);
  write(androidReadme,read(androidReadme).replace(/^# Keremhub Android \d+\.\d+\.\d+/,'# Keremhub Android '+version).replace(/Sürüm: \d+\.\d+\.\d+, versionCode: \d+\./,'Sürüm: '+version+', versionCode: '+finalCode+'.'));
  const tizenReadme='apps/tizen/README.md';
  write(tizenReadme,read(tizenReadme).replace(/^# Keremflix \d+\.\d+\.\d+/,'# Keremflix '+version).replace(/\*\*Güncel sürüm: \d+\.\d+\.\d+\./,'**Güncel sürüm: '+version+'.'));
}

if(check){
  if(problems.length)throw Error('Version mismatch for '+version+':\n'+problems.join('\n'));
  console.log('PASS: Android, Tizen, five services and package locks use '+version);
}else{
  write('VERSION',version+'\n');
  console.log('Synced '+version+'; Android versionCode increments only when its versionName changes.');
}
