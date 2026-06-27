# ADR 0002 — Spring Boot 3.5.9, target Java 21 sobre JDK 25

**Status:** Aceito · **Data:** 2026-06-26

## Contexto

A máquina de desenvolvimento tem **JDK 25** (LTS, muito recente) e Maven 3.9.14. Spring Boot
4.x já existe, mas tem menos material de apoio (tutoriais, Stack Overflow) e introduz quebras
(Spring Framework 7). O ciclo agêntico precisa de chamadas HTTP síncronas ao gateway.

## Decisão

- **Spring Boot 3.5.9** — estável e bem documentado; detecta Java 25 desde 3.5.7.
- **Target de compilação Java 21**, executando sobre **JDK 25** (bytecode 21 roda em runtime
  25 sem problema).
- **Sem Lombok** — evita incompatibilidades de processadores de anotação com JDK novo.
- **`RestClient`** (síncrono, em `spring-web`) para falar com o gateway — sem necessidade de
  WebFlux.

## Consequências

**Prós**
- Máxima compatibilidade de bibliotecas e farto material de referência.
- Build reproduzível (Maven wrapper commitado).

**Contras / trade-offs**
- Não usa recursos de linguagem do Java 25 no bytecode (target 21).
- Quando o ecossistema amadurecer, pode valer migrar para Spring Boot 4.x (novo ADR).
