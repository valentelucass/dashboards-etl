package com.dashboard.api.dto.acesso;

import java.util.List;

public record UsuarioSessaoResumoDTO(
        long totalUsuarios,
        long usuariosAtivos,
        long usuariosInativos,
        long usuariosOnline,
        List<UsuarioOnlineResumoDTO> usuariosOnlineDetalhes,
        boolean podeVerTrilha,
        List<UsuarioOnlineResumoDTO> usuariosRecentes
) {
    public UsuarioSessaoResumoDTO(long total, long ativos, long inativos, long online, List<UsuarioOnlineResumoDTO> detalhes) {
        this(total, ativos, inativos, online, detalhes, false, List.of());
    }

    public UsuarioSessaoResumoDTO {
        usuariosOnlineDetalhes = usuariosOnlineDetalhes == null ? List.of() : List.copyOf(usuariosOnlineDetalhes);
        usuariosRecentes = usuariosRecentes == null ? List.of() : List.copyOf(usuariosRecentes);
    }

    public UsuarioSessaoResumoDTO(
            long totalUsuarios,
            long usuariosAtivos,
            long usuariosInativos,
            long usuariosOnline
    ) {
        this(totalUsuarios, usuariosAtivos, usuariosInativos, usuariosOnline, List.of());
    }
}
