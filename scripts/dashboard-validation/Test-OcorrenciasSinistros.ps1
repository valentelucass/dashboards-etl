# Executa os mesmos SELECTs do painel sobre cenários pequenos, na sessão de desenvolvimento.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Import-Module (Join-Path $repo '../.runtime/sql-server/SqlServerProjetos.psm1') -DisableNameChecking
$cred=Get-ProjetosSqlAdminCredential
$db=New-ProjetosSqlConnection -Database DASHBOARDS_DEV -Credential $cred -ApplicationName 'QA-OcorrenciasSinistros'
try {
  $db.Open()
  $tx=$db.BeginTransaction()
  $cmd=$db.CreateCommand(); $cmd.Transaction=$tx; $cmd.CommandTimeout=30
  function Executar([string]$sql) {$cmd.CommandText=$sql; $null=$cmd.ExecuteNonQuery()}
  function Consultar([string]$sql) {$cmd.CommandText=$sql; $cmd.ExecuteScalar()}
  function Igual($valor,$esperado,[string]$regra) { if ($valor -ne $esperado) {throw "$regra - esperado $esperado, lido $valor"} }
  function Relatorio([string]$arquivo,[string]$inicio,[string]$fim,[string]$filial='') {
    $texto=[IO.File]::ReadAllText((Join-Path $repo ('backend/src/main/resources/sql/'+$arquivo+'.sql')))
    $fontes=@{'dbo.vw_fretes_powerbi'='#fretes';'dbo.dashboard_performance_ocorrencias'='#eventos';'dbo.dashboard_ocorrencias_tratativas'='#prazos';
     'dbo.dashboard_sinistros'='#fonte_sinistros';'dbo.customer_service_cobertura_ocorrencias'='#cobertura';'dbo.dashboard_cobertura_sinistros'='#cobertura_s';
     'acesso.sinistros_casos'='#casos';'acesso.sinistro_acompanhamento'='#ajustes';'acesso.sinistro_apolices'='#apolices'}
    foreach($chave in $fontes.Keys){$texto=$texto.Replace($chave,$fontes[$chave])}
    $texto=$texto.Replace(':inicio',"'"+$inicio+"'").Replace(':fim',"'"+$fim+"'").Replace(':limite','25').Replace(':deslocamento','0')
    $globalSql=if($filial){'0'}else{'1'}; $texto=$texto.Replace(':global',$globalSql)
    foreach($par in @(@('Caso','s.filial'),@('Frete','f.Filial'),@('Sinistro','s.[Filial/Nome]'),@('Evento','o.filial'))){
      $clausula=if($filial){' AND '+$par[1]+"='A'"}else{''}
      $texto=$texto.Replace('/* escopo'+$par[0]+' */',$clausula)
    }
    (Consultar $texto) | ConvertFrom-Json
  }
  Igual (Consultar 'SELECT DB_NAME()') 'DASHBOARDS_DEV' 'alvo'
  Executar ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'ocorrencias-sinistros-fixture.sql')))
  $view=(Consultar "SELECT OBJECT_DEFINITION(OBJECT_ID('acesso.sinistros_casos'))")
  $view=$view.Substring($view.IndexOf('SELECT CAST')).Replace('FROM dbo.dashboard_sinistros','INTO #casos FROM #fonte_sinistros')
  Executar $view
  $op=Relatorio 'ocorrencias-indicadores' '20261101' '20261201'
  Igual $op.minutas 3 'minutas únicas de transporte'; Igual $op.comOcorrencia 2 'minutas afetadas'
  Igual $op.minutasComSinistro 2 'duas minutas no mesmo sinistro'; Igual $op.eventosDasMinutas 5 'eventos'
  Igual $op.notas 3 'NF homônima em minutas diferentes'; Igual $op.emTratativa 1 'nota com duas tratativas abertas'
  Igual $op.comPrazo 3 'prazo vazio e ações informativas excluídos'; Igual $op.noPrazo 1 'limite estrito e fusos equivalentes'
  $grupo=@($op.grupos|Where-Object grupo -eq 'AVARIA')[0]
  Igual $grupo.notas 2 'NF em mais de um tipo'; Igual $grupo.quantidade 4 'quantidade por grupo'
  Igual ($op.tipos|Where-Object codigo -eq 78).quantidade 3 'detalhe por código'
  $s=Relatorio 'sinistros-relacao' '20261101' '20261201'
  Igual $s.total 2 'sinistro com vários documentos contado uma vez'; Igual $s.mediaDias 6 'dias por encerramento'
  $dois=$s.linhas|Where-Object numero -eq 2
  Igual $dois.prejuizo 230 'somatório dos dois componentes sem multiplicar documentos'; Igual $dois.valorNf 800 'NF total do sinistro'
  Igual $dois.aReceber 75 'valor da seguradora único'; Igual $dois.sinistralidade 695 'saldo inclui sinistro do mês anterior'
  Igual $dois.sinistralidadeReal 720 'saldo com salvados acumulados'; Igual $dois.notas '001, 002' 'notas com zeros preservados'
  Igual $dois.saldoParcial $true 'vigência sem cobertura integral'
  Igual ($s.linhas|Where-Object numero -eq 3).sinistralidade 655 'apólice única da vigência'
  $restrito=Relatorio 'sinistros-relacao' '20261101' '20261201' 'A'
  Igual $restrito.total 1 'escopo de filial'; Igual $restrito.linhas[0].sinistralidade $null 'saldo global protegido'
  $dez=Relatorio 'sinistros-relacao' '20261201' '20270101'
  Igual $dez.linhas[0].sinistralidade 480 'renovação zera o consumo anterior'
  Executar "INSERT #cobertura_s VALUES ('SINISTROS','20261201')"
  $completo=Relatorio 'sinistros-relacao' '20261201' '20270101'
  Igual $completo.linhas[0].saldoParcial $false 'saldo coberto desde o primeiro dia da vigência'
  Executar "INSERT #apolices VALUES (3,'OUTRA','20261101','20261130',350)"
  $amb=Relatorio 'sinistros-relacao' '20261101' '20261201'
  Igual ($amb.linhas|Where-Object numero -eq 3).sinistralidade $null 'sem número e vigências ambíguas'
  Igual ($amb.linhas|Where-Object numero -eq 2).sinistralidade 695 'número explícito com vigências concorrentes'
  Executar "UPDATE #ajustes SET franquia=21.56,salvados=15.18 WHERE numero=2"
  $centavos=(Relatorio 'sinistros-relacao' '20261101' '20261201').linhas|Where-Object numero -eq 2
  Igual $centavos.franquia 21.56 'franquia em centavos'
  Igual $centavos.salvados 15.18 'venda de salvados em centavos'
  Igual $centavos.sinistralidade 696.56 'saldo da apólice em centavos'
  Igual $centavos.sinistralidadeReal 721.74 'saldo real em centavos'
  Write-Output 'Regressão SQL aprovada para eventos, documentos, prazos, escopo, renovação e saldos.'
} finally {
  if($tx){ $tx.Rollback();$tx.Dispose() }
  $db.Dispose();$cred.Password.Dispose()
}
