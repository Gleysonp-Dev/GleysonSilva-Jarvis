import { build } from 'esbuild';
import { mkdir, copyFile, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
// Resolve from the project explicitly; the compiler never needs to enumerate drive roots.
const boundedFiles={name:'project-files',setup(context){
 context.onResolve({filter:/.*/},async args=>{
  let path;
  if(isAbsolute(args.path)||args.path.startsWith('.')){
   const base=isAbsolute(args.path)?args.path:resolve(args.importer?dirname(args.importer):process.cwd(),args.path);
   for(const candidate of [base,...['.ts','.tsx','.js','.mjs','.css','/index.ts','/index.js'].map(s=>base+s)]){try{if((await stat(candidate)).isFile()){path=candidate;break;}}catch{}}
  }else path=require.resolve(args.path,{paths:[args.importer?dirname(args.importer):process.cwd()]});
  if(!path)throw new Error('Import não encontrado: '+args.path);
  return {path,namespace:'project-file'};
 });
 context.onLoad({filter:/.*/,namespace:'project-file'},async args=>({contents:await readFile(args.path,'utf8'),loader:({'.tsx':'tsx','.ts':'ts','.css':'css'})[extname(args.path)]||'js',resolveDir:dirname(args.path)}));
}};
await mkdir('dist', { recursive: true });
await build({ absWorkingDir:process.cwd(), entryPoints: [resolve('apps/desktop/renderer/App.tsx')], plugins:[boundedFiles], tsconfigRaw:{compilerOptions:{jsx:'react-jsx',target:'ES2022'}}, bundle: true, format: 'esm', platform: 'browser', target: 'chrome140', outdir: resolve('dist'), entryNames: 'app', sourcemap: false, minify: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
await copyFile('apps/desktop/renderer/index.html', 'dist/index.html');
console.log('Interface compilada em dist/.');
