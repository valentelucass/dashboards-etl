// Extrai o SQL vigente e o exercita com dados sintéticos em tabelas #temporárias.
// O .ps1 associado recusa qualquer database diferente de DASHBOARDS_DEV.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const base = 'backend/src/main/java/com/dashboard/api/repository/acesso/';
const source = readFileSync(base + 'NavegacaoDiaSqlRepository.java', 'utf8');
const queries = [...source.matchAll(/jdbc\.(?:update|query)\("""([\s\S]*?)"""/g)].map(m => m[1]);
if (queries.length !== 3) throw new Error('Revise os cenários para o novo contrato SQL.');
const temp = sql => sql.replaceAll('acesso.usuario_navegacao_dia', '#navegacao').replaceAll('acesso.usuarios', '#usuarios');
const exec = sql => `EXEC sys.sp_executesql N'${temp(sql).replaceAll("'", "''")}';\n`;
const migration = readFileSync('database/migrations/V069__criar_presenca_navegacao_dia.sql', 'utf8');
if (!readFileSync('database/migrations/V001__criar_schema_acesso.sql', 'utf8').endsWith(migration)) throw new Error('Baseline e V069 divergentes.');
let script = `SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME() <> N'DASHBOARDS_DEV' THROW 51000, 'Somente DEV.', 1;
CREATE TABLE #usuarios(id BIGINT PRIMARY KEY, email VARCHAR(100), login VARCHAR(100), ativo BIT, ultima_atividade DATETIMEOFFSET, ultima_rota_acessada VARCHAR(100), nome VARCHAR(100));
CREATE TABLE #navegacao(usuario_id BIGINT PRIMARY KEY, dia DATE NOT NULL, visitas NVARCHAR(MAX) NOT NULL DEFAULT N'[]' CHECK(ISJSON(visitas)=1), indice_atual INT NOT NULL DEFAULT -1, rota_atual VARCHAR(100), fluxo_id VARCHAR(36), ultimo_pulso DATETIMEOFFSET(3));
INSERT INTO #usuarios VALUES(1,'pessoa@teste.invalid','pessoa@teste.invalid',1,NULL,NULL,'Pessoa');
`;
let checks = 0;
function check(condition, name) { script += `IF NOT (${condition}) THROW 51000, '${name}', 1;\n`; checks++; }
function pulse(time, route = '/', visible = true, flow = '11111111-1111-4111-8111-111111111111') {
  script += 'BEGIN TRANSACTION;\n' + exec(queries[0]
    .replaceAll(':operador', "'pessoa@teste.invalid'").replaceAll(':rota', `'${route}'`)
    .replaceAll(':visivel', visible ? '1' : '0').replaceAll(':fluxoId', `'${flow}'`)
    .replace('= SYSDATETIMEOFFSET();', `= '${time}';`)) + 'COMMIT;\n';
}
pulse('2026-09-10T12:00:00-03:00');
check('(SELECT indice_atual FROM #navegacao)=0', 'first visit');
pulse('2026-09-10T12:00:30-03:00'); pulse('2026-09-10T12:00:30-03:00');
check("(SELECT JSON_VALUE(visitas,'$[0].segundos') FROM #navegacao)='30'", 'duplicate heartbeat');
pulse('2026-09-10T12:00:45-03:00', '/coletas');
check("(SELECT JSON_VALUE(visitas,'$[0].segundos') FROM #navegacao)='45' AND (SELECT indice_atual FROM #navegacao)=1", 'page switch');
pulse('2026-09-10T12:01:00-03:00', '/coletas'); pulse('2026-09-10T12:01:15-03:00', '/coletas', false);
check("(SELECT JSON_VALUE(visitas,'$[1].segundos') FROM #navegacao)='30' AND (SELECT rota_atual FROM #navegacao) IS NULL", 'blur');
pulse('2026-09-10T12:01:20-03:00', '/cotacoes', true, '22222222-2222-4222-8222-222222222222');
pulse('2026-09-10T12:01:25-03:00', '/coletas', false);
check("(SELECT rota_atual FROM #navegacao)='/cotacoes'", 'stale tab blur');
pulse('2026-09-10T12:05:00-03:00', '/cotacoes');
check("(SELECT JSON_VALUE(visitas,'$[2].segundos') FROM #navegacao)='0' AND (SELECT indice_atual FROM #navegacao)=3", 'idle interval not counted');
pulse('2026-09-11T00:00:01-03:00');
check('(SELECT indice_atual FROM #navegacao)=0 AND (SELECT COUNT(*) FROM #navegacao CROSS APPLY OPENJSON(visitas))=1', 'new day resets contents');
script += "UPDATE #navegacao SET dia='2000-01-01';\n" + exec(queries[1]);
check("(SELECT visitas FROM #navegacao)='[]' AND (SELECT COUNT(*) FROM #navegacao)=1", 'retention reuses row');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
for (let i = 0; i < 21; i++) pulse(`${today}T12:00:${String(i).padStart(2, '0')}-03:00`, i % 2 ? '/cotacoes' : '/');
script += 'CREATE TABLE #result(dia VARCHAR(10),total BIGINT,ordem INT,rota VARCHAR(100),inicio VARCHAR(33),fim VARCHAR(33),segundos BIGINT);\nINSERT INTO #result ' + exec(queries[2].replaceAll(':usuarioId', '1').replaceAll(':offset', '20'));
check('(SELECT COUNT(*) FROM #result)=1 AND (SELECT total FROM #result)=21 AND (SELECT ordem FROM #result)=0', 'SQL pagination');
script += 'UPDATE #usuarios SET ativo=0;\nTRUNCATE TABLE #result;\nINSERT INTO #result ' + exec(queries[2].replaceAll(':usuarioId', '1').replaceAll(':offset', '0'));
check('(SELECT total FROM #result)=0', 'inactive user hidden');
const users = readFileSync(base + 'UsuarioRepository.java', 'utf8');
function queryFor(method) {
  const end = users.indexOf(method + '(');
  const start = users.lastIndexOf('@Query(value = """', end) + '@Query(value = """'.length;
  return temp(users.slice(start, users.indexOf('"""', start))).replaceAll(':operador', "'pessoa@teste.invalid'");
}
script += `UPDATE #usuarios SET ativo=1,ultima_atividade=SYSDATETIMEOFFSET();
INSERT INTO #usuarios VALUES(2,'outra@teste.invalid','outra',1,SYSDATETIMEOFFSET(),'/coletas','Outra'),(3,'inativa@teste.invalid','inativa',0,SYSDATETIMEOFFSET(),'/','Inativa');
CREATE TABLE #resumo(total BIGINT,ativos BIGINT,inativos BIGINT,online BIGINT);
INSERT INTO #resumo ${queryFor('calcularResumoSessoes')};
CREATE TABLE #online(id BIGINT,nome VARCHAR(100),email VARCHAR(100),atividade VARCHAR(33));
INSERT INTO #online ${queryFor('findUsuariosOnlineResumo')};
`;
check('(SELECT online FROM #resumo)=1', 'count excludes self and inactive');
check('(SELECT COUNT(*) FROM #online)=1 AND (SELECT id FROM #online)=2', 'list excludes self and inactive');
script += `PRINT 'PASS ${checks} presence checks using temporary tables only';\n`;
mkdirSync('.tmp/six-refinements', { recursive: true });
writeFileSync('.tmp/six-refinements/presenca.sql', script);
