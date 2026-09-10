package com.dashboard.api.service;

import com.dashboard.api.dto.home.HomeComunicadoDTO;
import com.dashboard.api.dto.home.HomeComunicadoRequestDTO;
import com.dashboard.api.model.acesso.HomeComunicadoEntity;
import com.dashboard.api.repository.acesso.HomeComunicadoRepository;
import com.dashboard.api.repository.acesso.HomeComunicadoCurtidaRepository;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.model.acesso.HomeComunicadoCurtidaEntity;
import com.dashboard.api.model.acesso.HomeComunicadoComentarioEntity;
import com.dashboard.api.dto.home.HomeComunicadoComentarioDTO;
import com.dashboard.api.dto.home.HomeComunicadoComentarioRequestDTO;
import com.dashboard.api.repository.acesso.HomeComunicadoComentarioRepository;
import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HomeComunicadoService {

    private static final Set<String> TAGS_VALIDAS = Set.of("NOVO", "ATENCAO", "FIXADO");
    private final HomeComunicadoRepository repository;
    private final HomeComunicadoCurtidaRepository curtidaRepository;
    private final UsuarioRepository usuarioRepository;
    private final HomeComunicadoComentarioRepository comentarioRepository;

    public HomeComunicadoService(
            HomeComunicadoRepository repository,
            HomeComunicadoCurtidaRepository curtidaRepository,
            UsuarioRepository usuarioRepository,
            HomeComunicadoComentarioRepository comentarioRepository
    ) {
        this.repository = repository;
        this.curtidaRepository = curtidaRepository;
        this.usuarioRepository = usuarioRepository;
        this.comentarioRepository = comentarioRepository;
    }

    @Transactional(readOnly = true)
    public List<HomeComunicadoDTO> listarAtivos(String usuarioEmail) {
        List<HomeComunicadoEntity> comunicados = repository.listarAtivosOrdenados();
        Long usuarioId = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(usuarioEmail)
                .map(usuario -> usuario.getId())
                .orElse(-1L);
        if (comunicados.isEmpty()) return List.of();
        Set<Long> naoLidos = Set.copyOf(repository.listarIdsNaoLidos(usuarioId));
        List<Long> comunicadoIds = comunicados.stream().map(HomeComunicadoEntity::getId).toList();
        Map<Long, HomeComunicadoCurtidaRepository.ResumoCurtidasProjection> curtidasPorComunicado = curtidaRepository
                .resumirAtivasPorComunicado(comunicadoIds, usuarioId).stream()
                .collect(java.util.stream.Collectors.toMap(HomeComunicadoCurtidaRepository.ResumoCurtidasProjection::getComunicadoId, resumo -> resumo));
        Map<Long, Long> totalComentariosPorComunicado = comentarioRepository.resumirAtivosPorComunicado(comunicadoIds).stream()
                .collect(java.util.stream.Collectors.toMap(
                        HomeComunicadoComentarioRepository.ResumoComentariosProjection::getComunicadoId,
                        HomeComunicadoComentarioRepository.ResumoComentariosProjection::getTotalComentarios
                ));
        return comunicados.stream()
                .map(comunicado -> toDto(
                        comunicado,
                        curtidasPorComunicado.get(comunicado.getId()),
                        totalComentariosPorComunicado.getOrDefault(comunicado.getId(), 0L),
                        naoLidos.contains(comunicado.getId())
                ))
                .toList();
    }

    @Transactional
    public void registrarLeitura(Long id, Instant versao, String usuarioEmail) {
        buscarAtivo(id);
        Long usuarioId = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(usuarioEmail)
                .map(usuario -> usuario.getId())
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Usuário autenticado não encontrado."));
        // A versão enviada é a que a pessoa abriu: uma edição concorrente continua não lida.
        repository.registrarLeitura(usuarioId, id, versao);
    }

    @Transactional
    public HomeComunicadoDTO criar(HomeComunicadoRequestDTO request, String usuarioLogin) {
        HomeComunicadoEntity entity = new HomeComunicadoEntity();
        aplicarRequest(entity, request);
        entity.setAtivo(true);
        entity.setPublicadoEm(Instant.now());
        entity.setCriadoPor(usuarioLogin);
        entity.setAtualizadoPor(usuarioLogin);
        return toDto(repository.save(entity), null, 0L);
    }

    @Transactional
    public HomeComunicadoDTO atualizar(Long id, HomeComunicadoRequestDTO request, String usuarioLogin) {
        HomeComunicadoEntity entity = buscarAtivo(id);
        aplicarRequest(entity, request);
        entity.setAtualizadoPor(usuarioLogin);
        return toDto(repository.save(entity), null, 0L);
    }

    @Transactional
    public void arquivar(Long id, String usuarioLogin) {
        HomeComunicadoEntity entity = buscarAtivo(id);
        entity.setAtivo(false);
        entity.setAtualizadoPor(usuarioLogin);
        repository.save(entity);
    }

    @Transactional
    public HomeComunicadoDTO alternarCurtida(Long id, String usuarioEmail) {
        HomeComunicadoEntity comunicado = buscarAtivo(id);
        Long usuarioId = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(usuarioEmail)
                .map(usuario -> usuario.getId())
                .orElseThrow(() -> new IllegalArgumentException("Usuário autenticado não encontrado."));
        HomeComunicadoCurtidaEntity curtida = curtidaRepository.findByComunicadoIdAndUsuarioId(id, usuarioId)
                .orElseGet(() -> {
                    HomeComunicadoCurtidaEntity novaCurtida = new HomeComunicadoCurtidaEntity();
                    novaCurtida.setComunicadoId(id);
                    novaCurtida.setUsuarioId(usuarioId);
                    novaCurtida.setCriadoEm(Instant.now());
                    return novaCurtida;
                });
        boolean curtidaExistente = curtida.getId() != null;
        curtida.setAtivo(!curtidaExistente || !curtida.isAtivo());
        curtida.setAtualizadoEm(Instant.now());
        curtidaRepository.save(curtida);
        return listarAtivos(usuarioEmail).stream()
                .filter(item -> item.id().equals(String.valueOf(comunicado.getId())))
                .findFirst()
                .orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<HomeComunicadoComentarioDTO> listarComentarios(Long id, String usuarioEmail, boolean podeGerenciar) {
        buscarAtivo(id);
        Long usuarioId = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(usuarioEmail)
                .map(usuario -> usuario.getId())
                .orElse(-1L);
        return comentarioRepository.listarAtivos(id).stream()
                .map(item -> new HomeComunicadoComentarioDTO(
                        String.valueOf(item.getId()),
                        item.getAutorNome(),
                        item.getCorpo(),
                        item.getCriadoEm(),
                        podeGerenciar || usuarioId.equals(item.getUsuarioId())
                ))
                .toList();
    }

    @Transactional
    public HomeComunicadoComentarioDTO comentar(Long id, HomeComunicadoComentarioRequestDTO request, String usuarioEmail) {
        buscarAtivo(id);
        var usuario = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(usuarioEmail)
                .orElseThrow(() -> new IllegalArgumentException("Usuário autenticado não encontrado."));
        HomeComunicadoComentarioEntity comentario = new HomeComunicadoComentarioEntity();
        comentario.setComunicadoId(id);
        comentario.setUsuarioId(usuario.getId());
        comentario.setCorpo(request.corpo().trim());
        comentario.setAtivo(true);
        comentario.setCriadoEm(Instant.now());
        comentario.setAtualizadoEm(Instant.now());
        HomeComunicadoComentarioEntity salvo = comentarioRepository.save(comentario);
        return new HomeComunicadoComentarioDTO(String.valueOf(salvo.getId()), usuario.getNome(), salvo.getCorpo(), salvo.getCriadoEm(), true);
    }

    @Transactional
    public void excluirComentario(Long comunicadoId, Long comentarioId, String usuarioEmail, boolean podeGerenciar) {
        buscarAtivo(comunicadoId);
        var usuario = usuarioRepository.findByEmailIgnoreCaseAndAtivoTrue(usuarioEmail)
                .orElseThrow(() -> new IllegalArgumentException("Usuário autenticado não encontrado."));
        HomeComunicadoComentarioEntity comentario = comentarioRepository.findById(comentarioId)
                .orElseThrow(() -> new IllegalArgumentException("Comentário não encontrado."));
        if (!comentario.isAtivo() || !comentario.getComunicadoId().equals(comunicadoId)) {
            throw new IllegalArgumentException("Comentário não encontrado.");
        }
        if (!podeGerenciar && !comentario.getUsuarioId().equals(usuario.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Você não pode excluir este comentário.");
        }
        comentario.setAtivo(false);
        comentario.setAtualizadoEm(Instant.now());
        comentarioRepository.save(comentario);
    }

    private HomeComunicadoEntity buscarAtivo(Long id) {
        HomeComunicadoEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Comunicado nao encontrado."));

        if (!entity.isAtivo()) {
            throw new IllegalArgumentException("Comunicado nao encontrado.");
        }

        return entity;
    }

    private void aplicarRequest(HomeComunicadoEntity entity, HomeComunicadoRequestDTO request) {
        String tag = normalizarTag(request.tag());
        if (!TAGS_VALIDAS.contains(tag)) {
            throw new IllegalArgumentException("Tag de comunicado invalida.");
        }

        entity.setTitulo(request.titulo().trim());
        entity.setCorpo(request.corpo().trim());
        entity.setTag(tag);
        entity.setPublicoAlvo(request.publicoAlvo().trim());
    }

    private String normalizarTag(String tag) {
        if (tag == null) return "";
        String semAcento = Normalizer.normalize(tag, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return semAcento.trim().toUpperCase(Locale.ROOT);
    }

    private HomeComunicadoDTO toDto(
            HomeComunicadoEntity entity,
            HomeComunicadoCurtidaRepository.ResumoCurtidasProjection curtidas,
            long totalComentarios
    ) {
        return toDto(entity, curtidas, totalComentarios, true);
    }

    private HomeComunicadoDTO toDto(
            HomeComunicadoEntity entity,
            HomeComunicadoCurtidaRepository.ResumoCurtidasProjection curtidas,
            long totalComentarios,
            boolean naoLido
    ) {
        List<String> curtidoPor = curtidas == null || curtidas.getCurtidoPor() == null
                ? List.of()
                : List.of(curtidas.getCurtidoPor().split("\\|"));
        return new HomeComunicadoDTO(
                String.valueOf(entity.getId()),
                entity.getTitulo(),
                entity.getCorpo(),
                entity.getTag(),
                entity.getPublicoAlvo(),
                entity.getPublicadoEm(),
                entity.getAtualizadoPor(),
                entity.getAtualizadoEm(),
                curtidas == null || curtidas.getTotalCurtidas() == null ? 0 : curtidas.getTotalCurtidas(),
                totalComentarios,
                curtidoPor,
                curtidas != null && Boolean.TRUE.equals(curtidas.getCurtidoPeloUsuarioAtual()),
                naoLido
        );
    }
}
