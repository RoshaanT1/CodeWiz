// Demo data for the screens whose APIs aren't built yet (repos, rounds,
// quiz, drill, results, profile). Replace each piece with real API data as
// the matching task lands. Nothing here reaches the server.

export type Category = 'entry' | 'core' | 'data' | 'helper';
export type BugType = 'off_by_one' | 'wrong_condition' | 'missing_guard' | 'wrong_variable' | 'swallowed_error' | 'wrong_return' | 'unchecked_input' | 'async_mistake' | 'mutable_default';
export type Fn = { id:string; name:string; qualifiedName:string; file:string; language:'python'|'javascript'|'typescript'; startLine:number; endLine:number; code:string; category:Category; importance:number; length:number; branches:number; callers:number; callees:number; reviewed:boolean };
export type Call = {callerId:string;calleeId:string};
export type QuizItem = {id:string;kind:'purpose'|'behaviour'|'edge_case'|'impact';question:string;answer?:string;score?:0|1|2;feedback?:string;functionId?:string;response?:string};
export type PlantedBug = {lineStart:number;lineEnd:number;bugType:BugType;originalLine:string;changedLine:string;explanation:string;fix:string;functionId?:string};
export type Finding = {line:number;comment:string;outcome?:'caught'|'false_alarm'|'possible_real_bug';evidence?:string;functionId?:string};
export type Suggestion = {id:string;kind:'practice'|'security'|'library';detail:string;docsUrl?:string;verdict?:'agree'|'disagree';reason?:string;functionId?:string};
export type FunctionResult = {functionId:string;understanding:number;caught:number;missed:number;falseAlarms:number};
export type SkillScore = {bugType:BugType;attempts:number;caught:number};
export type Repository={id:string;name:string;owner:string;url:string;language:string;branch:string;functions:Fn[];calls:Call[];updated:string;rounds:number;};
export type Round={id:string;repoId:string;repoName:string;status:'completed'|'in_progress'|'generating';date:string;functionIds:string[];questions:QuizItem[];bugs:PlantedBug[];findings:Finding[];suggestions:Suggestion[];score:number;bugsFound:number;functionResults?:FunctionResult[];};
const fnCode=(body:string)=>body;
export const repos:Repository[]=[
 {id:'tiny-cache',name:'tiny-cache',owner:'maya-chen',url:'https://github.com/maya-chen/tiny-cache',language:'TypeScript',branch:'main',updated:'2 hours ago',rounds:4,
 functions:[
 {id:'get',name:'get',qualifiedName:'Cache.get',file:'src/cache.ts',language:'typescript',startLine:18,endLine:27,code:fnCode(`get(key: string): Value | undefined {\n  const entry = this.store.get(key);\n  if (!entry) return undefined;\n  if (entry.expiresAt < Date.now()) {\n    this.store.delete(key);\n    return undefined;\n  }\n  return entry.value;\n}`),category:'core',importance:93,length:10,branches:3,callers:12,callees:2,reviewed:true},
 {id:'set',name:'set',qualifiedName:'Cache.set',file:'src/cache.ts',language:'typescript',startLine:31,endLine:43,code:fnCode(`set(key: string, value: Value, ttl = this.defaultTtl): void {\n  const expiresAt = ttl ? Date.now() + ttl : null;\n  this.store.set(key, { value, expiresAt });\n  if (this.store.size > this.maxSize) {\n    this.evictOldest();\n  }\n}`),category:'core',importance:87,length:13,branches:2,callers:8,callees:2,reviewed:false},
 {id:'evict',name:'evictOldest',qualifiedName:'Cache.evictOldest',file:'src/cache.ts',language:'typescript',startLine:47,endLine:56,code:fnCode(`private evictOldest(): void {\n  const firstKey = this.store.keys().next().value;\n  if (firstKey !== undefined) {\n    this.store.delete(firstKey);\n  }\n}`),category:'helper',importance:64,length:10,branches:1,callers:1,callees:0,reviewed:false},
 {id:'prune',name:'pruneExpired',qualifiedName:'Cache.pruneExpired',file:'src/cache.ts',language:'typescript',startLine:61,endLine:75,code:fnCode(`pruneExpired(): number {\n  let removed = 0;\n  const now = Date.now();\n  for (const [key, entry] of this.store) {\n    if (entry.expiresAt && entry.expiresAt < now) {\n      this.store.delete(key);\n      removed++;\n    }\n  }\n  return removed;\n}`),category:'data',importance:72,length:15,branches:2,callers:2,callees:0,reviewed:false},
 {id:'create-cache',name:'createCache',qualifiedName:'createCache',file:'src/index.ts',language:'typescript',startLine:8,endLine:15,code:fnCode(`export function createCache(options: CacheOptions = {}) {\n  const maxSize = options.maxSize ?? 500;\n  const defaultTtl = options.ttl ?? 60_000;\n  return new Cache(maxSize, defaultTtl);\n}`),category:'entry',importance:78,length:8,branches:0,callers:5,callees:1,reviewed:true},
 {id:'stats',name:'getStats',qualifiedName:'Cache.getStats',file:'src/cache.ts',language:'typescript',startLine:80,endLine:87,code:fnCode(`getStats() {\n  return {\n    size: this.store.size,\n    maxSize: this.maxSize,\n    hitRate: this.hits / (this.hits + this.misses),\n  };\n}`),category:'data',importance:43,length:8,branches:0,callers:3,callees:0,reviewed:false}
 ],calls:[{callerId:'create-cache',calleeId:'set'},{callerId:'get',calleeId:'prune'},{callerId:'set',calleeId:'evict'},{callerId:'prune',calleeId:'get'}]},
 {id:'csv-tools',name:'csv-tools',owner:'maya-chen',url:'https://github.com/maya-chen/csv-tools',language:'Python',branch:'main',updated:'yesterday',rounds:2,
 functions:[
 {id:'parse-row',name:'parse_row',qualifiedName:'parser.parse_row',file:'csv_tools/parser.py',language:'python',startLine:24,endLine:35,code:`def parse_row(line, delimiter=','):\n    fields = []\n    current = ''\n    quoted = False\n    for char in line:\n        if char == '\"':\n            quoted = not quoted\n        elif char == delimiter and not quoted:\n            fields.append(current)\n            current = ''\n        else:\n            current += char\n    fields.append(current)\n    return fields`,category:'core',importance:92,length:12,branches:3,callers:6,callees:0,reviewed:false},
 {id:'load-file',name:'load_file',qualifiedName:'csv_tools.io.load_file',file:'csv_tools/io.py',language:'python',startLine:10,endLine:21,code:`def load_file(path, encoding='utf-8'):\n    with open(path, encoding=encoding) as stream:\n        header = stream.readline().strip()\n        rows = []\n        for line in stream:\n            if line.strip():\n                rows.append(parse_row(line))\n    return header.split(','), rows`,category:'entry',importance:88,length:12,branches:1,callers:2,callees:1,reviewed:false},
 {id:'normalize',name:'normalize_headers',qualifiedName:'csv_tools.parser.normalize_headers',file:'csv_tools/parser.py',language:'python',startLine:41,endLine:48,code:`def normalize_headers(headers):\n    return [\n        header.strip().lower().replace(' ', '_')\n        for header in headers\n    ]`,category:'helper',importance:58,length:8,branches:0,callers:3,callees:0,reviewed:true}
 ],calls:[{callerId:'load-file',calleeId:'parse-row'},{callerId:'normalize',calleeId:'parse-row'}]}
];
export const rounds:Round[]=[
 {id:'round-184',repoId:'tiny-cache',repoName:'tiny-cache',status:'completed',date:'Today, 10:42 AM',functionIds:['get','set','evict'],score:78,bugsFound:2,
 questions:[{id:'q1',functionId:'get',kind:'purpose',question:'What is the responsibility of Cache.get?',answer:'It returns a valid cached value, removing and ignoring expired entries.',score:2,feedback:'Clear explanation of the lookup and expiry path.'},{id:'q2',functionId:'get',kind:'edge_case',question:'What happens if the stored value is falsy, such as 0 or an empty string?',answer:'The entry exists and should still be returned; presence is determined by the entry object.',score:1,feedback:'Good boundary case; explain how presence is distinguished from value truthiness.'}],
 bugs:[{functionId:'get',lineStart:21,lineEnd:21,bugType:'wrong_condition',originalLine:'  if (!entry) return undefined;',changedLine:'  if (!entry?.value) return undefined;',explanation:'This treats valid falsy cached values as cache misses.',fix:'Check for entry presence, not the truthiness of its value.'},{functionId:'get',lineStart:22,lineEnd:22,bugType:'off_by_one',originalLine:'  if (entry.expiresAt < Date.now()) {',changedLine:'  if (entry.expiresAt <= Date.now()) {',explanation:'An entry remains valid for exactly one extra instant at the expiry boundary.',fix:'Expire at the boundary with a less-than-or-equal comparison.'}],
 findings:[{functionId:'get',line:21,comment:'Falsy payloads like 0 are returned as misses here.',outcome:'caught',evidence:'Cache values are typed broadly; a zero-valued counter is a valid cached result.'},{functionId:'get',line:22,comment:'The expiry comparison may allow an entry to remain valid at its deadline.',outcome:'caught',evidence:'At the exact expiry timestamp the entry should be treated as expired.'}],suggestions:[{id:'s1',functionId:'get',kind:'practice',detail:'Add a test for a cache entry whose value is 0.',docsUrl:'https://vitest.dev/guide/'}],
 functionResults:[{functionId:'get',understanding:88,caught:2,missed:0,falseAlarms:0},{functionId:'set',understanding:72,caught:0,missed:0,falseAlarms:0},{functionId:'evict',understanding:74,caught:0,missed:0,falseAlarms:0}]},
 {id:'round-185',repoId:'tiny-cache',repoName:'tiny-cache',status:'in_progress',date:'Yesterday',functionIds:['prune','stats'],score:0,bugsFound:0,
 questions:[{id:'prune-purpose',functionId:'prune',kind:'purpose',question:'What does pruneExpired remove from the store?'},{id:'prune-edge',functionId:'prune',kind:'edge_case',question:'How should entries with no expiry timestamp be handled?'},{id:'stats-purpose',functionId:'stats',kind:'purpose',question:'What information does getStats expose to its caller?'},{id:'stats-edge',functionId:'stats',kind:'edge_case',question:'What happens to hitRate before any cache operation?' }],
 bugs:[{functionId:'prune',lineStart:65,lineEnd:65,bugType:'wrong_condition',originalLine:'    if (entry.expiresAt && entry.expiresAt < now) {',changedLine:'    if (entry.expiresAt && entry.expiresAt > now) {',explanation:'The comparison removes entries that have not expired yet.',fix:'Remove entries whose expiry timestamp is earlier than now.'},{functionId:'stats',lineStart:84,lineEnd:84,bugType:'missing_guard',originalLine:'    hitRate: this.hits / (this.hits + this.misses),',changedLine:'    hitRate: this.hits / Math.max(1, this.hits + this.misses),',explanation:'The denominator needs an explicit empty-cache policy to avoid an undefined ratio.',fix:'Return a documented fallback when there have been no hits or misses.'}],
 findings:[],suggestions:[{id:'prune-practice',functionId:'prune',kind:'practice',detail:'Add a test that compares entries immediately before and after expiry.'},{id:'prune-security',functionId:'prune',kind:'security',detail:'Confirm cleanup cannot remove live data during a concurrent read.'},{id:'prune-library',functionId:'prune',kind:'library',detail:'Consider an iterator-safe cleanup helper if the map grows.'},{id:'stats-practice',functionId:'stats',kind:'practice',detail:'Test hit rate before and after the first cache request.'},{id:'stats-security',functionId:'stats',kind:'security',detail:'Ensure telemetry values do not expose sensitive cache keys.'},{id:'stats-library',functionId:'stats',kind:'library',detail:'Consider a named statistics type for stable consumers.'}]}
];
export const skillScores:SkillScore[]=[
 {bugType:'off_by_one',attempts:8,caught:6},{bugType:'wrong_condition',attempts:7,caught:5},{bugType:'missing_guard',attempts:5,caught:3},{bugType:'wrong_variable',attempts:4,caught:3},{bugType:'swallowed_error',attempts:3,caught:1},{bugType:'wrong_return',attempts:5,caught:4},{bugType:'unchecked_input',attempts:3,caught:2},{bugType:'async_mistake',attempts:2,caught:1},{bugType:'mutable_default',attempts:2,caught:2}
];
export const profileSummary={functionsReviewed:23,completedRounds:6,streakDays:4};
export const profileCategoryCoverage:{label:string;functions:number}[]=[
 {label:'Entry points',functions:5},{label:'Core logic',functions:11},{label:'Data handling',functions:4},{label:'Helpers',functions:3}
];
export function createRoundSeed(repo:Repository,functionIds:string[]):Pick<Round,'functionIds'|'questions'|'bugs'|'suggestions'>{
 const functions=repo.functions.filter(fn=>functionIds.includes(fn.id));
 const questions:QuizItem[]=functions.flatMap(fn=>[
  {id:`${fn.id}-purpose`,functionId:fn.id,kind:'purpose',question:`What is ${fn.qualifiedName} responsible for?`},
  {id:`${fn.id}-behavior`,functionId:fn.id,kind:'behaviour',question:'Trace the normal path. What changes, and what does the function return?'},
  {id:`${fn.id}-edge`,functionId:fn.id,kind:'edge_case',question:'Which boundary input or unusual state should a caller account for?'}
 ]);
 const bugs:PlantedBug[]=functions.map(fn=>{
  const rows=fn.code.split('\n');const offset=Math.min(2,Math.max(0,rows.length-1));const originalLine=rows[offset]??'';
  const commentPrefix=fn.language==='python'?'# Seeded change: ':'// Seeded change: ';
  return {functionId:fn.id,lineStart:fn.startLine+offset,lineEnd:fn.startLine+offset,bugType:'wrong_condition',originalLine,changedLine:`${commentPrefix}${originalLine.trim()}`,explanation:'This seeded change removes a meaningful operation from the normal path.',fix:'Restore the original operation after verifying the required boundary conditions.'};
 });
 const suggestions:Suggestion[]=functions.flatMap(fn=>[
  {id:`${fn.id}-practice`,functionId:fn.id,kind:'practice',detail:`Add a focused test for the boundary behavior of ${fn.name}.`},
  {id:`${fn.id}-security`,functionId:fn.id,kind:'security',detail:'Check whether untrusted or malformed input can reach this path.'},
  {id:`${fn.id}-library`,functionId:fn.id,kind:'library',detail:'Consider whether the language runtime already provides a safer helper for this behavior.'}
 ]);
 return {functionIds,questions,bugs,suggestions};
}
