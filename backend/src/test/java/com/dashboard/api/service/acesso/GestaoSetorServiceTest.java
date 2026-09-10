package com.dashboard.api.service.acesso;

import com.dashboard.api.dto.acesso.SetorRequestDTO;
import com.dashboard.api.model.acesso.AcaoAudit;
import com.dashboard.api.model.acesso.SetorEntity;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.repository.acesso.SetorPermissaoTemplateRepository;
import com.dashboard.api.repository.acesso.SetorRepository;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GestaoSetorServiceTest {
    @Mock SetorRepository setores;
    @Mock PermissaoRepository permissoes;
    @Mock SetorPermissaoTemplateRepository templates;
    @Mock UsuarioRepository usuarios;
    @Mock AuditService audit;
    GestaoSetorService service;
    @BeforeEach void setup() { service = new GestaoSetorService(setores, permissoes, templates, usuarios, audit); }
    SetorRequestDTO request() { return new SetorRequestDTO(" Operação ", "  Descrição  ", Map.of(), List.of(" SPO ", "CWB", "SPO")); }
    SetorEntity setor(long id, String nome) { var setor = new SetorEntity(); setor.setId(id); setor.setNome(nome); setor.setChave("setor-" + id); return setor; }

    @Test void criacaoNormalizaEntradaPreservaEscopoEAudita() {
        when(setores.save(any())).thenAnswer(invocation -> { SetorEntity s = invocation.getArgument(0); s.setId(1L); return s; });
        var result = service.criarSetor(request());
        assertThat(result.nome()).isEqualTo("Operação");
        assertThat(result.descricao()).isEqualTo("Descrição");
        assertThat(result.filiaisPermitidas()).containsExactly("CWB", "SPO");
        assertThat(result.ativo()).isTrue();
        assertThat(result.sistema()).isFalse();
        verify(audit).registrar(eq(AcaoAudit.SETOR_CRIADO), isNull(), isNull(), startsWith("setor:setor-"), isNull());
    }

    @Test void nomeDuplicadoNaoPersisteNemAudita() {
        when(setores.existsByNomeIgnoreCase("Operação")).thenReturn(true);
        assertThatThrownBy(() -> service.criarSetor(request())).isInstanceOf(IllegalStateException.class);
        verify(setores, never()).save(any()); verifyNoInteractions(templates, audit);
    }

    @Test void filiaisSemConteudoNaoPersiste() {
        var request = new SetorRequestDTO("Operação", null, Map.of(), List.of(" ", ""));
        assertThatThrownBy(() -> service.criarSetor(request)).isInstanceOf(IllegalArgumentException.class);
        verify(setores, never()).save(any()); verifyNoInteractions(templates, audit);
    }

    @Test void atualizacaoMantemIdentidadeDeSistemaERegistraAuditoria() {
        var setor = setor(2L, "Anterior"); setor.setSistema(true);
        when(setores.findById(2L)).thenReturn(Optional.of(setor));
        when(setores.save(setor)).thenReturn(setor);
        var result = service.atualizarSetor(2L, request());
        assertThat(result.nome()).isEqualTo("Operação");
        assertThat(result.sistema()).isTrue();
        assertThat(setor.getChave()).isEqualTo("setor-2");
        verify(audit).registrar(AcaoAudit.SETOR_ATUALIZADO, null, null, "setor:setor-2", null);
    }

    @Test void setorInexistenteNaoCriaRegistroNaAtualizacao() {
        assertThatThrownBy(() -> service.atualizarSetor(404L, request())).isInstanceOf(IllegalArgumentException.class);
        verify(setores, never()).save(any()); verifyNoInteractions(templates, audit);
    }

    @Test void exclusaoDeSistemaEhBloqueada() {
        var setor = setor(1L, "Sistema"); setor.setSistema(true);
        when(setores.findById(1L)).thenReturn(Optional.of(setor));
        assertThatThrownBy(() -> service.excluirSetor(1L)).isInstanceOf(IllegalStateException.class);
        assertThat(setor.isAtivo()).isTrue();
        verify(setores, never()).save(any()); verifyNoInteractions(audit);
    }

    @Test void exclusaoPreservaRegistroETrilhaDeAuditoria() {
        var setor = setor(2L, "Operação");
        when(setores.findById(2L)).thenReturn(Optional.of(setor));
        service.excluirSetor(2L);
        assertThat(setor.isAtivo()).isFalse();
        assertThat(setor.getId()).isEqualTo(2L);
        verify(setores).save(setor);
        verify(setores, never()).delete(any()); verify(setores, never()).deleteById(any());
        verify(audit).registrar(AcaoAudit.SETOR_EXCLUIDO, null, null, "setor:setor-2", null);
    }

    @Test void listaSomenteConsultaAtivosEOrdenaComContagemDoRepositorio() {
        when(setores.findAllByAtivoTrue()).thenReturn(List.of(setor(2L, "Zulu"), setor(1L, "alpha")));
        when(usuarios.countBySetorId(1L)).thenReturn(12L);
        var result = service.listarSetores();
        assertThat(result).extracting(item -> item.nome()).containsExactly("alpha", "Zulu");
        assertThat(result.get(0).totalUsuarios()).isEqualTo(12);
        verify(setores, never()).findAll(); verifyNoInteractions(audit);
    }
}
