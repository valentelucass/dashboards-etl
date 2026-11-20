package com.dashboard.api.controller;

import com.dashboard.api.dto.acesso.UsuarioSessaoResumoDTO;
import com.dashboard.api.service.acesso.GestaoUsuarioService;
import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminAcessoControllerTest {
    private final GestaoUsuarioService usuarios = mock(GestaoUsuarioService.class);
    private final AdminAcessoController controller = new AdminAcessoController(null, usuarios, null);

    private DataAccessResourceFailureException falhaSql(int codigo) {
        return new DataAccessResourceFailureException("Leitura interrompida", new SQLException("SQL Server", "", codigo));
    }

    @Test
    void repeteLeituraDoResumoQuandoSqlDesfazTransacao() {
        var resumo = new UsuarioSessaoResumoDTO(5, 4, 1, 2);
        when(usuarios.resumoSessoesUsuarios()).thenThrow(falhaSql(1205)).thenReturn(resumo);
        assertThat(controller.resumoSessoesUsuarios()).isSameAs(resumo);
        verify(usuarios, times(2)).resumoSessoesUsuarios();
    }

    @Test
    void propagaDeadlockPersistenteAposUmaNovaLeitura() {
        var erro = falhaSql(1205);
        when(usuarios.resumoSessoesUsuarios()).thenThrow(erro);
        assertThatThrownBy(controller::resumoSessoesUsuarios).isSameAs(erro);
        verify(usuarios, times(2)).resumoSessoesUsuarios();
    }

    @Test
    void propagaOutrosErrosSemRepetir() {
        var erro = falhaSql(208);
        when(usuarios.resumoSessoesUsuarios()).thenThrow(erro);
        assertThatThrownBy(controller::resumoSessoesUsuarios).isSameAs(erro);
        verify(usuarios).resumoSessoesUsuarios();
    }
}
