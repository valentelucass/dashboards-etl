# Runbook de Diagnostico

## O total do painel divergiu ou ficou lento depois de um lote

Identifique ambiente, banco, período, filtros, conta e recibo do ETL. Em `DASHBOARDS`, confirme para onde aponta o sinônimo utilizado pela aplicação. Duas interfaces DEV e PROD podem ler a mesma publicação. O produtor mantém a regra e os objetos publicados. A API do painel lê o contrato local. [Vínculos do relatório preparado](../../database/migrations/V073__usar_leituras_operacionais_preparadas.sql)

```sql
SELECT SCHEMA_NAME(schema_id) AS esquema, name AS sinonimo, base_object_name AS destino
FROM sys.synonyms
WHERE schema_id = SCHEMA_ID(N'dbo') AND name = N'vw_fretes_powerbi';

SELECT COUNT_BIG(*) AS fretes, SUM([Valor Total do Serviço]) AS total
FROM dbo.vw_fretes_powerbi;
```

Com a mesma janela e a mesma publicação, comparar o resultado com a contagem e a soma da fonte publicada. Registrar o total na precisão original antes de formatá-lo em reais. Para uma divergência com totais iguais, usar a comparação por linha e multiplicidade do ETL. Para investigar lentidão, medir separadamente a execução do SQL, a API e a tela, repetindo a mesma ação após aquecimento.

Em 20/11/2026, a fonte e o consumidor concordaram nas 57.870 linhas e no total até o centavo. A mediana da consulta de conferência foi de 110 ms no lote 46, 126,5 ms no 47 e 125 ms no 48. São tempos da consulta de totalização. Uma resposta HTTP 200 em um endereço de saúde confirma a disponibilidade daquele endereço.

## 1. A API nao sobe localmente

Sintomas:

- `java -jar` falha logo no bootstrap;
- health probe nao responde;
- erro com `UnsupportedClassVersionError`.

Causa comum:

- runtime default do Windows esta em Java 8, enquanto o projeto precisa de Java 17+.

Verificacoes:

```powershell
java -version
cd .\backend
.\mvnw.cmd -v
```

Acao:

- usar `.\mvnw.cmd spring-boot:run`; ou
- rodar o JAR com `& "$env:JAVA_HOME\bin\java.exe" -jar .\target\dashboard-api-1.0.0.jar`; ou
- ajustar `JAVA_HOME` para um JDK compativel.

## 2. Dashboard devolve `400` ao trocar o periodo

Sintomas:

- mensagem falando de periodo invalido;
- UI exibe variante de erro de periodo.

Verificacoes:

- confirmar `dataInicio <= dataFim`;
- confirmar janela menor ou igual a `365 dias`.

Ponto de codigo:

- `ValidadorPeriodoService.java`

## 3. Dashboard devolve `408 Request Timeout`

Sintomas:

- backend responde com "A consulta excedeu o tempo limite";
- UI exibe variante `timeout`.

Verificacoes:

- periodo grande demais;
- filtros muito amplos;
- view pesada sem seletividade.

Acao:

- reduzir periodo;
- aplicar filtros adicionais;
- habilitar SQL logging temporario se precisar inspecionar query real;
- confirmar se filtros, agregacoes e rankings estao sendo executados em SQL, nao em memoria da JVM.

## 4. `7d`, `30d` e `90d` mostram o mesmo numero

Interpretacao correta:

- isso pode ser bug ou simplesmente falta de variacao de dados na origem.

Passos:

1. rodar o validador BI;
2. comparar a contagem SQL da view com a API;
3. inspecionar se o periodo usa `LocalDate` ou `DATETIMEOFFSET`;
4. confirmar se ha dados novos de fato na view.

Conclusao esperada:

- so corrigir codigo quando SQL e API divergirem;
- se SQL e API coincidirem, o problema e de dado/ETL e nao de filtro.

## 5. SQL e API divergem pouco, sempre na borda

Sintoma classico:

- diferenca pequena, consistente e proporcional a um dia na fronteira.

Causa provavel:

- semantica incorreta de `DATETIMEOFFSET`.

Verificacoes:

- o modulo usa `PeriodoOffsetDateTimeHelper`?
- a `Specification` usa `>=` e `<`?
- o script de validacao BI usa a mesma janela?

## 6. A UI mostra erro generico demais

Verificacoes:

- a pagina usa `getApiErrorMessage()`?
- a pagina usa `getTipoErro()`?
- o backend esta devolvendo `mensagem` ou `message`?

Pontos de codigo:

- `frontend/src/utils/apiError.ts`
- `frontend/src/components/ui/MensagemErro.tsx`
- `backend/src/main/java/com/dashboard/api/exception/ManipuladorGlobalExcecoes.java`

## 7. Usuario autenticado recebe `403`

Verificacoes:

- permissao efetiva do modulo no usuario;
- papel do usuario (`admin_plataforma`, `admin_acesso`, `usuario_comum`);
- escopo herdado do setor e overrides individuais.

Pontos de codigo:

- `AcessoSeguranca.java`
- `PermissaoResolverService.java`
- `src/utils/accessControl.ts`

## 8. Validador BI aponta divergencia intermitente

Sintoma:

- um periodo fecha em `100%`, depois cai e volta sem mudanca de codigo.

Causa provavel:

- dados mudando ao vivo durante a execucao do script;
- ETL atualizando uma view no meio da bateria.

Acao:

- rerodar o mesmo periodo;
- comparar `updatedAt`;
- so abrir bug de codigo se a divergencia persistir em reexecucao controlada.

## 9. Ao criar um novo dashboard, o que nao pode faltar

- rota protegida no frontend;
- permissao mapeada no backend e frontend;
- confirmacao de que a view/colunas existem no contrato publicado pelo ETL;
- consulta/projecao SQL no repository para filtros, agregacoes, rankings e `distinct`;
- service com validacao de periodo;
- endpoint de dimensao, se houver filtro assistido;
- teste de service;
- entrada no `entities.mjs` para validacao BI;
- documentacao neste conjunto novo de docs.
