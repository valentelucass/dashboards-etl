package com.dashboard.api.repository;

import com.dashboard.api.dto.performance.PerformanceOperacionalDTO.EficienciaFilial;
import com.dashboard.api.util.PerformanceMetricasUtils;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Cada percurso é lido na ordem operacional. NFs da mesma passagem formam uma única medição. */
final class PerformanceEficiencia {
    record Evento(int codigo, String nota, LocalDateTime hora, String filial, boolean entrega) {}
    record Frete(boolean finalizado, boolean noPrazo, LocalDate finalizacao) {}
    private enum Tipo { EFE, EFT, EFD }
    private record Visita(Tipo tipo, String origem, int numero) {}

    private static final String SEM_FILIAL = "Sem informação";
    private final LocalDate inicio;
    private final LocalDate fim;
    private final LocalDateTime agora;
    private final Set<LocalDate> feriados;
    private final Map<String, Filial> resultado = new TreeMap<>();

    PerformanceEficiencia(LocalDate inicio, LocalDate fim, LocalDateTime agora, Set<LocalDate> feriados) {
        this.inicio = inicio;
        this.fim = fim;
        this.agora = agora;
        this.feriados = feriados;
    }

    void adicionar(Frete frete, List<Evento> eventos) {
        Map<String, List<Evento>> porNota = new LinkedHashMap<>();
        List<Evento> comuns = new ArrayList<>();
        Evento entrega = null;
        Evento distribuicao = null;
        Evento emissao = null;
        for (Evento evento : eventos) {
            if (evento.hora().isAfter(agora)) continue;
            if (evento.entrega()) entrega = evento;
            if (evento.codigo() == 55) distribuicao = evento;
            if (evento.codigo() == 110 && emissao == null) emissao = evento;
            if (evento.nota() == null) comuns.add(evento);
            else porNota.computeIfAbsent(evento.nota(), chave -> new ArrayList<>()).add(evento);
        }
        if (porNota.isEmpty()) porNota.put("", new ArrayList<>());
        Map<Visita, Etapa> passagens = new LinkedHashMap<>();
        for (List<Evento> caminho : porNota.values()) {
            // Um lançamento sem NF se aplica ao frete. O mesmo evento não gera uma passagem por nota.
            if (!comuns.isEmpty()) {
                caminho.addAll(comuns);
                caminho.sort(java.util.Comparator.comparing(Evento::hora)
                        .thenComparingInt(e -> ordemOperacional(e.codigo())));
            }
            Map<Visita, Etapa> etapasDaNota = analisarNota(caminho, emissao);
            etapasDaNota.forEach((visita, parcial) -> etapa(passagens, visita).incluir(visita.tipo(), parcial));
        }
        passagens.forEach((visita, etapa) -> medir(visita.tipo(), etapa, frete.finalizado()));
        if (frete.finalizado()) {
            LocalDate data = entrega == null ? frete.finalizacao() : entrega.hora().toLocalDate();
            if (noPeriodo(data)) {
                String filial = entrega != null && entrega.filial() != null ? entrega.filial()
                        : distribuicao == null ? null : distribuicao.filial();
                Filial totais = filial(filial);
                if (filial == null) totais.semInformacao++;
                else totais.otif.contar(frete.noPrazo());
            }
        }
    }

    static int ordemOperacional(int codigo) {
        return switch (codigo) {
            case 110 -> 0;
            case 102 -> 1;
            case 103 -> 2;
            case 101 -> 3;
            case 55 -> 4;
            default -> 5;
        };
    }

    private static Map<Visita, Etapa> analisarNota(List<Evento> caminho, Evento emissao) {
        Map<Visita, Etapa> passagens = new LinkedHashMap<>();
        Visita embarque = new Visita(Tipo.EFE, "", 1);
        Visita destino = new Visita(Tipo.EFD, "", 1);
        Map<String, Integer> visitasFilial = new HashMap<>();
        Visita transbordo = null;
        Evento chegada = null;
        Evento chegadaDestino = null;
        Evento saidaDestino = null;
        boolean embarqueEncerrado = false;
        boolean trechoInicial = true;
        boolean transbordoEncerrado = false;

        if (emissao != null) etapa(passagens, embarque).abrir(emissao);
        for (Evento e : caminho) {
            switch (e.codigo()) {
                case 102 -> {
                    if (!embarqueEncerrado && emissao != null) etapa(passagens, embarque).avancou = true;
                    trechoInicial = false;
                    if (transbordo == null || transbordoEncerrado || !java.util.Objects.equals(chegada.filial(), e.filial())) {
                        if (transbordo != null && !transbordoEncerrado) etapa(passagens, transbordo).avancou = true;
                        chegada = e;
                        int numero = visitasFilial.merge(e.filial(), 1, Integer::sum);
                        transbordo = new Visita(Tipo.EFT, e.filial(), numero);
                        etapa(passagens, transbordo).abrir(e);
                        transbordoEncerrado = false;
                    }
                }
                case 103 -> {
                    if (transbordo != null) {
                        etapa(passagens, transbordo).fechar(e);
                        transbordoEncerrado = true;
                    } else if (trechoInicial && !embarqueEncerrado) {
                        etapa(passagens, embarque).fechar(e);
                        embarqueEncerrado = true;
                    }
                }
                case 101, 55 -> {
                    if (!embarqueEncerrado && emissao != null) etapa(passagens, embarque).avancou = true;
                    if (transbordo != null && !transbordoEncerrado) etapa(passagens, transbordo).avancou = true;
                    trechoInicial = false;
                    transbordo = null;
                    if (e.codigo() == 101) {
                        chegadaDestino = e;
                        saidaDestino = null;
                    } else if (saidaDestino == null) saidaDestino = e;
                }
                default -> { /* Emissão e entrega final são tratadas uma vez por frete. */ }
            }
        }
        if (chegadaDestino != null || saidaDestino != null) {
            Etapa etapa = etapa(passagens, destino);
            etapa.inicio = chegadaDestino;
            if (saidaDestino != null) etapa.fechar(saidaDestino);
        }
        return passagens;
    }

    private static Etapa etapa(Map<Visita, Etapa> passagens, Visita chave) {
        return passagens.computeIfAbsent(chave, v -> new Etapa());
    }

    private void medir(Tipo tipo, Etapa etapa, boolean finalizado) {
        Evento fimConfirmado = etapa.notaSemSaida ? null : etapa.fim;
        Evento registro = fimConfirmado == null ? etapa.inicio : fimConfirmado;
        if (registro == null || !noPeriodo(registro.hora().toLocalDate())) return;
        Filial filial = filial(registro.filial());
        if (registro.filial() == null || etapa.notaSemInicio ||
                (fimConfirmado == null && (finalizado || etapa.avancou)) ||
                registro.hora().isBefore(etapa.inicio.hora())) {
            filial.semInformacao++;
            return;
        }
        long limite = tipo == Tipo.EFD ? 48 : 24;
        LocalDateTime ate = fimConfirmado == null ? agora : fimConfirmado.hora();
        boolean eficiente = tempoUtil(etapa.inicio.hora(), ate, feriados).compareTo(Duration.ofHours(limite)) <= 0;
        if (fimConfirmado != null || !eficiente) filial.etapas[tipo.ordinal()].contar(eficiente);
    }

    private boolean noPeriodo(LocalDate data) {
        return data != null && !data.isBefore(inicio) && !data.isAfter(fim);
    }

    private Filial filial(String nome) {
        return resultado.computeIfAbsent(nome == null ? SEM_FILIAL : nome, k -> new Filial());
    }

    static Duration tempoUtil(LocalDateTime inicio, LocalDateTime fim, Set<LocalDate> feriadosNacionais) {
        Duration total = Duration.ZERO;
        LocalDateTime posicao = inicio;
        while (posicao.isBefore(fim)) {
            LocalDate dia = posicao.toLocalDate();
            LocalDateTime limite = dia.plusDays(1).atStartOfDay();
            if (limite.isAfter(fim)) limite = fim;
            if (dia.getDayOfWeek() != DayOfWeek.SATURDAY && dia.getDayOfWeek() != DayOfWeek.SUNDAY
                    && !feriadosNacionais.contains(dia)) {
                total = total.plus(Duration.between(posicao, limite));
            }
            posicao = limite;
        }
        return total;
    }

    List<EficienciaFilial> resultados() {
        List<EficienciaFilial> linhas = new ArrayList<>();
        resultado.forEach((nome, f) -> linhas.add(new EficienciaFilial(nome, f.etapas[0].percentual(),
                f.etapas[1].percentual(), f.etapas[2].percentual(), f.otif.percentual(), f.semInformacao)));
        return linhas;
    }

    private static final class Etapa {
        Evento inicio;
        Evento fim;
        boolean avancou;
        boolean notaSemInicio;
        boolean notaSemSaida;
        void incluir(Tipo tipo, Etapa nota) {
            notaSemInicio |= nota.inicio == null;
            notaSemSaida |= nota.fim == null;
            avancou |= nota.avancou;
            if (nota.inicio != null) {
                if (tipo == Tipo.EFD) {
                    if (inicio == null || nota.inicio.hora().isAfter(inicio.hora())) inicio = nota.inicio;
                } else abrir(nota.inicio);
            }
            if (nota.fim != null) fechar(nota.fim);
        }
        void abrir(Evento evento) {
            if (inicio == null || evento.hora().isBefore(inicio.hora())) inicio = evento;
        }
        void fechar(Evento evento) {
            if (fim == null || !evento.hora().isBefore(fim.hora())) fim = evento;
        }
    }
    private static final class Filial {
        final Contagem[] etapas = {new Contagem(), new Contagem(), new Contagem()};
        final Contagem otif = new Contagem();
        long semInformacao;
    }
    private static final class Contagem {
        long eficientes;
        long total;
        void contar(boolean eficiente) { total++; if (eficiente) eficientes++; }
        Double percentual() { return total == 0 ? null : PerformanceMetricasUtils.percentual(eficientes, total); }
    }
}
