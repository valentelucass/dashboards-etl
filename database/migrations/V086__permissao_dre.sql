IF NOT EXISTS (SELECT 1 FROM acesso.permissoes WHERE chave_legado = 'dre')
    INSERT INTO acesso.permissoes (chave, chave_legado, nome, descricao, recurso, acao, rota)
    VALUES ('dashboard.dre.read', 'dre', N'DRE', N'Demonstrativo do Resultado do Exercício', 'dre', 'read', '/dre');
