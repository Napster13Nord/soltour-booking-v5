# Soltour Booking V5 - Plugin WordPress

![Version](https://img.shields.io/badge/version-5-blue.svg)
![WordPress](https://img.shields.io/badge/WordPress-5.8+-brightgreen.svg)
![PHP](https://img.shields.io/badge/PHP-7.4+-purple.svg)
![License](https://img.shields.io/badge/license-GPL--2.0-orange.svg)

Plugin WordPress profissional para integração completa com a API Soltour V5. Sistema de reservas de pacotes turísticos com busca, cotação e gestão de reservas.

---

## 🚀 **Características Principais**

### ✅ **Sistema de Busca Avançado**
- Busca de pacotes turísticos por destino, origem e datas
- Filtros por preço, classificação e tipo de quarto
- Ordenação por menor/maior preço
- Paginação otimizada com cache

### ✅ **Cards de Pacotes Enriquecidos**
- **Slider de imagens** com múltiplas fotos do hotel
- **Descrição expansível** com "ler mais/ver menos"
- **Preço por pessoa** e preço total detalhados
- **Informações de voo** com logo da companhia aérea
- **Classificação por estrelas** e localização
- **Regime de refeição** e número de noites

### ✅ **Página de Cotação**
- Cotação detalhada do pacote selecionado
- Formulário de dados do titular
- Gestão de passageiros (adultos e crianças)
- Serviços opcionais (seguros, transfers, golf)
- Validações em tempo real

### ✅ **Fluxo Completo de Reserva**
- **Buscar** → **Selecionar** → **Cotar** → **Reservar**
- Validação de disponibilidade (CheckAllowedSelling)
- Sistema de tokens de sessão
- Armazenamento seguro em sessionStorage

---

## 📦 **Instalação**

### **Requisitos**
- WordPress 5.8 ou superior
- PHP 7.4 ou superior
- MySQL 5.7 ou superior
- Credenciais da API Soltour V5

### **Passos**

1. **Upload do Plugin**
   ```bash
   cd wp-content/plugins/
   git clone [repositório] soltour-booking-v4
   ```

2. **Configurar Credenciais no wp-config.php**
   ```php
   // Soltour API Credentials
   define('SOLTOUR_USERNAME', 'SEU_USERNAME');
   define('SOLTOUR_PASSWORD', 'SUA_PASSWORD');
   define('SOLTOUR_CLIENT_ID', 'SEU_CLIENT_ID');
   define('SOLTOUR_CLIENT_SECRET', 'SEU_CLIENT_SECRET');
   define('SOLTOUR_BRAND', 'SOLTOUR'); // Opcional
   define('SOLTOUR_MARKET', 'XMLPT'); // Opcional
   define('SOLTOUR_LANG', 'PT'); // Opcional
   ```

3. **Ativar o Plugin**
   - Acesse: WordPress Admin → Plugins → Ativar "Soltour Booking V4"

4. **Criar Páginas com Shortcodes**
   - Página de Busca: `[soltour_search]`
   - Página de Resultados: `[soltour_results]`
   - Página de Cotação: `[soltour_quote]`
   - Página de Checkout: `[soltour_checkout]`
   - Página de Confirmação: `[soltour_booking_confirmation]`

---

## 🎯 **Shortcodes Disponíveis**

| Shortcode | Descrição | Página |
|-----------|-----------|--------|
| `[soltour_search]` | Formulário de busca de pacotes | Início |
| `[soltour_results]` | Lista de pacotes encontrados | Resultados |
| `[soltour_quote]` | Página de cotação detalhada | Cotação |
| `[soltour_checkout]` | Formulário de checkout | Checkout |
| `[soltour_booking_confirmation]` | Confirmação da reserva | Confirmação |

### **Exemplo de Uso**
```php
// Página de Busca
[soltour_search]

// Página de Resultados com filtros
[soltour_results per_page="10" show_filters="yes"]

// Página de Cotação
[soltour_quote title="Cotação do Seu Pacote"]
```

---

## 🏗️ **Arquitetura do Plugin**

```
soltour-booking-v4-COMPLETO/
├── assets/
│   ├── css/
│   │   ├── soltour-style.css          # Estilos principais
│   │   ├── results-improvements.css   # Melhorias nos resultados
│   │   ├── quote-page.css             # Estilos da cotação
│   │   ├── simple-search.css          # Busca simplificada
│   │   └── modal-search.css           # Modal de busca
│   ├── js/
│   │   ├── soltour-booking.js         # JavaScript principal
│   │   ├── quote-page.js              # Lógica da cotação
│   │   └── modules/                   # Módulos especializados
│   │       ├── delayed-availability.js
│   │       ├── toast-notifications.js
│   │       ├── quote-form.js
│   │       ├── optional-services.js
│   │       └── ...
│   └── images/
│       └── branding/
│           └── beauty-travel-logo.webp
├── includes/
│   ├── class-soltour-api.php          # Handler da API
│   └── class-soltour-shortcodes.php   # Definição dos shortcodes
├── soltour-booking.php                # Arquivo principal
├── README.md                          # Este arquivo
└── CHANGELOG.md                       # Histórico de versões
```

---

## 🔧 **Funcionalidades Técnicas**

### **API Integration**
- **Endpoint principal:** `/soltour/v5/booking/availability`
- **21 AJAX actions** registradas
- **OAuth 2.0** authentication
- **Session tokens** com cache
- **Retry logic** com exponential backoff

### **Performance**
- Cache de destinos e origens
- Paginação server-side
- Lazy loading de imagens
- Debounce em validações
- Minificação de assets

### **JavaScript Modules**
1. **delayed-availability.js** - Disponibilidade assíncrona
2. **toast-notifications.js** - Notificações em tempo real
3. **delayed-quote.js** - Cotação com preços finais
4. **quote-form.js** - Formulário de cotação
5. **optional-services.js** - Seguros, transfers, golf
6. **quote-validations.js** - Validações (idade, email, expediente)
7. **breakdown.js** - Desglose bruto/líquido
8. **navigation.js** - Navegação com cache
9. **copy-holder.js** - Copiar titular para passageiro
10. **simple-search.js** - Busca simplificada
11. **modal-search.js** - Modal de busca detalhada

---

## 📸 **Screenshots**

### **Cards de Pacotes**
- ✅ Slider de imagens (até 10 fotos)
- ✅ Logo da companhia aérea
- ✅ Descrição com "ler mais"
- ✅ Preço por pessoa + total
- ✅ Estrelas e localização

### **Página de Cotação**
- ✅ Detalhes completos do pacote
- ✅ Formulário do titular
- ✅ Gestão de passageiros
- ✅ Serviços opcionais
- ✅ Validações em tempo real

---

## 🔐 **Segurança**

- ✅ Nonces em todas as requisições AJAX
- ✅ Sanitização de inputs
- ✅ Escape de outputs
- ✅ Verificação de permissões
- ✅ Proteção contra CSRF
- ✅ Validação server-side

---

## 🌍 **Internacionalização**

- **Text Domain:** `soltour-booking`
- **Idioma padrão:** Português (PT)
- **POT file:** Pronto para tradução
- **Suporte:** `__()`, `_e()`, `_n()`

---

## 🐛 **Debug & Logs**

### **Ativar Debug**
```php
// wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

### **Logs da API**
```php
// Logs em: wp-content/debug.log
[Soltour] Token gerado: abc123...
[Soltour] Busca executada: destino=PUJ, origem=LIS
[Soltour] 15 pacotes encontrados
```

---

## 📝 **Changelog**

Veja [CHANGELOG.md](CHANGELOG.md) para o histórico completo de versões.

### **v4.1.0 (2025-01-13)**
- ✅ Slider de imagens nos cards
- ✅ Descrição expansível com "ler mais"
- ✅ Logo da companhia aérea nos voos
- ✅ Preço por pessoa + preço total
- ✅ Remoção do fluxo de detalhes do pacote
- ✅ Redirecionamento direto para cotação

---

## 🤝 **Suporte**

- **Email:** suporte@beautytravel.pt
- **Website:** https://beautytravel.pt
- **Documentação:** [Ver docs completos](./docs/)

---

## 📄 **Licença**

Este plugin é licenciado sob **GPL v2 or later**.

```
Copyright (C) 2025 Beauty Travel

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.
```

---

## 👨‍💻 **Desenvolvido por**

**Beauty Travel** - Agência de Viagens Especializada
Website: https://beautytravel.pt
API: Soltour V5 by Grupo Piñero

---

## 🙏 **Agradecimentos**

- Grupo Piñero pela API Soltour V5
- Comunidade WordPress
- Equipe Beauty Travel

---

**Última atualização:** 13 de Janeiro de 2025
**Versão:** 4.1.0
