<?php
/**
 * Soltour Shortcodes
 * Renderiza formulários de busca, resultados, checkout e confirmação
 */

if (!defined('ABSPATH')) exit;

class Soltour_Shortcodes {

    /**
     * Shortcode: [soltour_search]
     * Formulário de busca COMPLETO (direto para resultados)
     */
    public function search_form($atts) {
        $atts = shortcode_atts(array(
            'default_nights' => 7,
            'default_adults' => 2,
            'default_children' => 0
        ), $atts);

        ob_start();
        ?>
        <div class="soltour-search-wrapper">
            <div class="soltour-search-container">
                <div class="soltour-search-header">
                    <h2><?php _e('Encontre seu Pacote de Viagem', 'soltour-booking'); ?></h2>
                    <p><?php _e('Preencha os campos abaixo para buscar as melhores ofertas', 'soltour-booking'); ?></p>
                </div>

                <form id="soltour-search-form" class="soltour-search-form">

                    <div class="soltour-form-grid">
                        <div class="soltour-form-group">
                            <label for="soltour-destination">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                <?php _e('Destino', 'soltour-booking'); ?>
                            </label>
                            <select id="soltour-destination" name="destination" required>
                                <option value=""><?php _e('Selecione um destino', 'soltour-booking'); ?></option>
                            </select>
                        </div>

                        <div class="soltour-form-group">
                            <label for="soltour-origin">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"></path>
                                </svg>
                                <?php _e('Origem', 'soltour-booking'); ?>
                            </label>
                            <select id="soltour-origin" name="origin" required>
                                <option value=""><?php _e('Selecione a origem', 'soltour-booking'); ?></option>
                            </select>
                        </div>

                        <div class="soltour-form-group">
                            <label for="soltour-start-date">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                <?php _e('Data de Partida', 'soltour-booking'); ?>
                            </label>
                            <input type="date" id="soltour-start-date" name="start_date" required
                                   min="<?php echo date('Y-m-d'); ?>" />
                        </div>

                        <div class="soltour-form-group">
                            <label for="soltour-nights">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                </svg>
                                <?php _e('Noites', 'soltour-booking'); ?>
                            </label>
                            <select id="soltour-nights" name="nights">
                                <?php for ($i = 3; $i <= 21; $i++): ?>
                                    <option value="<?php echo $i; ?>" <?php selected($i, $atts['default_nights']); ?>>
                                        <?php echo $i; ?> <?php _e('noites', 'soltour-booking'); ?>
                                    </option>
                                <?php endfor; ?>
                            </select>
                        </div>

                        <div class="soltour-form-group">
                            <label for="soltour-num-rooms">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                </svg>
                                <?php _e('Quartos', 'soltour-booking'); ?>
                            </label>
                            <select id="soltour-num-rooms" name="num_rooms">
                                <?php for ($i = 1; $i <= 4; $i++): ?>
                                    <option value="<?php echo $i; ?>">
                                        <?php echo $i; ?> <?php echo $i == 1 ? 'quarto' : 'quartos'; ?>
                                    </option>
                                <?php endfor; ?>
                            </select>
                        </div>
                    </div>

                    <div id="soltour-rooms-config" class="soltour-rooms-config"></div>

                    <div class="soltour-form-actions">
                        <button type="submit" class="soltour-btn soltour-btn-search">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <?php _e('Pesquisar Pacotes', 'soltour-booking'); ?>
                        </button>
                    </div>

                    <div id="soltour-search-loading" class="soltour-loading" style="display:none;">
                        <span class="spinner"></span>
                        <span><?php _e('A procurar os melhores pacotes...', 'soltour-booking'); ?></span>
                    </div>
                </form>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Shortcode: [soltour_results]
     * Lista de pacotes encontrados
     */
    public function results_page($atts) {
        $atts = shortcode_atts(array(
            'per_page' => 10,
            'show_filters' => 'yes'
        ), $atts);

        ob_start();
        ?>
        <div class="soltour-results-wrapper">
            
            <?php if ($atts['show_filters'] === 'yes'): ?>
            <div class="soltour-filters-sidebar">
                <h3><?php _e('Filtros', 'soltour-booking'); ?></h3>
                
                <div class="soltour-filter-group">
                    <label><?php _e('Ordenar por', 'soltour-booking'); ?></label>
                    <select id="soltour-sort-by">
                        <option value="price-asc"><?php _e('Menor Preço', 'soltour-booking'); ?></option>
                        <option value="price-desc"><?php _e('Maior Preço', 'soltour-booking'); ?></option>
                        <option value="stars-desc"><?php _e('Classificação', 'soltour-booking'); ?></option>
                    </select>
                </div>

                <div class="soltour-filter-group">
                    <label><?php _e('Preço Máximo', 'soltour-booking'); ?></label>
                    <input type="range" id="soltour-max-price" min="0" max="10000" step="100" />
                    <span id="soltour-max-price-value">€ 10.000</span>
                </div>

                <div class="soltour-filter-group">
                    <label><?php _e('Classificação', 'soltour-booking'); ?></label>
                    <div class="soltour-star-filter">
                        <label><input type="checkbox" value="5" /> ⭐⭐⭐⭐⭐</label>
                        <label><input type="checkbox" value="4" /> ⭐⭐⭐⭐</label>
                        <label><input type="checkbox" value="3" /> ⭐⭐⭐</label>
                    </div>
                </div>

                <div class="soltour-filter-group">
                    <label><?php _e('Regime Alimentar', 'soltour-booking'); ?></label>
                    <div class="soltour-meal-plan-filter">
                        <label><input type="checkbox" value="TI" /> Tudo Incluído</label>
                        <label><input type="checkbox" value="PC" /> Pensão Completa</label>
                        <label><input type="checkbox" value="MP" /> Meia Pensão</label>
                        <label><input type="checkbox" value="PA" /> Pequeno-almoço</label>
                        <label><input type="checkbox" value="SA" /> Só Alojamento</label>
                        <label><input type="checkbox" value="RO" /> Room Only</label>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <div class="soltour-results-main">
                <div class="soltour-results-header">
                    <h2><?php _e('Pacotes Disponíveis', 'soltour-booking'); ?></h2>
                    <span id="soltour-results-count"></span>
                </div>

                <div id="soltour-results-list" class="soltour-packages-grid">
                    <!-- Packages will be loaded here via AJAX -->
                </div>

                <div id="soltour-results-loading" class="soltour-loading" style="display:none;">
                    <span class="spinner"></span>
                    <?php _e('A carregar pacotes...', 'soltour-booking'); ?>
                </div>

                <div class="soltour-pagination" id="soltour-pagination"></div>
            </div>
        </div>

        <!-- Modal de Carregamento Moderno -->
        <div class="soltour-loading-modal-overlay" id="soltour-loading-modal">
            <div class="soltour-loading-modal">
                <!-- Logo Beauty Travel -->
                <img src="<?php echo SOLTOUR_PLUGIN_URL; ?>assets/images/branding/beauty-travel-logo.webp"
                     alt="Beauty Travel"
                     class="loading-logo" />

                <!-- Animação Lottie -->
                <lottie-player
                    class="loading-animation"
                    src="<?php echo SOLTOUR_PLUGIN_URL; ?>assets/images/loading-animation.json"
                    background="transparent"
                    speed="1"
                    loop
                    autoplay>
                </lottie-player>

                <!-- Título (será preenchido dinamicamente) -->
                <h2 class="loading-title" id="loading-modal-title">
                    <?php _e('Buscando pacotes...', 'soltour-booking'); ?>
                </h2>

                <!-- Mensagem -->
                <p class="loading-message" id="loading-modal-message">
                    <?php _e('Encontraremos os melhores resultados para sua busca', 'soltour-booking'); ?>
                </p>

                <!-- Barra de Progresso -->
                <div class="progress-container">
                    <div class="progress-bar"></div>
                </div>

                <!-- Mensagem de tempo de espera -->
                <p class="loading-time-info" style="display: none; color: #6b7280; font-size: 14px; margin-top: 20px; margin-bottom: 0;">
                    <?php _e('O processo pode demorar entre 30 e 45 segundos, aguarde', 'soltour-booking'); ?>
                </p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Shortcode: [soltour_quote]
     * Página de cotação - Nova funcionalidade seguindo fluxo oficial Soltour
     */
    public function quote_page($atts) {
        $atts = shortcode_atts(array(
            'title' => __('Cotação do Seu Pacote', 'soltour-booking')
        ), $atts);

        ob_start();
        ?>
        <div class="bt-quote-page" id="soltour-quote-page">
            <!-- Conteúdo será carregado via JavaScript (quote-page.js) -->
            <div class="bt-quote-loading">
                <div class="spinner"></div>
                <h3><?php _e('Carregando detalhes...', 'soltour-booking'); ?></h3>
                <p><?php _e('Aguarde enquanto buscamos as informações do seu pacote', 'soltour-booking'); ?></p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Shortcode: [soltour_checkout]
     * Página de checkout
     */
    public function checkout_page($atts) {
        ob_start();
        ?>
        <div class="soltour-checkout-wrapper">
            <h2><?php _e('Finalizar Reserva', 'soltour-booking'); ?></h2>

            <div class="soltour-checkout-content">
                <div class="soltour-checkout-main">
                    
                    <form id="soltour-checkout-form">
                        
                        <section class="soltour-section">
                            <h3><?php _e('Titular da Reserva', 'soltour-booking'); ?></h3>
                            <div class="soltour-form-row">
                                <div class="soltour-form-group">
                                    <label><?php _e('Nome', 'soltour-booking'); ?> *</label>
                                    <input type="text" name="holder_first_name" required minlength="2" />
                                </div>
                                <div class="soltour-form-group">
                                    <label><?php _e('Apelido 1', 'soltour-booking'); ?> *</label>
                                    <input type="text" name="holder_last_name1" required minlength="2" />
                                </div>
                            </div>
                            <div class="soltour-form-row">
                                <div class="soltour-form-group">
                                    <label><?php _e('Apelido 2', 'soltour-booking'); ?></label>
                                    <input type="text" name="holder_last_name2" minlength="2" />
                                </div>
                                <div class="soltour-form-group">
                                    <label><?php _e('Email', 'soltour-booking'); ?> *</label>
                                    <input type="email" name="holder_email" required />
                                </div>
                            </div>
                            <div class="soltour-form-row">
                                <div class="soltour-form-group">
                                    <label><?php _e('Telefone', 'soltour-booking'); ?> *</label>
                                    <input type="tel" name="holder_phone" required placeholder="+351..." />
                                </div>
                            </div>
                        </section>

                        <section class="soltour-section">
                            <h3><?php _e('Passageiros', 'soltour-booking'); ?></h3>
                            <div id="soltour-passengers-list">
                                <!-- Dynamic passenger forms -->
                            </div>
                        </section>

                        <section class="soltour-section">
                            <h3><?php _e('Observações', 'soltour-booking'); ?></h3>
                            <textarea name="observations" rows="4" placeholder="<?php _e('Alguma observação ou pedido especial?', 'soltour-booking'); ?>"></textarea>
                        </section>

                        <div class="soltour-terms">
                            <label>
                                <input type="checkbox" name="accept_terms" required />
                                <?php _e('Aceito os termos e condições', 'soltour-booking'); ?> *
                            </label>
                        </div>

                        <button type="submit" class="soltour-btn soltour-btn-primary soltour-btn-large" style="padding: 20px 35px !important; border-radius: 100px !important; background: #019CB8 !important; color: #fff !important; border: none !important; font-size: 18px !important; width: 100% !important;">
                            <?php _e('Confirmar Reserva', 'soltour-booking'); ?>
                        </button>

                        <div id="soltour-checkout-loading" class="soltour-loading" style="display:none;">
                            <span class="spinner"></span>
                            <?php _e('A processar reserva...', 'soltour-booking'); ?>
                        </div>
                    </form>
                </div>

                <div class="soltour-checkout-sidebar">
                    <div class="soltour-booking-summary" id="soltour-booking-summary">
                        <h3><?php _e('Resumo da Reserva', 'soltour-booking'); ?></h3>
                        <!-- Summary loaded via JS -->
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Shortcode: [soltour_booking_confirmation]
     * Página de confirmação da reserva
     */
    public function confirmation_page($atts) {
        ob_start();
        ?>
        <div class="soltour-confirmation-wrapper">
            <div id="soltour-confirmation-content">
                <div class="soltour-loading">
                    <span class="spinner"></span>
                    <?php _e('A carregar confirmação...', 'soltour-booking'); ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
