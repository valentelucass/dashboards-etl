package com.dashboard.api.dto.customerservice;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CustomerServiceFinanceiroDTO(
        BigDecimal faturado,
        BigDecimal pendenteFaturamento,
        BigDecimal aVencer,
        BigDecimal emAtraso,
        BigDecimal pago,
        BigDecimal semVencimento,
        long fretes,
        long fretesFaturados,
        long fretesPendentes,
        long fretesFaturadosSemParcela,
        LocalDate dataCorte) {}
