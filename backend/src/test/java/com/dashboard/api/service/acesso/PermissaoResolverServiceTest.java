package com.dashboard.api.service.acesso;

import com.dashboard.api.model.acesso.PapelEntity;
import com.dashboard.api.model.acesso.PermissaoEntity;
import com.dashboard.api.model.acesso.SetorEntity;
import com.dashboard.api.model.acesso.SetorPermissaoTemplate;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.model.acesso.UsuarioPapelVinculo;
import com.dashboard.api.model.acesso.UsuarioPermissaoOverride;
import com.dashboard.api.repository.acesso.PermissaoRepository;
import com.dashboard.api.repository.acesso.SetorPermissaoTemplateRepository;
import com.dashboard.api.repository.acesso.UsuarioPapelVinculoRepository;
import com.dashboard.api.repository.acesso.UsuarioPermissaoOverrideRepository;
import com.dashboard.api.security.acesso.UsuarioSupremo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PermissaoResolverServiceTest {

    @Mock private PermissaoRepository permissaoRepository;
    @Mock private SetorPermissaoTemplateRepository templateRepository;
    @Mock private UsuarioPapelVinculoRepository papelVinculoRepository;
    @Mock private UsuarioPermissaoOverrideRepository overrideRepository;

    private PermissaoResolverService service;

    @BeforeEach
    void setUp() {
        service = new PermissaoResolverService(
                permissaoRepository,
                templateRepository,
                papelVinculoRepository,
                overrideRepository,
                new UsuarioSupremo("supremo@empresa.com", "Senha@123456", "Supremo", "desenvolvedor", 1000, false)
        );
    }

    @ParameterizedTest
    @ValueSource(strings = {"desenvolvedor", "admin_plataforma", "usuario_comum"})
    void sessaoMantemAsPermissoesConhecidasMesmoComUmRecursoDeOutraVersao(String papelNome) {
        SetorEntity setor = new SetorEntity();
        setor.setId(10L);
        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(20L);
        usuario.setSetor(setor);
        PapelEntity papel = new PapelEntity();
        papel.setNome(papelNome);
        papel.setNivel(10);
        UsuarioPapelVinculo vinculo = new UsuarioPapelVinculo();
        vinculo.setPapel(papel);

        PermissaoEntity conhecida = new PermissaoEntity();
        conhecida.setId(30L);
        conhecida.setChaveLegado("coletas");
        PermissaoEntity futura = new PermissaoEntity();
        futura.setId(40L);
        futura.setChaveLegado("recursoDaProximaVersao");
        when(permissaoRepository.findAllByAtivoTrue()).thenReturn(List.of(conhecida, futura));
        when(papelVinculoRepository.findAllByUsuarioId(20L)).thenReturn(List.of(vinculo));
        if (PermissaoResolverService.PAPEL_USUARIO_COMUM.equals(papelNome)) {
            when(templateRepository.findAllBySetorId(10L)).thenReturn(List.of(
                    new SetorPermissaoTemplate(setor, conhecida), new SetorPermissaoTemplate(setor, futura)));
        }
        assertEquals(Map.of("coletas", true), service.permissoesEfetivas(usuario));
    }

    @Test
    void negacaoDoUsuarioDeveVencerPermissaoDoSetor() {
        SetorEntity setor = new SetorEntity();
        setor.setId(10L);

        UsuarioEntity usuario = new UsuarioEntity();
        usuario.setId(20L);
        usuario.setSetor(setor);

        PermissaoEntity permissao = new PermissaoEntity();
        permissao.setId(30L);
        permissao.setChave("dashboard.coletas.read");
        permissao.setChaveLegado("coletas");
        permissao.setAtivo(true);

        PapelEntity papel = new PapelEntity();
        papel.setNome(PermissaoResolverService.PAPEL_USUARIO_COMUM);
        papel.setNivel(10);

        UsuarioPapelVinculo vinculo = new UsuarioPapelVinculo();
        vinculo.setPapel(papel);

        UsuarioPermissaoOverride override = new UsuarioPermissaoOverride();
        override.setPermissao(permissao);
        override.setTipo("DENY");

        when(permissaoRepository.findAllByAtivoTrue()).thenReturn(List.of(permissao));
        when(papelVinculoRepository.findAllByUsuarioId(20L)).thenReturn(List.of(vinculo));
        when(templateRepository.findAllBySetorId(10L)).thenReturn(List.of(new SetorPermissaoTemplate(setor, permissao)));
        when(overrideRepository.findAllByUsuarioId(20L)).thenReturn(List.of(override));

        Map<String, Boolean> resultado = service.permissoesEfetivas(usuario);

        assertFalse(resultado.get("coletas"));
    }
}
