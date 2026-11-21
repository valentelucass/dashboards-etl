IF NOT EXISTS (SELECT 1 FROM acesso.permissoes WHERE chave_legado = 'redeCredenciada')
    INSERT INTO acesso.permissoes (chave, chave_legado, nome, descricao, recurso, acao, rota)
    VALUES ('dashboard.rede_credenciada.read', 'redeCredenciada', N'Rede Credenciada',
            N'Desempenho e custos dos parceiros logísticos', 'rede_credenciada', 'read', '/rede-credenciada');
