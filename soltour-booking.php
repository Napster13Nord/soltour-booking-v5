<?php
/**
 * Plugin Name: Soltour Booking
 * Plugin URI: https://wpexperts.pt
 * Description: Integração completa com API Soltour V5 para reservas de pacotes turísticos
 * Version: 5.0.0
 * Author: WPexperts.pt
 * License: GPL v2 or later
 * Text Domain: soltour-booking
 */

if (!defined('ABSPATH')) exit;

// Definições de constantes
define('SOLTOUR_VERSION', '5.0.0');
define('SOLTOUR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SOLTOUR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Configurações da API - carregadas do wp-config.php
if (!defined('SOLTOUR_API_BASE_URL')) {
    define('SOLTOUR_API_BASE_URL', defined('SOLTOUR_API_BASE_URL') ? constant('SOLTOUR_API_BASE_URL') : 'https://soltour-svcext.grupo-pinero.com/soltour/v5/');
}
if (!defined('SOLTOUR_API_USERNAME')) {
    define('SOLTOUR_API_USERNAME', defined('SOLTOUR_USERNAME') ? constant('SOLTOUR_USERNAME') : 'BEAUTYT999');
}
if (!defined('SOLTOUR_API_PASSWORD')) {
    define('SOLTOUR_API_PASSWORD', defined('SOLTOUR_PASSWORD') ? constant('SOLTOUR_PASSWORD') : 'XMLBEAUTYT999');
}
if (!defined('SOLTOUR_API_CLIENT_ID')) {
    define('SOLTOUR_API_CLIENT_ID', defined('SOLTOUR_CLIENT_ID') ? constant('SOLTOUR_CLIENT_ID') : '1e94b2d9124841b5a5be6fc3e45cf62f');
}
if (!defined('SOLTOUR_API_CLIENT_SECRET')) {
    define('SOLTOUR_API_CLIENT_SECRET', defined('SOLTOUR_CLIENT_SECRET') ? constant('SOLTOUR_CLIENT_SECRET') : 'e653a17e53094393aeF53da7102de2D1');
}
if (!defined('SOLTOUR_API_BRAND')) {
    define('SOLTOUR_API_BRAND', defined('SOLTOUR_BRAND') ? constant('SOLTOUR_BRAND') : 'SOLTOUR');
}
if (!defined('SOLTOUR_API_MARKET')) {
    define('SOLTOUR_API_MARKET', defined('SOLTOUR_MARKET') ? constant('SOLTOUR_MARKET') : 'XMLPT');
}
if (!defined('SOLTOUR_API_LANG')) {
    define('SOLTOUR_API_LANG', defined('SOLTOUR_LANG') ? constant('SOLTOUR_LANG') : 'PT');
}

// Configurações de Email
if (!defined('SOLTOUR_EMAIL_FROM')) {
    define('SOLTOUR_EMAIL_FROM', 'geral@beautytravel.pt');
}
if (!defined('SOLTOUR_EMAIL_FROM_NAME')) {
    define('SOLTOUR_EMAIL_FROM_NAME', 'Beauty Travel');
}
if (!defined('SOLTOUR_EMAIL_REPLY_TO')) {
    define('SOLTOUR_EMAIL_REPLY_TO', 'reservas@beautytravel.pt');
}

// Email de destino da agência
// Emails de produção: reservas@beautytravel.pt (agência) + andre@wpexperts.pt (acompanhamento)
if (!defined('SOLTOUR_AGENCY_EMAIL')) {
    define('SOLTOUR_AGENCY_EMAIL', 'reservas@beautytravel.pt,andre@wpexperts.pt');
}

// Modo de Teste - Desativado
if (!defined('SOLTOUR_TEST_MODE')) {
    define('SOLTOUR_TEST_MODE', false);
}
if (!defined('SOLTOUR_TEST_EMAIL')) {
    define('SOLTOUR_TEST_EMAIL', 'andre@wpexperts.pt');
}

/**
 * Classe principal do plugin
 */
class Soltour_Booking {

    private static $instance = null;
    private $api_handler;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    private function load_dependencies() {
        require_once SOLTOUR_PLUGIN_DIR . 'includes/class-soltour-api.php';
        require_once SOLTOUR_PLUGIN_DIR . 'includes/class-soltour-shortcodes.php';
        require_once SOLTOUR_PLUGIN_DIR . 'includes/class-soltour-admin.php';

        $this->api_handler = new Soltour_API();

        // Inicializar área administrativa
        if (is_admin()) {
            $admin = Soltour_Admin::get_instance();
            $admin->set_api_handler($this->api_handler);
        }
    }

    private function init_hooks() {
        // Enqueue scripts e styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));

        // Registrar shortcodes
        add_action('init', array($this, 'register_shortcodes'));

        // AJAX endpoints para usuários logados e não logados
        $ajax_actions = array(
            'soltour_get_destinations',
            'soltour_get_origins',
            'soltour_get_calendar_months',
            'soltour_get_price_calendar',
            'soltour_search_packages',
            'soltour_paginate_packages',
            'soltour_get_package_details',
            'soltour_get_alternatives',
            'soltour_check_allowed_selling', // Verificar se venda está permitida
            'soltour_quote_package',
            'soltour_prepare_quote', // NOVO - Validar pacote com fetchAvailability e gerar quote
            'soltour_generate_quote', // NOVO - Gerar cotação final na página de cotação
            'soltour_delayed_quote', // NOVO Sprint 1 - Delayed quote com preços finais
            'soltour_update_optional_service', // NOVO Sprint 1 - Adicionar/remover serviços opcionais
            'soltour_validate_expedient', // NOVO Sprint 1 - Validar expediente em tempo real
            'soltour_validate_passengers', // NOVO Sprint 1 - Validar nomes duplicados
            'soltour_print_quote', // NOVO Sprint 2 - Imprimir cotação
            'soltour_send_quote_email', // NOVO Sprint 2 - Enviar cotação por email
            'soltour_generate_expedient',
            'soltour_book_package',
            'soltour_get_booking_details',
            'soltour_cancel_booking'
        );

        foreach ($ajax_actions as $action) {
            add_action('wp_ajax_' . $action, array($this->api_handler, 'ajax_' . str_replace('soltour_', '', $action)));
            add_action('wp_ajax_nopriv_' . $action, array($this->api_handler, 'ajax_' . str_replace('soltour_', '', $action)));
        }

        // Admin notices
        add_action('admin_notices', array($this, 'check_credentials_notice'));
    }

    public function enqueue_assets() {
        // CSS
        wp_enqueue_style(
            'soltour-booking-style',
            SOLTOUR_PLUGIN_URL . 'assets/css/soltour-style.css',
            array(),
            SOLTOUR_VERSION
        );

        // CSS - Formulário de Busca Moderno
        wp_enqueue_style(
            'soltour-search-form',
            SOLTOUR_PLUGIN_URL . 'assets/css/search-form.css',
            array('soltour-booking-style'),
            SOLTOUR_VERSION
        );

        // CSS - Melhorias na página de resultados
        wp_enqueue_style(
            'soltour-results-improvements',
            SOLTOUR_PLUGIN_URL . 'assets/css/results-improvements.css',
            array('soltour-booking-style'),
            SOLTOUR_VERSION
        );

        // Lottie Player (CDN)
        wp_enqueue_script(
            'lottie-player',
            'https://unpkg.com/@lottiefiles/lottie-player@2.0.2/dist/lottie-player.js',
            array(),
            '2.0.2',
            true
        );

        // JavaScript principal
        wp_enqueue_script(
            'soltour-booking-script',
            SOLTOUR_PLUGIN_URL . 'assets/js/soltour-booking.js',
            array('jquery', 'lottie-player'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo DelayedAvailability
        wp_enqueue_script(
            'soltour-delayed-availability',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/delayed-availability.js',
            array('jquery', 'soltour-booking-script'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Toast Notifications
        wp_enqueue_script(
            'soltour-toast-notifications',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/toast-notifications.js',
            array('jquery', 'soltour-booking-script'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo DelayedQuote
        wp_enqueue_script(
            'soltour-delayed-quote',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/delayed-quote.js',
            array('jquery', 'soltour-booking-script', 'soltour-toast-notifications'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Quote Form (com CheckAllowedSelling no submit)
        wp_enqueue_script(
            'soltour-quote-form',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/quote-form.js',
            array('jquery', 'soltour-booking-script', 'soltour-toast-notifications'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Optional Services (seguros, transfers, golf, equipagem)
        wp_enqueue_script(
            'soltour-optional-services',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/optional-services.js',
            array('jquery', 'soltour-booking-script', 'soltour-toast-notifications'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Quote Validations (idade, email, expediente, nomes duplicados)
        wp_enqueue_script(
            'soltour-quote-validations',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/quote-validations.js',
            array('jquery', 'soltour-booking-script', 'soltour-toast-notifications'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Breakdown (desglose dinâmico bruto/líquido)
        wp_enqueue_script(
            'soltour-breakdown',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/breakdown.js',
            array('jquery', 'soltour-booking-script', 'soltour-toast-notifications'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Navigation (go back com cache)
        wp_enqueue_script(
            'soltour-navigation',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/navigation.js',
            array('jquery', 'soltour-booking-script', 'soltour-toast-notifications'),
            SOLTOUR_VERSION,
            true
        );

        // Módulo Copy Holder (copiar titular → primeiro passageiro)
        wp_enqueue_script(
            'soltour-copy-holder',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/copy-holder.js',
            array('jquery', 'soltour-booking-script'),
            SOLTOUR_VERSION,
            true
        );

        // Formulário de Busca Simplificado (novo fluxo oficial - Passo 1)
        wp_enqueue_style(
            'beauty-travel-simple-search',
            SOLTOUR_PLUGIN_URL . 'assets/css/simple-search.css',
            array(),
            SOLTOUR_VERSION
        );

        wp_enqueue_script(
            'beauty-travel-simple-search',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/simple-search.js',
            array('jquery', 'soltour-booking-script'),
            SOLTOUR_VERSION,
            true
        );

        // Modal de Busca Detalhada (novo fluxo oficial - Passo 2)
        wp_enqueue_style(
            'beauty-travel-modal-search',
            SOLTOUR_PLUGIN_URL . 'assets/css/modal-search.css',
            array(),
            SOLTOUR_VERSION
        );

        wp_enqueue_script(
            'beauty-travel-modal-search',
            SOLTOUR_PLUGIN_URL . 'assets/js/modules/modal-search.js',
            array('jquery', 'soltour-booking-script'),
            SOLTOUR_VERSION,
            true
        );

        // Quote Page (Cotação) - Nova funcionalidade
        wp_enqueue_style(
            'beauty-travel-quote-page',
            SOLTOUR_PLUGIN_URL . 'assets/css/quote-page.css',
            array(),
            SOLTOUR_VERSION
        );

        wp_enqueue_script(
            'beauty-travel-quote-page',
            SOLTOUR_PLUGIN_URL . 'assets/js/quote-page.js',
            array('jquery', 'soltour-booking-script'),
            SOLTOUR_VERSION,
            true
        );

        // Localize script
        wp_localize_script('soltour-booking-script', 'soltourData', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('soltour_booking_nonce'),
            'lang' => SOLTOUR_API_LANG,
            'currency' => 'EUR',
            'pluginUrl' => SOLTOUR_PLUGIN_URL,
            'strings' => array(
                'loading' => __('A carregar...', 'soltour-booking'),
                'error' => __('Ocorreu um erro. Por favor, tente novamente.', 'soltour-booking'),
                'noResults' => __('Nenhum pacote encontrado.', 'soltour-booking'),
                'selectDates' => __('Selecione as datas', 'soltour-booking'),
                'adults' => __('Adultos', 'soltour-booking'),
                'children' => __('Crianças', 'soltour-booking'),
                'nights' => __('Noites', 'soltour-booking'),
                'loadingMessage' => __('Encontraremos os melhores resultados para sua busca', 'soltour-booking'),
            )
        ));
    }

    public function register_shortcodes() {
        $shortcodes = new Soltour_Shortcodes();
        add_shortcode('soltour_search', array($shortcodes, 'search_form'));
        add_shortcode('soltour_results', array($shortcodes, 'results_page'));
        add_shortcode('soltour_quote', array($shortcodes, 'quote_page')); // Nova página de cotação
        add_shortcode('soltour_checkout', array($shortcodes, 'checkout_page'));
        add_shortcode('soltour_booking_confirmation', array($shortcodes, 'confirmation_page'));
    }

    public function check_credentials_notice() {
        $missing_api_creds = empty(SOLTOUR_API_USERNAME) || empty(SOLTOUR_API_PASSWORD) ||
            empty(SOLTOUR_API_CLIENT_ID) || empty(SOLTOUR_API_CLIENT_SECRET);

        if ($missing_api_creds) {
            ?>
            <div class="notice notice-warning is-dismissible">
                <p><strong>Soltour Booking V4:</strong> Por favor, configure todas as credenciais da API no wp-config.php:</p>
                <ul style="list-style: disc; margin-left: 20px;">
                    <li>SOLTOUR_USERNAME</li>
                    <li>SOLTOUR_PASSWORD</li>
                    <li>SOLTOUR_CLIENT_ID</li>
                    <li>SOLTOUR_CLIENT_SECRET</li>
                    <li>SOLTOUR_BRAND (opcional, default: SOLTOUR)</li>
                    <li>SOLTOUR_MARKET (opcional, default: XMLPT)</li>
                    <li>SOLTOUR_LANG (opcional, default: PT)</li>
                </ul>
            </div>
            <?php
        }
    }
}

/**
 * Inicialização do plugin
 */
function soltour_booking_init() {
    return Soltour_Booking::get_instance();
}
add_action('plugins_loaded', 'soltour_booking_init');

/**
 * Ativação do plugin
 */
register_activation_hook(__FILE__, 'soltour_booking_activate');
function soltour_booking_activate() {
    global $wpdb;

    $charset_collate = $wpdb->get_charset_collate();
    $table_name = $wpdb->prefix . 'soltour_quotes';

    // Criar tabela para armazenar cotações
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        client_name varchar(255) NOT NULL,
        client_email varchar(255) NOT NULL,
        total_price decimal(10,2) NOT NULL,
        quote_data longtext NOT NULL,
        email_sent_to varchar(500) DEFAULT NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY client_email (client_email),
        KEY created_at (created_at)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);

    flush_rewrite_rules();

    // Log de ativação
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('Soltour Booking V4: Plugin ativado com sucesso');
        error_log('Soltour Booking V4: Tabela de cotações criada: ' . $table_name);
    }
}

/**
 * Desativação do plugin
 */
register_deactivation_hook(__FILE__, 'soltour_booking_deactivate');
function soltour_booking_deactivate() {
    // Limpar transients
    delete_transient('soltour_session_token');
    delete_transient('soltour_destinations');
    flush_rewrite_rules();
    
    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('Soltour Booking V2: Plugin desativado');
    }
}
