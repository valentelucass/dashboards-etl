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
CREATE TABLE #usuarios(id BIGINT PRIMARY KEY, email VARCHAR(100), login VARCHAR(100), ativo BIT, ultima_atividade DATETIMEOFFSET, ultima_rota_acessada VARCHAR(100), nome VARCHAR(100),setor_id BIGINT DEFAULT 1,algoritmo_hash VARCHAR(30),password_reset_requested_at DATETIMEOFFSET);
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
script += 'CREATE TABLE #result(dia VARCHAR(10),total BIGINT,segundosTotal BIGINT,atualizadoEm VARCHAR(33),ordem INT,rota VARCHAR(100),inicio VARCHAR(33),fim VARCHAR(33),segundos BIGINT,trechos BIGINT);\nINSERT INTO #result ' + exec(queries[2].replaceAll(':usuarioId', '1').replaceAll(':offset', '0'));
check('(SELECT COUNT(*) FROM #result)=2 AND (SELECT MIN(total) FROM #result)=2 AND (SELECT SUM(trechos) FROM #result)=21', 'all repeated pages grouped before pagination');
check('(SELECT SUM(segundos) FROM #result)=20 AND (SELECT MIN(segundosTotal) FROM #result)=20', 'grouped duration sums confirmed intervals only');
script += "UPDATE #navegacao SET visitas=N'[]',indice_atual=-1,rota_atual=NULL,fluxo_id=NULL,ultimo_pulso=NULL;\n";
pulse(today+'T12:00:00.900-03:00');
pulse(today+'T12:00:01.100-03:00');
pulse(today+'T12:00:01.300-03:00');
check("(SELECT JSON_VALUE(visitas,'$[0].milissegundos') FROM #navegacao)='400' AND (SELECT JSON_VALUE(visitas,'$[0].segundos') FROM #navegacao)='0'", 'subsecond focus does not inflate duration');
pulse(today+'T12:00:01.500-03:00','/',false);
pulse(today+'T12:30:00-03:00');
pulse(today+'T12:30:00.500-03:00','/',false);
script += 'TRUNCATE TABLE #result;\nINSERT INTO #result '+exec(queries[2].replaceAll(':usuarioId','1').replaceAll(':offset','0'));
check('(SELECT total FROM #result)=1 AND (SELECT trechos FROM #result)=2 AND (SELECT segundos FROM #result)=1', 'same page combines fractions without counting half hour pause');
script += "UPDATE #navegacao SET visitas=N'[]',indice_atual=-1,rota_atual=NULL,fluxo_id=NULL,ultimo_pulso=NULL;\n";
for(let i=0;i<21;i++) pulse(today+'T13:00:'+String(i).padStart(2,'0')+'-03:00','/pagina-'+(i%14));
script += 'TRUNCATE TABLE #result;\nINSERT INTO #result '+exec(queries[2].replaceAll(':usuarioId','1').replaceAll(':offset','10'));
check('(SELECT COUNT(*) FROM #result)=4 AND (SELECT MIN(total) FROM #result)=14 AND (SELECT MIN(ordem) FROM #result)=7 AND (SELECT MAX(ordem) FROM #result)=10', 'pagination and order apply to complete page groups');
script += 'UPDATE #usuarios SET ativo=0;\nTRUNCATE TABLE #result;\nINSERT INTO #result ' + exec(queries[2].replaceAll(':usuarioId', '1').replaceAll(':offset', '0'));
check('(SELECT total FROM #result)=0', 'inactive user hidden');
const users = readFileSync(base + 'UsuarioRepository.java', 'utf8');
function queryFor(method) {
  const end = users.indexOf(method + '(');
  const start = users.lastIndexOf('@Query(value = """', end) + '@Query(value = """'.length;
  return temp(users.slice(start, users.indexOf('"""', start))).replaceAll(':operador', "'pessoa@teste.invalid'").replaceAll(':agora', 'CONVERT(varchar(33), SYSDATETIMEOFFSET(), 127)');
}
script += `UPDATE #usuarios SET ativo=1,ultima_atividade=SYSDATETIMEOFFSET();
INSERT INTO #usuarios VALUES(2,'outra@teste.invalid','outra',1,SYSDATETIMEOFFSET(),'/coletas','Outra'),(3,'inativa@teste.invalid','inativa',0,SYSDATETIMEOFFSET(),'/','Inativa');
INSERT INTO #navegacao(usuario_id,dia,rota_atual,ultimo_pulso) VALUES(2,CAST(SYSDATETIMEOFFSET() AS DATE),'/coletas',SYSDATETIMEOFFSET()),(3,CAST(SYSDATETIMEOFFSET() AS DATE),'/',SYSDATETIMEOFFSET());
CREATE TABLE #resumo(total BIGINT,ativos BIGINT,inativos BIGINT,online BIGINT);
INSERT INTO #resumo ${queryFor('calcularResumoSessoes')};
CREATE TABLE #online(id BIGINT,nome VARCHAR(100),email VARCHAR(100),atividade VARCHAR(33),rota VARCHAR(100));
INSERT INTO #online ${queryFor('findUsuariosOnlineResumo')};
`;
check('(SELECT online FROM #resumo)=1', 'count excludes self and inactive');
check('(SELECT COUNT(*) FROM #online)=1 AND (SELECT id FROM #online)=2', 'list excludes self and inactive');

// Relógio SQL fixo para conferir a fronteira exata de 75 segundos nas queries reais.
const atNow = method => queryFor(method).replaceAll('SYSDATETIMEOFFSET()', '@presenceNow');
script += `DECLARE @presenceNow DATETIMEOFFSET(3)=SYSDATETIMEOFFSET();
UPDATE #navegacao SET rota_atual='/',ultimo_pulso=@presenceNow WHERE usuario_id=1;
UPDATE #navegacao SET ultimo_pulso=DATEADD(SECOND,-30,@presenceNow) WHERE usuario_id=2;
INSERT INTO #usuarios VALUES
(4,'expirada@teste.invalid','expirada',1,@presenceNow,'/coletas','Expirada'),
(5,'oculta@teste.invalid','oculta',1,@presenceNow,'/coletas','Oculta'),
(6,'futura@teste.invalid','futura',1,@presenceNow,'/coletas','Futura'),
(7,'sem-pulso@teste.invalid','sem-pulso',1,@presenceNow,'/coletas','Sem pulso'),
(8,'limite@teste.invalid','limite',1,@presenceNow,'/coletas','Limite'),
(9,'fora@teste.invalid','fora',1,@presenceNow,'/coletas','Fora');
INSERT INTO #navegacao(usuario_id,dia,rota_atual,ultimo_pulso) VALUES
(4,CAST(@presenceNow AS DATE),'/coletas',DATEADD(MINUTE,-12,@presenceNow)),
(5,CAST(@presenceNow AS DATE),NULL,DATEADD(SECOND,-10,@presenceNow)),
(6,CAST(@presenceNow AS DATE),'/coletas',DATEADD(SECOND,1,@presenceNow)),
(8,CAST(@presenceNow AS DATE),'/coletas',DATEADD(SECOND,-75,@presenceNow)),
(9,CAST(@presenceNow AS DATE),'/coletas',DATEADD(MILLISECOND,-75001,@presenceNow));
CREATE TABLE #resumoAtual(total BIGINT,ativos BIGINT,inativos BIGINT,online BIGINT);
INSERT INTO #resumoAtual ${atNow('calcularResumoSessoes')};
CREATE TABLE #onlineAtual(id BIGINT,nome VARCHAR(100),email VARCHAR(100),atividade VARCHAR(33),rota VARCHAR(100));
INSERT INTO #onlineAtual ${atNow('findUsuariosOnlineResumo')};
CREATE TABLE #recentes(id BIGINT,nome VARCHAR(100),email VARCHAR(100),atividade VARCHAR(33),rota VARCHAR(100));
INSERT INTO #recentes ${atNow('findUsuariosRecentesResumo')};
`;
check('(SELECT online FROM #resumoAtual)=2 AND (SELECT COUNT(*) FROM #onlineAtual)=2', 'count and list agree at same clock');
check('(SELECT COUNT(*) FROM #onlineAtual WHERE id IN(2,8))=2', 'fresh focus and exact 75 second boundary');
check('(SELECT COUNT(*) FROM #onlineAtual WHERE id IN(1,3,4,5,6,7,9))=0', 'self inactive expired hidden future and missing excluded');
check('(SELECT COUNT(*) FROM #recentes WHERE id IN(4,5,9))=3', 'expired and unfocused appear in recent list');
check('(SELECT COUNT(*) FROM #recentes WHERE id IN(6,7))=0', 'future pulses and HTTP-only activity are not recent focus');
check('(SELECT COUNT(*) FROM #recentes r JOIN #onlineAtual o ON o.id=r.id)=0', 'online and recent disjoint');
check("(SELECT rota FROM #onlineAtual WHERE id=2)='/coletas'", 'route comes with current heartbeat');
check('(SELECT CAST(atividade AS DATETIMEOFFSET) FROM #onlineAtual WHERE id=2)=DATEADD(SECOND,-30,@presenceNow)', 'HTTP activity does not replace heartbeat timestamp');
script += `CREATE TABLE #setores(id BIGINT,nome VARCHAR(50)); INSERT INTO #setores VALUES(1,'Sintetico');
CREATE TABLE #acessos(id BIGINT,nome VARCHAR(100),email VARCHAR(100),ativo BIT,setorId BIGINT,setorNome VARCHAR(50),algoritmo VARCHAR(30),resetEm DATETIMEOFFSET,atividade VARCHAR(33),rota VARCHAR(100),online BIT);
INSERT INTO #acessos ${atNow('findAcessoResumo').replaceAll('acesso.setores','#setores')};
CREATE TABLE #acessosSemRota(id BIGINT,nome VARCHAR(100),email VARCHAR(100),ativo BIT,setorId BIGINT,setorNome VARCHAR(50),algoritmo VARCHAR(30),resetEm DATETIMEOFFSET,atividade VARCHAR(33),rota VARCHAR(100),online BIT);
INSERT INTO #acessosSemRota ${atNow('findAcessoResumoSemUltimaRota').replaceAll('acesso.setores','#setores')};
`;
check('(SELECT COUNT(*) FROM #acessos WHERE online=1)=3 AND (SELECT COUNT(*) FROM #acessos WHERE online=1 AND id IN(1,2,8))=3', 'administration list has same presence rule');
check('(SELECT COUNT(*) FROM #acessosSemRota WHERE online=1)=3', 'legacy route projection uses same presence rule');
script += `UPDATE #navegacao SET ultimo_pulso=DATEADD(SECOND,-76,@presenceNow) WHERE usuario_id=2;
CREATE TABLE #aposExpirar(id BIGINT,nome VARCHAR(100),email VARCHAR(100),atividade VARCHAR(33),rota VARCHAR(100));
INSERT INTO #aposExpirar ${atNow('findUsuariosOnlineResumo')};
UPDATE #navegacao SET ultimo_pulso=@presenceNow,rota_atual='/performance' WHERE usuario_id=4;
CREATE TABLE #aposRetomar(id BIGINT,nome VARCHAR(100),email VARCHAR(100),atividade VARCHAR(33),rota VARCHAR(100));
INSERT INTO #aposRetomar ${atNow('findUsuariosOnlineResumo')};
`;
check('(SELECT COUNT(*) FROM #aposExpirar)=1 AND (SELECT id FROM #aposExpirar)=8', 'no heartbeat expires without cleanup or restart');
check("(SELECT COUNT(*) FROM #aposRetomar WHERE id=4 AND rota='/performance')=1", 'new confirmed heartbeat restores presence');
script += `PRINT 'PASS ${checks} presence checks using temporary tables only';\n`;
const output = process.argv[2] ?? '.tmp/presenca-sql-check';
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/presenca.sql`, script.replaceAll('INSERT INTO #usuarios VALUES', 'INSERT INTO #usuarios(id,email,login,ativo,ultima_atividade,ultima_rota_acessada,nome) VALUES'));
