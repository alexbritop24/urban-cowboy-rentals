import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
assert.equal(process.env.QUOTE_STAGING_DB_CHECK,'1','Set QUOTE_STAGING_DB_CHECK=1 to run the rollback-only staging test.');
const migration=await readFile(new URL('../supabase/migrations/20261118000100_automated_rental_quotes.sql',import.meta.url),'utf8');
const checks=await readFile(new URL('../supabase/tests/quote_delivery.sql',import.meta.url),'utf8');
const directory=await mkdtemp(join(tmpdir(),'ucr-quote-staging-'));
try {
 const file=join(directory,'check.sql');
 await writeFile(file,'begin;\n'+migration+'\n'+checks+"\nrollback; select true as quote_staging_checks_passed, to_regclass('public.rental_quote_deliveries') is not null as quote_table_exists_after_rollback;\n");
 const result=spawnSync(process.env.SUPABASE_CLI || 'supabase',['db','query','--linked','--project-ref','cmqsvywbhswrycgxvbgy','--file',file,'--output','json'],{encoding:'utf8',timeout:120000});
 if(result.status!==0)throw new Error(result.stderr || 'Staging verification failed.');
 console.log(result.stdout);
} finally { await rm(directory,{recursive:true,force:true}); }
