# Saúde do ETL: recebimento na base V2

Em **Saúde do ETL → Dados recebidos no ETL V2**, quem tem a permissão da página e papel de administrador da plataforma ou desenvolvedor pode conferir quantos dias e linhas já foram recebidos por relatório. O resumo é global e por isso não está disponível para perfis comuns com acesso restrito a filiais. A API aplica a mesma restrição independentemente da interface. Não há dados de clientes, valores financeiros ou credenciais nessa consulta.

A tabela mostra o último lote confirmado de cada entidade e data, inclusive dias confirmados com zero linhas. As datas de início e fim não garantem cobertura contínua. Se houver mais de uma origem ou um ponteiro de carga inválido, a interface mostra a situação sem somar nem inventar zeros. As duas novas entidades aparecem apenas nesse acompanhamento do recebimento. Nenhuma tem página ou rota de negócio nova.

## Por que a tabela fica separada dos indicadores atuais

A tela existente usa `EtlSaudeSqlRepository` sobre `dbo.log_extracoes` e as views V1. Ali o período filtra o momento das execuções; contagens de processamento usam `registros_extraidos` e `noop_count`. No V2, o diário registra lotes completos e suas versões; o resumo novo usa a data de negócio e os ponteiros da cobertura. Um lote novo não informa quantos registros foram inseridos ou atualizados individualmente.

A migration V070 acrescenta somente `dbo.vw_etl_v2_receiving_overview`; os 26 destinos antigos continuam no V1. Em recriações do schema, o mesmo Flyway aplica V070 depois das migrations anteriores. O SQL de publicação pertence ao repositório ETL V2. Se a publicação ainda não estiver disponível, o painel recebe uma indisponibilidade explícita, sem afetar os indicadores existentes.

## Ensaio e implantação

1. No ETL V2, rodar `scripts/validation/Test-DashboardReceivingOverview.ps1` em Windows PowerShell 5.1 com `-Mode Reference` e depois `-Mode Candidate`, usando um arquivo de recibo diferente em `-ReceiptPath` para cada execução. Os testes não aplicam SQL permanente nem consultam a origem externa.
2. Validar o alvo com `scripts/operations/Install-DashboardReceivingOverview.ps1` sem argumentos. Para disponibilizar a view no banco V2, o operador executa o mesmo script com `-Apply`. A operação tem alvo e versão fixos, transação e registro próprio; usa as permissões já existentes.
3. No fluxo de implantação do dashboard, usar a API e o frontend desta revisão e aplicar Flyway V070. Abrir Saúde do ETL com um perfil operacional, expandir a tabela e comparar os números com o recibo SQL recente. Um perfil com apenas a permissão da página deve continuar sem acesso ao resumo V2.

O ensaio 0770 verificou a API e a permissão de método. Em 11/11/2026, a view foi instalada no V2 e a API em processo de teste consultou a publicação via JDBC com a conta atual do portal. Retornou 11 entidades, 89.703 linhas e 103 combinações de entidade e data. O teste apontou a consulta diretamente à view publicada. O Flyway do portal permanece na versão 069.

**Troca geral ainda pendente.** As projeções e dependências de negócio estão na [conferência 0769](../pre-validacao-etl-v2-0769.md). No recorte de 02 a 10/11, a consulta V1 retornou 118 cotações e o V2 tinha 1.523 itens. As capturas ocorreram em momentos diferentes. A regra de contagem de cada item calculado foi confirmada no ESL e testada na [publicação de Cotações](cotacoes-por-trecho-v2-0771.md).

Em Contas a Pagar, 17 números de parcela (55 linhas) apresentam diferenças de alocação. Treze variam por centro de custo e seu valor, e quatro por conta contábil e seu valor. A publicação precisa distinguir parcela e alocação para conciliar os totais.
