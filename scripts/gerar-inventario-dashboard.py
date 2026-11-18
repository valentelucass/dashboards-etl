"""Monta o catálogo a partir das extrações TypeScript e Java e das publicações do ETL."""
import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/catalogos'
ETL = ROOT.parent / 'etl-extracao-dados-v2'
PUBLIC = {'/api/auth/' + p for p in ('login','refresh','logout','nova-senha-obrigatoria','password-reset-request')}
BASE = {'coletas':'vw_coletas_powerbi', 'manifestos':'vw_fato_manifestos_dash',
        'fretes':'fato_fretes_faturamento','tracking':'vw_localizacao_cargas_powerbi',
        'cotacoes':'vw_cotacoes_powerbi','contas-a-pagar':'vw_contas_a_pagar_powerbi',
        'faturas-por-cliente':'fato_gestao_vista_faturas','performance':'vw_fretes_powerbi'}

def read(p):
    return p.read_text(encoding='utf-8-sig')

def csv_read(p, sep=','):
    with p.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f, delimiter=sep))

def csv_write(p, rows):
    with p.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

def publication_graph():
    graph={}
    for file in sorted((ETL/'database/production/publication').glob('*.sql')):
        for batch in re.split(r'(?im)^\s*GO\s*$',read(file)):
            header=re.search(r'(?i)CREATE (?:OR ALTER )?VIEW\s+(\w+\.\w+)\s+AS\b',batch)
            if not header: continue
            body=re.sub(r'--[^\n]*','',batch[header.end():])
            deps=set(re.findall(r'(?i)\b(?:FROM|JOIN)\s+((?:core|pub|stg|ctl|ref)\.\w+)',body))
            entities={e for e in all_entities if "'"+e+"'" in body}
            aux=set(re.findall(r"(?i)source_name\s*=\s*N?'([A-Z_]+)'",body))
            graph[header[1].lower()]=file.name,sorted(deps),entities,aux
    return graph

def lineage(name):
    pending=[name]; seen=set(); entities=set(); aux=set(); tables=set()
    while pending:
        item=pending.pop()
        if item in seen: continue
        seen.add(item)
        if item not in graph:
            tables.add(item); continue
        _,deps,local,extra=graph[item]
        entities.update(local); aux.update(extra); pending.extend(deps)
    return entities,aux,tables

def filter_list(page):
    files={'ColetasPage':'coletas','ManifestosPage':'manifestos','PerformancePage':'performance',
           'FaturamentoPage':'fretes','TrackingPage':'tracking','CotacoesPage':'cotacoes',
           'ContasAPagarPage':'contasAPagar','FaturasPorClientePage':'faturasPorCliente',
           'IndicadoresGestaoAVistaPage':'indicadoresGestaoAVista'}
    if page in files:
        src=read(ROOT/f'frontend/src/types/{files[page]}.ts')
        body=re.search(r'export interface \w+Filtro\s*\{([^}]+)',src)[1]
        return ', '.join(re.findall(r'^\s*(\w+)\??:',body,re.M))
    return {'IntegracoesPage':'período, destino, escopo, etapa, situação, origem, busca, paginação',
      'ExecutivoPage':'período, filiais, parceiros logísticos','EtlSaudePage':'período, status e entidade na cobertura',
      'AdminSetoresPage':'setor, papel e catálogo de permissões','AdminUsuariosPage':'usuário, setor, papel, estado e navegação',
      'HomePage':'comunicados, solicitações e visibilidade do usuário','LoginPage':'credenciais, redefinição e troca obrigatória',
      'AlterarSenhaPage':'credenciais da sessão'}.get(page,'—')

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('ui_json',type=Path)
parser.add_argument('api_tsv',type=Path)
args=parser.parse_args()
ui=json.loads(read(args.ui_json)); api=csv_read(args.api_tsv,'\t')
all_entities={r['entity']:r for r in json.loads(read(ETL/'src/main/resources/contracts/dataexport/receiving-catalog-0766-v1.json'))['entities']}
graph=publication_graph()
graph['pub.vw_etl_v2_receiving_overview']=graph['pub.v2_dashboard_receiving_overview']
v71=read(next((ROOT/'database/migrations').glob('V071*')))
contracts=re.findall(r"\(N'(\w+)'\)",v71.split('INSERT @routes')[1].split(';')[0])
assert len(set(contracts))==len(contracts) and all('pub.'+c in graph for c in contracts)
route_map={}
for route in ui['routes']:
    elem=route['element']
    m=re.search(r'<(\w+Page)\b',elem)
    if m: route_map[m[1]]=route['path']
route_map['LoginPage']='/login, /auth/trocar-senha'
route_map.update(LayoutPainel='layout das páginas autenticadas',AutenticacaoProvider='ciclo global da sessão',
                 RotaProtegida='guarda de acesso')
calls=defaultdict(list)
for c in ui['calls']: calls[(c['method'],c['url'])].append(c)
proof=defaultdict(list)
for r in csv_read(DOC/'ensaios-por-rota.csv'):
    proof[(r.get('método') or 'GET',r['rota'])].append(r['ensaio']+' '+r['resultado'])
inventory=[]
for r in sorted(api,key=lambda r:(r['url'],r['http'])):
    u=r['url']; http=r['http']; key=http,re.sub(r'\{[^}]+\}','{}',u)
    consumers=calls.get(key,[])
    pages={route_map[p] for c in consumers for p in c['pages']}
    if u=='/api/auth/login' or u=='/api/auth/nova-senha-obrigatoria': pages.add(route_map['LoginPage'])
    if u=='/api/auth/alterar-senha': pages.add('/alterar-senha')
    data=set(filter(None,r['objects'].split(', ')))
    published={o[4:] for o in data if o.startswith('dbo.') and 'pub.'+o[4:] in graph}
    group=u.split('/')[3] if u.count('/')>=3 else ''
    if group in BASE and not published and '/metas' not in u and '/justificativas' not in u:
        published.add(BASE[group])
    if '/dimensoes/faturamento/' in u: published.add(BASE['fretes'])
    if '/dimensoes/manifestos/' in u: published.add(BASE['manifestos'])
    if group=='etl-saude' and not published:
        published.add('vw_etl_v2_receiving_overview' if u.endswith('cobertura-v2') else 'vw_bi_monitoramento')
    if u.startswith('/api/painel/indicadores-gestao-a-vista/horarios-corte') and '/justificativas' not in u:
        published.update(['raster_viagens','raster_viagem_paradas'])
    sources=set();others=set();phys=set()
    for o in published:
        direct,aux,tables=lineage('pub.'+o)
        sources.update(direct);others.update(aux);phys.update(tables)
    if 'vw_etl_v2_receiving_overview' in published: sources.update(all_entities)
    if '/integracoes' in u: others.add('Satélite HTTP')
    if 'log_extracoes' in published or 'vw_bi_monitoramento' in published: others.add('diário de ciclos e execuções')
    refs={q for q in phys if q.startswith('ref.') or q.startswith('ctl.dashboard') or q.startswith('stg.dashboard')}
    scope=r['scope']
    if 'escopoAtual' in scope: scope='EscopoFilialService.escopoAtual (perfis globais ou filiais autorizadas)'
    elif scope: scope=scope
    elif 'cobertura-v2' in u: scope='cobertura global, papel privilegiado'
    elif group=='integracoes': scope='filtros do Satélite; escopo SUCESSO/PENDENCIA quando aplicável'
    elif u.startswith('/api/apresentacoes') or u.startswith('/api/sessao') or u.startswith('/api/auth'):
        scope='identidade da sessão, cookie ou credencial recebida'
    elif u.startswith('/api/admin') or u.startswith('/api/usuarios'): scope='administração; ver regra de papel e identidade no método'
    else: scope='ver autorização e serviço; sem chamada direta ao resolvedor de filiais no percurso estático'
    if published: mode='consulta SQL na rota: '+', '.join(sorted(published))
    elif others: mode='integração consultada na rota'
    elif data: mode='estado persistido do portal'
    else: mode='operação da API; ver método indicado'
    client='; '.join(sorted({c['file']+':'+str(c['line'])+' '+c['func'] for c in consumers}))
    business_page={'coletas':'ColetasPage','manifestos':'ManifestosPage','fretes':'FaturamentoPage',
        'faturamento':'FaturamentoPage','tracking':'TrackingPage','cotacoes':'CotacoesPage',
        'contas-a-pagar':'ContasAPagarPage','faturas-por-cliente':'FaturasPorClientePage','performance':'PerformancePage',
        'indicadores-gestao-a-vista':'IndicadoresGestaoAVistaPage','executivo':'ExecutivoPage',
        'integracoes':'IntegracoesPage','etl-saude':'EtlSaudePage'}.get(group)
    filters=filter_list(business_page) if business_page and ('params:' in r['params'] or 'filtro:' in r['params']) else ''
    perm=(r['permission'] or ('pública' if u in PUBLIC else 'autenticada'))
    inventory.append({'HTTP':http,'rota':u,'consumo':'; '.join(sorted(pages)) or ('cliente declarado sem página alcançada' if consumers else 'API sem chamada de página identificada'),
        'cliente':client,'controlador':r['controller']+':'+r['line']+' '+r['method'],'autorização':perm,'escopo':scope,
        'entrada':r['params'],'filtros da família quando aceitos':filters,'serviços':r['services'],'repositórios':r['repositories'],'leitura/operação':mode,
        'objetos referenciados no Java':r['objects'],'entidades dos contratos':', '.join(sorted(sources)),
        'auxiliares e referências':', '.join(sorted(others|refs)),'provas HTTP históricas':'; '.join(proof[http,u]),
        'aceite':'pendente com carga e atualização concorrente'})
keys={(r['HTTP'],re.sub(r'\{[^}]+\}','{}',r['rota'])) for r in inventory}
if not set(calls)<=keys: raise ValueError('Chamada da UI sem handler: '+str(set(calls)-keys))
if len(keys)!=len(inventory): raise ValueError('Mapping duplicado')
csv_write(DOC/'rotas-e-dependencias.csv',inventory)
md=['# Páginas, navegação e contratos de leitura','',
    'Os métodos, parâmetros, permissões, serviços, repositórios, objetos, fontes e resultados por rota estão na [matriz HTTP](rotas-e-dependencias.csv). O [guia de manutenção](inventario-dashboard.md) descreve o escopo e a reprodução.','',
    f'{len(ui["routes"])} padrões de navegação, {len([x for x in ui["entries"] if x.endswith("Page")])} componentes de página, {len(api)} operações HTTP e {len({r["controller"] for r in api})} controladores. '
    +', '.join(f'{k} {v}' for k,v in sorted(Counter(r['http'] for r in api).items()))+'.',
    '', '| Caminho | Página ou destino | Guarda no navegador | Filtros ou entradas principais |','|---|---|---|---|']
for r in ui['routes']:
    elem=r['element']; matched=re.search(r'<(\w+Page)\b',elem)
    page=matched[1] if matched else ('LoginPage' if 'RotaLogin' in elem else '')
    dest=re.search(r'to="([^"]+)',elem)
    name=page or ('redireciona a '+dest[1] if dest else 'primeira página permitida ou login')
    md.append(f'| \x60{r["path"]}\x60 | {name} | {", ".join(r["guards"]) or "pública / resolução de sessão"} | {filter_list(page)} |')
for p in sorted(ui['entries']):
    keys_p=sorted({(c['method'],c['url']) for c in ui['calls'] if p in c['pages']})
    md+=['',f'## {p}','',f'Entrada no código: \x60{route_map[p]}\x60.']
    if keys_p:
        md+=['','| Método | Caminho usado pelo cliente |','|---|---|']
        md += [f'| {v} | \x60{k}\x60 |' for v,k in keys_p]
    else: md+=['','A tela utiliza estado de navegação ou o provedor comum de sessão.']
md+=['','## Publicações da V071 e cobertura V070','',
     '| Contrato SQL | Definição no ETL | Entidades alcançadas | Leitura e tabelas auxiliares |','|---|---|---|---|']
for name in sorted(contracts+['vw_etl_v2_receiving_overview']):
    n='pub.'+name; entities,aux,tables=lineage(n)
    if name=='vw_etl_v2_receiving_overview':entities=set(all_entities)
    md.append(f'| \x60{name}\x60 | \x60{graph[n][0]}\x60 | {", ".join(sorted(entities)) or "referência ou auditoria"} | {", ".join(sorted(aux|tables))} |')
md+=['','## Catálogo de recebimento','','| Entidade | Template | Campo do dia | Campos declarados | Contratos que a referenciam |','|---|---:|---|---:|---|']
for e,v in all_entities.items():
    consumers=[n for n in contracts if e in lineage('pub.'+n)[0]]
    md.append(f'| {e} | {v["reportId"]} | {v["rowDate"] or "janela do contrato de extração"} | {len(v["fields"])} | {", ".join(consumers) or "somente cobertura neste mapa de views"} |')
(DOC/'paginas-e-publicacoes.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(len(ui['routes']),len(api),len(keys),len(calls),len(contracts))
