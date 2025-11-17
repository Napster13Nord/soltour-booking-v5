# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [4.1.0] - 2025-01-13

### 🎉 **Adicionado**

#### **Cards de Pacotes Enriquecidos**
- ✅ **Slider de imagens** com navegação por setas e dots
  - Suporte para até 10 imagens por hotel
  - Transição suave (fade in/out 0.5s)
  - Setas aparecem apenas no hover
  - Navegação em loop circular
  - Indicadores visuais (dots) na parte inferior

- ✅ **Descrição expansível**
  - Texto truncado em 150 caracteres
  - Botão "ler mais" para expandir
  - Botão "ver menos" para recolher
  - Transição suave entre estados

- ✅ **Preços detalhados**
  - Preço por pessoa (desde X€ / pax)
  - Preço total separado
  - Cálculo automático baseado em número de passageiros
  - Formatação profissional

- ✅ **Logo da companhia aérea** nos cards de voo
  - Extração automática do código IATA
  - Fallback para serviço de logos (Kiwi.com)
  - Tamanho: 32x32px com padding e sombra
  - Onerror handler para imagens não encontradas

#### **Funções JavaScript**
- `SoltourApp.changeSlide(btn, direction)` - Navegação no slider
- `SoltourApp.goToSlide(dot, index)` - Ir para slide específico
- `SoltourApp.toggleDescription(btn)` - Expandir/recolher descrição

#### **CSS Adicionado**
- `.package-image-slider` - Container do slider
- `.slider-images`, `.slider-image` - Imagens do slider
- `.slider-btn`, `.slider-prev`, `.slider-next` - Botões de navegação
- `.slider-dots`, `.slider-dot` - Indicadores
- `.airline-logo` - Logo da companhia aérea
- `.description-text`, `.description-short`, `.description-full` - Descrição
- `.read-more-btn` - Botão "ler mais"
- `.price-per-person`, `.price-total` - Preços detalhados

### 🔄 **Modificado**

#### **Fluxo de Navegação**
- 🔄 Alterado fluxo: Buscar → Resultados → **Cotação** (direto)
- 🔄 Removida página intermediária de detalhes do pacote
- 🔄 Botão "Ver Detalhes" alterado para "Selecionar"
- 🔄 Redirecionamento direto para `/cotacao/?budget={ID}`

#### **Estrutura dos Cards**
- 🔄 Grid de voos ajustado para `60px 32px 1fr auto auto`
- 🔄 Coleta múltiplas imagens ao invés de apenas uma
- 🔄 Cálculo dinâmico do número de passageiros

### 🗑️ **Removido**

#### **Código Desnecessário (~850 linhas)**
- ❌ `assets/js/package-details.js` (481 linhas)
- ❌ `assets/js/soltour-booking.js.backup` (arquivo de backup)
- ❌ Enqueue do script package-details
- ❌ Shortcode `[soltour_package_details]` e sua função (25 linhas)
- ❌ CSS específico da página de detalhes (~340 linhas)
- ❌ Função `package_details()` em class-soltour-shortcodes.php

#### **Por que foi removido?**
- ✅ Simplificação do fluxo de usuário
- ✅ Código mais limpo e manutenível
- ✅ Menor bundle JavaScript/CSS
- ✅ Melhor performance

### 🐛 **Corrigido**
- 🐛 Mantida AJAX action `soltour_get_package_details` (ainda usada por quote-page.js)
- 🐛 CSS `.package-details` nos cards preservado

### 📊 **Estatísticas**
- **+255 linhas** de código adicionadas (slider + descrição)
- **-850 linhas** de código removidas (limpeza)
- **Net: -595 linhas** (código mais enxuto)
- **3 funções JavaScript** novas
- **2 funcionalidades** implementadas

---

## [4.0.0] - 2025-01-12

### 🎉 **Adicionado**

#### **Sistema Completo de Cotação**
- ✅ Página de cotação com formulário completo
- ✅ Gestão de titular e passageiros
- ✅ Serviços opcionais (seguros, transfers, golf, equipagem)
- ✅ Validações em tempo real
- ✅ Cálculo dinâmico de preços

#### **Módulos JavaScript**
- ✅ `delayed-availability.js` - Disponibilidade assíncrona
- ✅ `toast-notifications.js` - Notificações em tempo real
- ✅ `delayed-quote.js` - Cotação com preços finais
- ✅ `quote-form.js` - Formulário de cotação
- ✅ `optional-services.js` - Gestão de serviços opcionais
- ✅ `quote-validations.js` - Validações (idade, email, expediente)
- ✅ `breakdown.js` - Desglose bruto/líquido
- ✅ `navigation.js` - Navegação com cache
- ✅ `copy-holder.js` - Copiar titular para passageiro

#### **API Integration**
- ✅ 21 AJAX actions registradas
- ✅ Endpoint `/booking/availability` implementado
- ✅ Sistema de tokens de sessão
- ✅ CheckAllowedSelling antes de cotação
- ✅ Retry logic com exponential backoff

#### **UI/UX Improvements**
- ✅ Cards de pacotes com hover effects
- ✅ Loading modal com animação Lottie
- ✅ Toast notifications coloridas
- ✅ Formulários responsivos
- ✅ Validações inline

### 🔄 **Modificado**
- 🔄 Migração completa para API Soltour V5
- 🔄 Arquitetura modular do JavaScript
- 🔄 Sistema de cache otimizado
- 🔄 Melhorias de performance

---

## [3.0.0] - 2024-12-15

### 🎉 **Adicionado**
- ✅ Sistema de busca avançado
- ✅ Filtros por preço e classificação
- ✅ Paginação de resultados
- ✅ Cards de pacotes básicos

### 🔄 **Modificado**
- 🔄 Refatoração do código base
- 🔄 Melhorias de segurança

---

## [2.0.0] - 2024-11-20

### 🎉 **Adicionado**
- ✅ Integração básica com API Soltour V4
- ✅ Formulário de busca simples
- ✅ Lista básica de resultados

---

## [1.0.0] - 2024-10-01

### 🎉 **Inicial**
- ✅ Versão inicial do plugin
- ✅ Estrutura básica WordPress
- ✅ Primeiros shortcodes

---

## 📋 **Tipos de Mudanças**

- **✅ Adicionado** - Novas funcionalidades
- **🔄 Modificado** - Mudanças em funcionalidades existentes
- **🗑️ Removido** - Funcionalidades removidas
- **🐛 Corrigido** - Correções de bugs
- **🔒 Segurança** - Correções de vulnerabilidades
- **📊 Performance** - Melhorias de performance

---

## 🔗 **Links**

- [Unreleased]: Comparar com última versão
- [4.1.0]: https://github.com/.../compare/v4.0.0...v4.1.0
- [4.0.0]: https://github.com/.../compare/v3.0.0...v4.0.0
- [3.0.0]: https://github.com/.../compare/v2.0.0...v3.0.0
- [2.0.0]: https://github.com/.../compare/v1.0.0...v2.0.0
- [1.0.0]: https://github.com/.../releases/tag/v1.0.0

---

**Última atualização:** 13 de Janeiro de 2025
