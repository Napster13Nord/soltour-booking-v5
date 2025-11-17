<?php
/**
 * Soltour API Handler
 * Implementa todos os endpoints da API Soltour V5 conforme documentação
 */

if (!defined('ABSPATH')) exit;

class Soltour_API {

    private $api_base_url;
    private $session_token;
    private $client_id;
    private $client_secret;

    public function __construct() {
        $this->api_base_url = SOLTOUR_API_BASE_URL;
        $this->client_id = SOLTOUR_API_CLIENT_ID;
        $this->client_secret = SOLTOUR_API_CLIENT_SECRET;
        $this->session_token = $this->get_session_token();
    }

    // ========================================
    // 1) AUTENTICAÇÃO
    // ========================================

    /**
     * Obtém ou renova o session token
     */
    private function get_session_token() {
        // Verifica cache
        $cached_token = get_transient('soltour_session_token');
        if ($cached_token) {
            return $cached_token;
        }

        // Login
        $login_data = array(
            'brand' => SOLTOUR_API_BRAND,
            'market' => SOLTOUR_API_MARKET,
            'languageCode' => SOLTOUR_API_LANG,
            'username' => SOLTOUR_API_USERNAME,
            'password' => SOLTOUR_API_PASSWORD
        );

        $response = $this->make_request('login/login', $login_data, false);

        if (isset($response['sessionToken'])) {
            // Cache por 25 minutos
            set_transient('soltour_session_token', $response['sessionToken'], 25 * MINUTE_IN_SECONDS);
            $this->log('Session token obtido com sucesso');
            return $response['sessionToken'];
        }

        $this->log('Erro ao obter session token: ' . json_encode($response), 'error');
        return null;
    }

    // ========================================
    // 2) MASTERS (Catálogos)
    // ========================================

    /**
     * GET /master/getAllDestinations
     */
    public function get_all_destinations() {
        // Cache por 24h
        $cached = get_transient('soltour_all_destinations');
        if ($cached) {
            return $cached;
        }

        $response = $this->make_request('master/getAllDestinations', array(
            'productType' => 'PACKAGE'
        ));

        if (isset($response['destinations'])) {
            set_transient('soltour_all_destinations', $response, 24 * HOUR_IN_SECONDS);
        }

        return $response;
    }

    /**
     * GET /master/getAllOrigins
     */
    public function get_all_origins($destination_code = null) {
        $data = array('productType' => 'PACKAGE');
        
        if ($destination_code) {
            $data['destinationCode'] = $destination_code;
        }

        return $this->make_request('master/getAllOrigins', $data);
    }

    /**
     * GET /master/getAirports
     */
    public function get_airports() {
        $cached = get_transient('soltour_airports');
        if ($cached) {
            return $cached;
        }

        $response = $this->make_request('master/getAirports', array(
            'productType' => 'PACKAGE'
        ));

        if (isset($response['airports'])) {
            set_transient('soltour_airports', $response, 24 * HOUR_IN_SECONDS);
        }

        return $response;
    }

    // ========================================
    // 3) CALENDÁRIOS
    // ========================================

    /**
     * POST /booking/getAvailableCalendarMonths
     */
    public function get_available_calendar_months($origin_code, $destination_code) {
        return $this->make_request('booking/getAvailableCalendarMonths', array(
            'productType' => 'PACKAGE',
            'originCode' => $origin_code,
            'destinationCode' => $destination_code
        ));
    }

    /**
     * POST /booking/getPriceCalendar
     */
    public function get_price_calendar($params) {
        $data = array(
            'productType' => 'PACKAGE',
            'originCode' => $params['originCode'],
            'destinationCode' => $params['destinationCode'],
            'month' => array(
                'month' => intval($params['month']),
                'year' => intval($params['year'])
            ),
            'onlyDirectFlights' => isset($params['onlyDirectFlights']) ? $params['onlyDirectFlights'] : false,
            'immediatePay' => isset($params['immediatePay']) ? $params['immediatePay'] : false,
            'residentDiscount' => isset($params['residentDiscount']) ? $params['residentDiscount'] : 'NONE',
            'numNights' => intval($params['numNights'])
        );

        return $this->make_request('booking/getPriceCalendar', $data);
    }

    // ========================================
    // 4) BUSCA E DISPONIBILIDADE
    // ========================================

    /**
     * POST /booking/availability
     * Retorna budgets e availToken
     */
    public function search_availability($params) {
        $start_date = $params['startDate'];
        $num_nights = intval($params['numNights']);
        $end_date = date('Y-m-d', strtotime($start_date . ' +' . $num_nights . ' days'));

        // Montar estrutura de rooms
        $rooms = array();
        if (isset($params['rooms']) && is_array($params['rooms'])) {
            foreach ($params['rooms'] as $room) {
                $passengers = array();
                foreach ($room['passengers'] as $pax) {
                    $passengers[] = array(
                        'type' => $pax['type'], // ADULT, CHILD, INFANT
                        'age' => intval($pax['age'])
                    );
                }
                $rooms[] = array('passengers' => $passengers);
            }
        }

        // Parâmetros críticos vindos do frontend
        $product_type = isset($params['productType']) ? $params['productType'] : 'PACKAGE';
        $only_hotel = isset($params['onlyHotel']) ? $params['onlyHotel'] : 'N';

        $data = array(
            'productType' => $product_type,
            'onlyHotel' => $only_hotel,
            'criteria' => array(
                'order' => array(
                    'type' => isset($params['orderType']) ? $params['orderType'] : 'PRICE',
                    'direction' => isset($params['orderDirection']) ? $params['orderDirection'] : 'ASC'
                ),
                'pagination' => array(
                    'pageNumber' => isset($params['pageNumber']) ? intval($params['pageNumber']) : 0,
                    'rowsPerPage' => isset($params['rowsPerPage']) ? intval($params['rowsPerPage']) : 100
                )
            ),
            'languageCode' => SOLTOUR_API_LANG,
            'params' => array(
                'startDate' => $start_date,
                'endDate' => $end_date,
                'residentType' => isset($params['residentType']) ? $params['residentType'] : 'NONE',
                'accomodation' => array(
                    'rooms' => $rooms
                ),
                'hotelParams' => array(
                    'destinationCode' => $params['destinationCode'],
                    'includeImmediatePayment' => true
                ),
                'flightParams' => array(
                    'itineraries' => array(
                        array(
                            'origins' => array($params['originCode']),
                            'destinations' => array($params['destinationCode'])
                        )
                    ),
                    'directFlightsOnly' => isset($params['directFlightsOnly']) ? $params['directFlightsOnly'] : false,
                    'includeImmediatePayment' => true
                )
            )
        );

        $this->log('Enviando para API Soltour (booking/availability):');
        $this->log('  - criteria.pagination.pageNumber: ' . $data['criteria']['pagination']['pageNumber']);
        $this->log('  - criteria.pagination.rowsPerPage: ' . $data['criteria']['pagination']['rowsPerPage']);

        return $this->make_request('booking/availability', $data);
    }

    /**
     * POST /booking/availability (PAGINAÇÃO)
     * Busca próxima página usando availToken existente
     * IMPORTANTE: Precisa enviar TODOS os params originais + availToken
     */
    public function paginate_availability($avail_token, $page_number, $rows_per_page, $original_params) {
        // Reconstruir estrutura de rooms dos params originais
        $rooms = array();
        if (isset($original_params['rooms']) && is_array($original_params['rooms'])) {
            foreach ($original_params['rooms'] as $room) {
                $passengers = array();
                foreach ($room['passengers'] as $pax) {
                    $passengers[] = array(
                        'type' => $pax['type'],
                        'age' => intval($pax['age'])
                    );
                }
                $rooms[] = array('passengers' => $passengers);
            }
        }

        // Calcular datas
        $start_date = $original_params['startDate'];
        $num_nights = intval($original_params['numNights']);
        $end_date = date('Y-m-d', strtotime($start_date . ' +' . $num_nights . ' days'));

        $data = array(
            'productType' => 'PACKAGE',
            'availToken' => $avail_token,
            'criteria' => array(
                'order' => array(
                    'type' => 'PRICE',
                    'direction' => 'ASC'
                ),
                'pagination' => array(
                    'pageNumber' => intval($page_number),
                    'rowsPerPage' => intval($rows_per_page)
                )
            ),
            'languageCode' => SOLTOUR_API_LANG,
            'params' => array(
                'startDate' => $start_date,
                'endDate' => $end_date,
                'residentType' => isset($original_params['residentType']) ? $original_params['residentType'] : 'NONE',
                'accomodation' => array(
                    'rooms' => $rooms
                ),
                'hotelParams' => array(
                    'destinationCode' => $original_params['destinationCode'],
                    'includeImmediatePayment' => true
                ),
                'flightParams' => array(
                    'itineraries' => array(
                        array(
                            'origins' => array($original_params['originCode']),
                            'destinations' => array($original_params['destinationCode'])
                        )
                    ),
                    'directFlightsOnly' => isset($original_params['directFlightsOnly']) ? $original_params['directFlightsOnly'] : false,
                    'includeImmediatePayment' => true
                )
            )
        );

        $this->log('Paginando com availToken E params completos:');
        $this->log('  - availToken: ' . substr($avail_token, 0, 20) . '...');
        $this->log('  - pageNumber: ' . $page_number);
        $this->log('  - rowsPerPage: ' . $rows_per_page);
        $this->log('  - params incluídos: SIM');

        return $this->make_request('booking/availability', $data);
    }

    /**
     * POST /booking/details
     * Obtém detalhes completos de um budget específico
     */
    public function get_package_details($avail_token, $budget_id, $hotel_code, $provider_code) {
        $data = array(
            'productType' => 'PACKAGE',
            'availToken' => $avail_token,
            'budgetId' => $budget_id,
            'hotelParams' => array(
                'hotelCode' => $hotel_code,
                'providerCode' => $provider_code
            )
        );

        $response = $this->make_request('booking/details', $data);
        
        // A API retorna hotelDetails diretamente no root
        // Normalizar para facilitar o parse no frontend
        if (isset($response['hotelDetails'])) {
            $response['details'] = $response;
        }
        
        return $response;
    }

    /**
     * POST /booking/getAlternatives
     * Obtém voos alternativos para o mesmo budget
     */
    public function get_alternatives($avail_token, $budget_id, $pagination = array()) {
        $data = array(
            'productType' => 'PACKAGE',
            'availToken' => $avail_token,
            'budgetId' => $budget_id,
            'criteria' => array(
                'order' => array(
                    'type' => 'PRICE',
                    'direction' => 'ASC'
                ),
                'pagination' => array(
                    'firstItem' => isset($pagination['firstItem']) ? intval($pagination['firstItem']) : 0,
                    'itemCount' => isset($pagination['itemCount']) ? intval($pagination['itemCount']) : 10
                )
            )
        );

        return $this->make_request('booking/getAlternatives', $data);
    }

    // ========================================
    // 5) CARRINHO E CHECKOUT
    // ========================================

    /**
     * POST /booking/quote
     * Trava os preços e retorna serviços opcionais
     */
    public function quote_package($avail_token, $budget_ids) {
        if (!is_array($budget_ids)) {
            $budget_ids = array($budget_ids);
        }

        $data = array(
            'productType' => 'PACKAGE',
            'availToken' => $avail_token,
            'budgetIds' => $budget_ids
        );

        return $this->make_request('booking/quote', $data);
    }

    /**
     * POST /booking/generateExpedient
     * Gera o expediente necessário para booking
     */
    public function generate_expedient($params) {
        $data = array(
            'destination' => $params['destination'],
            'productType' => 'PACKAGE',
            'availToken' => $params['availToken'],
            'bookingHolder' => array(
                'email' => $params['bookingHolder']['email'],
                'firstName' => $params['bookingHolder']['firstName'],
                'lastName1' => $params['bookingHolder']['lastName1'],
                'lastName2' => isset($params['bookingHolder']['lastName2']) ? $params['bookingHolder']['lastName2'] : ''
            ),
            'startDate' => $params['startDate'],
            'agencyBookingReference' => $params['agencyBookingReference']
        );

        return $this->make_request('booking/generateExpedient', $data);
    }

    /**
     * POST /booking/book
     * Confirma a reserva
     */
    public function book_package($params) {
        // Validar dados obrigatórios
        if (empty($params['availToken']) || empty($params['expedient'])) {
            return array('error' => 'availToken e expedient são obrigatórios');
        }

        $data = array(
            'availToken' => $params['availToken'],
            'productType' => 'PACKAGE',
            'accomodation' => array(
                'rooms' => $params['rooms']
            ),
            'commonBookingData' => array(
                'agencyExpedient' => $params['agencyBookingReference'],
                'agent' => isset($params['agent']) ? $params['agent'] : 'wordpress',
                'email' => $params['email'],
                'expedient' => $params['expedient'],
                'observations' => isset($params['observations']) ? $params['observations'] : 'Reserva via WordPress',
                'phoneNumber' => $params['phoneNumber'],
                'userName' => SOLTOUR_API_USERNAME,
                'channel' => 'WEB'
            )
        );

        return $this->make_request('booking/book', $data);
    }

    /**
     * POST /booking/validateBooking
     * Valida status da reserva
     */
    public function validate_booking($booking_reference) {
        return $this->make_request('booking/validateBooking', array(
            'bookingReference' => $booking_reference
        ));
    }

    // ========================================
    // 6) PÓS-VENDA
    // ========================================

    /**
     * POST /booking/read
     * Lê detalhes de uma reserva
     */
    public function get_booking_details($booking_reference) {
        return $this->make_request('booking/read', array(
            'bookingReference' => $booking_reference
        ));
    }

    /**
     * POST /booking/getExistingReservations
     * Lista reservas em um período
     */
    public function get_existing_reservations($from_date, $to_date) {
        return $this->make_request('booking/getExistingReservations', array(
            'fromDate' => $from_date,
            'toDate' => $to_date
        ));
    }

    /**
     * POST /booking/cancel
     * Cancela uma reserva (ou simula com preCancellation: true)
     */
    public function cancel_booking($booking_reference, $pre_cancellation = true) {
        return $this->make_request('booking/cancel', array(
            'bookingReference' => $booking_reference,
            'preCancellation' => $pre_cancellation
        ));
    }

    // ========================================
    // HELPERS PRIVADOS
    // ========================================

    /**
     * Faz requisição HTTP para API
     */
    private function make_request($endpoint, $data = array(), $use_auth = true) {
        $url = $this->api_base_url . $endpoint;

        $headers = array(
            'Content-Type' => 'application/json',
            'MULESOFT_CLIENT_ID' => $this->client_id,
            'MULESOFT_CLIENT_SECRET' => $this->client_secret
        );

        if ($use_auth && $this->session_token) {
            $headers['Authorization'] = $this->session_token;
        }

        $args = array(
            'headers' => $headers,
            'body' => json_encode($data),
            'method' => 'POST',
            'timeout' => 60,
            'sslverify' => true
        );

        $this->log("Request to {$endpoint}: " . json_encode($data));

        $response = wp_remote_post($url, $args);

        if (is_wp_error($response)) {
            $this->log("Error in {$endpoint}: " . $response->get_error_message(), 'error');
            return array('error' => $response->get_error_message());
        }

        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        $this->log("Response from {$endpoint}: " . substr($body, 0, 500));

        return $decoded;
    }

    /**
     * Flatten destinations recursivamente
     */
    private function flatten_destinations($destinations, $parent_name = '') {
        $flat = array();

        foreach ($destinations as $dest) {
            if (isset($dest['children']) && !empty($dest['children'])) {
                $prefix = $parent_name ? $parent_name . ' - ' : '';
                $flat = array_merge($flat, $this->flatten_destinations($dest['children'], $prefix . $dest['description']));
            } else {
                $display_name = $parent_name ? $parent_name . ' - ' . $dest['description'] : $dest['description'];
                $flat[] = array(
                    'code' => $dest['code'],
                    'name' => $dest['description'],
                    'displayName' => $display_name
                );
            }
        }

        return $flat;
    }

    /**
     * Log helper
     */
    private function log($message, $level = 'info') {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log("[Soltour API {$level}] " . $message);
        }
        // Também enviar para o console do navegador via JavaScript
        if ($level === 'error') {
            // Adicionar ao transient para mostrar no admin
            $errors = get_transient('soltour_errors') ?: [];
            $errors[] = [
                'message' => $message,
                'time' => current_time('mysql')
            ];
            set_transient('soltour_errors', array_slice($errors, -20), HOUR_IN_SECONDS);
        }
    }

    // ========================================
    // AJAX HANDLERS
    // ========================================

    public function ajax_get_destinations() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $response = $this->get_all_destinations();

        if (isset($response['destinations'])) {
            $flat = $this->flatten_destinations($response['destinations']);
            wp_send_json_success($flat);
        } else {
            wp_send_json_error(array('message' => 'Erro ao carregar destinos'));
        }
    }

    public function ajax_get_origins() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $destination_code = isset($_POST['destination_code']) ? sanitize_text_field($_POST['destination_code']) : '';

        $response = $this->get_all_origins($destination_code);

        if (isset($response['origins'])) {
            wp_send_json_success($response['origins']);
        } else {
            wp_send_json_error(array('message' => 'Erro ao carregar origens'));
        }
    }

    public function ajax_get_calendar_months() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $origin = sanitize_text_field($_POST['origin_code']);
        $destination = sanitize_text_field($_POST['destination_code']);

        $response = $this->get_available_calendar_months($origin, $destination);

        if (isset($response['months'])) {
            wp_send_json_success($response['months']);
        } else {
            wp_send_json_error(array('message' => 'Erro ao carregar meses disponíveis'));
        }
    }

    public function ajax_get_price_calendar() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $params = array(
            'originCode' => sanitize_text_field($_POST['origin_code']),
            'destinationCode' => sanitize_text_field($_POST['destination_code']),
            'month' => intval($_POST['month']),
            'year' => intval($_POST['year']),
            'numNights' => intval($_POST['num_nights'])
        );

        $response = $this->get_price_calendar($params);

        if (isset($response['days'])) {
            wp_send_json_success($response);
        } else {
            wp_send_json_error(array('message' => 'Erro ao carregar calendário de preços'));
        }
    }

    public function ajax_search_packages() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== AJAX SEARCH PACKAGES CALLED ===');

        $params = array(
            'originCode' => sanitize_text_field($_POST['origin_code']),
            'destinationCode' => sanitize_text_field($_POST['destination_code']),
            'startDate' => sanitize_text_field($_POST['start_date']),
            'numNights' => intval($_POST['num_nights']),
            'rooms' => json_decode(stripslashes($_POST['rooms']), true),

            // Parâmetros críticos para API processar corretamente
            'productType' => isset($_POST['product_type']) ? sanitize_text_field($_POST['product_type']) : 'PACKAGE',
            'onlyHotel' => isset($_POST['only_hotel']) ? sanitize_text_field($_POST['only_hotel']) : 'N',

            // Paginação (corrigido para pageNumber/rowsPerPage conforme documentação Soltour)
            'pageNumber' => isset($_POST['page_number']) ? intval($_POST['page_number']) : 0,
            'rowsPerPage' => isset($_POST['rows_per_page']) ? intval($_POST['rows_per_page']) : 100
        );

        $this->log('Params recebidos do frontend:');
        $this->log('  - pageNumber: ' . $params['pageNumber']);
        $this->log('  - rowsPerPage: ' . $params['rowsPerPage']);
        $this->log('Params completos: ' . json_encode($params));

        $response = $this->search_availability($params);

        $this->log('Resposta da API Soltour:');
        $this->log('  - budgets: ' . (isset($response['budgets']) ? count($response['budgets']) : 0));
        $this->log('  - totalCount: ' . (isset($response['totalCount']) ? $response['totalCount'] : 0));
        $this->log('  - hotels: ' . (isset($response['hotels']) ? count($response['hotels']) : 0));
        $this->log('  - availToken: ' . (isset($response['availToken']) ? 'SIM' : 'NÃO'));

        if (isset($response['budgets']) || isset($response['availToken'])) {
            wp_send_json_success($response);
        } else {
            $this->log('Search failed: ' . json_encode($response), 'error');
            wp_send_json_error($response);
        }
    }

    public function ajax_paginate_packages() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== AJAX PAGINATE PACKAGES CALLED ===');

        $avail_token = sanitize_text_field($_POST['avail_token']);
        $page_number = isset($_POST['page_number']) ? intval($_POST['page_number']) : 0;
        $rows_per_page = isset($_POST['rows_per_page']) ? intval($_POST['rows_per_page']) : 100;

        // Receber parâmetros originais da busca
        $original_params = array(
            'originCode' => sanitize_text_field($_POST['origin_code']),
            'destinationCode' => sanitize_text_field($_POST['destination_code']),
            'startDate' => sanitize_text_field($_POST['start_date']),
            'numNights' => intval($_POST['num_nights']),
            'rooms' => json_decode(stripslashes($_POST['rooms']), true)
        );

        $this->log('Paginação requisitada:');
        $this->log('  - pageNumber: ' . $page_number);
        $this->log('  - rowsPerPage: ' . $rows_per_page);
        $this->log('  - original_params recebidos: SIM');

        $response = $this->paginate_availability($avail_token, $page_number, $rows_per_page, $original_params);

        $this->log('Resposta da paginação:');
        $this->log('  - budgets: ' . (isset($response['budgets']) ? count($response['budgets']) : 0));
        $this->log('  - totalCount: ' . (isset($response['totalCount']) ? $response['totalCount'] : 0));
        $this->log('  - hotels: ' . (isset($response['hotels']) ? count($response['hotels']) : 0));

        if (isset($response['budgets']) || isset($response['availToken'])) {
            wp_send_json_success($response);
        } else {
            $this->log('Pagination failed: ' . json_encode($response), 'error');
            wp_send_json_error($response);
        }
    }

    public function ajax_get_package_details() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $avail_token = sanitize_text_field($_POST['avail_token']);
        $budget_id = sanitize_text_field($_POST['budget_id']);
        $hotel_code = sanitize_text_field($_POST['hotel_code']);
        $provider_code = sanitize_text_field($_POST['provider_code']);

        $this->log("Getting details for budget: {$budget_id}, hotel: {$hotel_code}");

        $response = $this->get_package_details($avail_token, $budget_id, $hotel_code, $provider_code);

        $this->log('Details response structure: ' . json_encode([
            'has_budget' => isset($response['budget']),
            'has_details' => isset($response['details']),
            'has_error' => isset($response['error']),
            'error_msg' => isset($response['error']) ? $response['error'] : null
        ]));

        // CORREÇÃO: A API pode retornar os dados mesmo sem 'budget' no primeiro nível
        // Os dados podem estar em 'details' diretamente
        if (isset($response['budget']) || isset($response['details'])) {
            // Sempre retornar success com os dados disponíveis
            wp_send_json_success($response);
        } else {
            $this->log('Details failed: ' . json_encode($response), 'error');
            wp_send_json_error(array(
                'message' => 'Erro ao carregar detalhes do pacote', 
                'details' => $response
            ));
        }
    }

    public function ajax_get_alternatives() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $avail_token = sanitize_text_field($_POST['avail_token']);
        $budget_id = sanitize_text_field($_POST['budget_id']);

        $response = $this->get_alternatives($avail_token, $budget_id);

        wp_send_json_success($response);
    }

    /**
     * AJAX: Verificar se venda está permitida
     * Chamado ANTES de permitir quote/booking
     */
    public function ajax_check_allowed_selling() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== CHECK ALLOWED SELLING ===');

        // Endpoint da API Soltour para verificar venda permitida
        $response = $this->make_request('booking/availability/checkAllowedSelling', array(), 'GET');

        $this->log('CheckAllowedSelling response: ' . json_encode($response));

        // Verificar se response indica sucesso
        if ($response && isset($response['allowed'])) {
            wp_send_json_success(array(
                'allowed' => $response['allowed'],
                'message' => isset($response['message']) ? $response['message'] : ''
            ));
        } else {
            // Se não houver resposta clara, assumir permitido (fail-safe)
            // Pode ajustar para fail-secure se preferir
            wp_send_json_success(array(
                'allowed' => true,
                'message' => 'Verificação de venda concluída'
            ));
        }
    }

    public function ajax_quote_package() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $avail_token = sanitize_text_field($_POST['avail_token']);
        $budget_ids = json_decode(stripslashes($_POST['budget_ids']), true);

        $response = $this->quote_package($avail_token, $budget_ids);

        if (isset($response['quote'])) {
            wp_send_json_success($response);
        } else {
            wp_send_json_error($response);
        }
    }

    /**
     * AJAX Handler: Preparar e validar cotação
     * Fluxo: fetchAvailability → validar → quote
     * Chamado quando usuário clica no botão "Selecionar" num card
     */
    public function ajax_prepare_quote() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('╔═══════════════════════════════════════════════════════════════════╗');
        $this->log('║      🎯 SOLTOUR - PREPARE QUOTE - VALIDAÇÃO INTERMEDIÁRIA        ║');
        $this->log('╚═══════════════════════════════════════════════════════════════════╝');

        // Validar e sanitizar inputs
        // IMPORTANTE: Não usar sanitize_text_field() no budgetId pois pode alterar caracteres especiais (##, $, @@)
        $avail_token = isset($_POST['avail_token']) ? sanitize_text_field($_POST['avail_token']) : '';
        $budget_id = isset($_POST['budget_id']) ? trim(wp_unslash($_POST['budget_id'])) : '';
        $hotel_code = isset($_POST['hotel_code']) ? sanitize_text_field($_POST['hotel_code']) : '';
        $provider_code = isset($_POST['provider_code']) ? sanitize_text_field($_POST['provider_code']) : '';

        $this->log('📥 DADOS RECEBIDOS DO FRONTEND:');
        $this->log('  ├─ availToken: ' . ($avail_token ? substr($avail_token, 0, 20) . '...' : 'NÃO FORNECIDO'));
        $this->log('  ├─ budgetId (RAW): ' . ($budget_id ?: 'NÃO FORNECIDO'));
        $this->log('  ├─ budgetId (strlen): ' . strlen($budget_id));
        $this->log('  ├─ hotelCode: ' . ($hotel_code ?: 'NÃO FORNECIDO'));
        $this->log('  └─ providerCode: ' . ($provider_code ?: 'NÃO FORNECIDO'));

        // Validar dados obrigatórios
        if (empty($avail_token) || empty($budget_id)) {
            $this->log('❌ ERRO: Dados obrigatórios ausentes', 'error');
            wp_send_json_error(array(
                'message' => 'Dados incompletos. Por favor, tente novamente.',
                'debug' => array(
                    'availToken' => !empty($avail_token),
                    'budgetId' => !empty($budget_id)
                )
            ));
            return;
        }

        // ========================================
        // FLUXO SIMPLIFICADO: IR DIRETO PARA /booking/quote
        // fetchAvailability estava dando erro interno na API Soltour
        // mesmo quando o budget existia. Conforme doc, quote é suficiente.
        // ========================================
        $this->log('');
        $this->log('🎫 Gerando cotação oficial com /booking/quote...');
        $this->log('  └─ Endpoint: POST /booking/quote');
        $this->log('  └─ budgetIds: [' . $budget_id . ']');

        // Chamar diretamente /booking/quote
        $quote_response = $this->quote_package($avail_token, array($budget_id));

        $this->log('📋 RESPOSTA quote:');
        $this->log('  ├─ budget: ' . (isset($quote_response['budget']) ? 'SIM ✅' : 'NÃO ❌'));
        $this->log('  ├─ quoteToken: ' . (isset($quote_response['quoteToken']) ? substr($quote_response['quoteToken'], 0, 20) . '... ✅' : 'NÃO ❌'));
        $this->log('  ├─ insurances: ' . (isset($quote_response['insurances']) ? count($quote_response['insurances']) : '0'));
        $this->log('  ├─ extras: ' . (isset($quote_response['extras']) ? count($quote_response['extras']) : '0'));
        $this->log('  ├─ importantInformation: ' . (isset($quote_response['importantInformation']) ? count($quote_response['importantInformation']) : '0'));
        $this->log('  ├─ cancellationChargeServices: ' . (isset($quote_response['cancellationChargeServices']) ? count($quote_response['cancellationChargeServices']) : '0'));

        if (isset($quote_response['priceBreakdown'])) {
            $pb = $quote_response['priceBreakdown'];
            $this->log('  └─ priceBreakdown.totalPvp: ' . (isset($pb['totalPvp']) ? $pb['totalPvp'] . ' €' : 'N/A'));
        }

        // ========================================
        // VALIDAÇÃO ROBUSTA DA RESPOSTA DO QUOTE
        // ========================================

        // Verificar se resposta tem estrutura válida
        if (!is_array($quote_response)) {
            $this->log('');
            $this->log('❌ ERRO: Resposta do quote inválida (não é array)');
            $this->log('╚═══════════════════════════════════════════════════════════════════╝');

            wp_send_json_error(array(
                'message' => 'Erro ao gerar cotação. Por favor, tente novamente.',
                'error_type' => 'invalid_response',
                'error_details' => 'Quote response is not an array'
            ));
            return;
        }

        // Verificar se tem result.ok
        if (isset($quote_response['result']) && isset($quote_response['result']['ok']) && $quote_response['result']['ok'] === false) {
            $error_message = isset($quote_response['result']['errorMessage'])
                ? $quote_response['result']['errorMessage']
                : 'Erro desconhecido ao gerar cotação';

            $this->log('');
            $this->log('❌ ERRO: Quote retornou result.ok = false');
            $this->log('  └─ Erro: ' . $error_message);
            $this->log('╚═══════════════════════════════════════════════════════════════════╝');

            wp_send_json_error(array(
                'message' => 'Este pacote não está mais disponível. Por favor, selecione outro.',
                'error_type' => 'quote_failed',
                'error_details' => $error_message
            ));
            return;
        }

        // Verificar se tem budget
        if (!isset($quote_response['budget'])) {
            $this->log('');
            $this->log('❌ ERRO: Quote não retornou budget');
            $this->log('╚═══════════════════════════════════════════════════════════════════╝');

            wp_send_json_error(array(
                'message' => 'Erro ao gerar cotação. Por favor, tente novamente.',
                'error_type' => 'no_budget',
                'debug_response' => array_keys($quote_response)
            ));
            return;
        }

        // ========================================
        // SUCESSO: Retornar dados completos para o frontend
        // ========================================
        $this->log('');
        $this->log('✅ SUCESSO! Cotação gerada com sucesso');
        $this->log('📤 RETORNANDO DADOS PARA FRONTEND:');
        $this->log('  ├─ quote: COMPLETO');
        $this->log('  ├─ quoteToken: GERADO');
        $this->log('  └─ budget: VÁLIDO');
        $this->log('╚═══════════════════════════════════════════════════════════════════╝');

        wp_send_json_success(array(
            'message' => 'Pacote validado com sucesso!',
            'quote' => $quote_response,
            'quoteToken' => isset($quote_response['quoteToken']) ? $quote_response['quoteToken'] : null,
            'debugInfo' => array(
                'availToken' => substr($avail_token, 0, 20) . '...',
                'budgetId' => $budget_id,
                'hotelCode' => $hotel_code,
                'providerCode' => $provider_code,
                'timestamp' => current_time('mysql')
            )
        ));
    }

    /**
     * AJAX Handler: Gerar cotação final na página de cotação
     * Coleta dados, envia emails para agência e cliente
     */
    public function ajax_generate_quote() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== GENERATE FINAL QUOTE ===');

        // Coletar dados do POST - tratando tanto string JSON quanto array
        $budget_data = isset($_POST['budget_data'])
            ? (is_array($_POST['budget_data']) ? $_POST['budget_data'] : json_decode(stripslashes($_POST['budget_data']), true))
            : array();

        $passengers = isset($_POST['passengers'])
            ? (is_array($_POST['passengers']) ? $_POST['passengers'] : json_decode(stripslashes($_POST['passengers']), true))
            : array();

        $client_data = isset($_POST['client_data'])
            ? (is_array($_POST['client_data']) ? $_POST['client_data'] : json_decode(stripslashes($_POST['client_data']), true))
            : array();

        $trip_data = isset($_POST['trip_data'])
            ? (is_array($_POST['trip_data']) ? $_POST['trip_data'] : json_decode(stripslashes($_POST['trip_data']), true))
            : array();

        $notes = isset($_POST['notes']) ? sanitize_textarea_field($_POST['notes']) : '';

        // Log para debug
        $this->log('Dados recebidos (tipos):');
        $this->log('  - budget_data: ' . gettype($budget_data) . ' - ' . (is_array($budget_data) ? 'array com ' . count($budget_data) . ' items' : 'não é array'));
        $this->log('  - passengers: ' . gettype($passengers) . ' - ' . (is_array($passengers) ? 'array com ' . count($passengers) . ' items' : 'não é array'));
        $this->log('  - client_data: ' . gettype($client_data) . ' - ' . (is_array($client_data) ? 'array com ' . count($client_data) . ' items' : 'não é array'));
        $this->log('  - trip_data: ' . gettype($trip_data) . ' - ' . (is_array($trip_data) ? 'array com ' . count($trip_data) . ' items' : 'não é array'));

        // Validar dados básicos
        if (empty($budget_data) || empty($passengers) || empty($client_data)) {
            $this->log('Dados incompletos recebidos', 'error');
            $this->log('  - budget_data vazio: ' . (empty($budget_data) ? 'SIM' : 'NÃO'));
            $this->log('  - passengers vazio: ' . (empty($passengers) ? 'SIM' : 'NÃO'));
            $this->log('  - client_data vazio: ' . (empty($client_data) ? 'SIM' : 'NÃO'));
            wp_send_json_error(array(
                'message' => 'Dados incompletos. Por favor, preencha todos os campos obrigatórios.'
            ));
            return;
        }

        $this->log('Dados recebidos:');
        $this->log('  - Passageiros: ' . count($passengers));
        $this->log('  - Cliente: ' . (isset($client_data['nome']) ? $client_data['nome'] : 'NOME NÃO ENCONTRADO'));
        $this->log('  - Hotel: ' . (isset($trip_data['hotelName']) ? $trip_data['hotelName'] : 'HOTEL NÃO ENCONTRADO'));

        // Extrair dados técnicos da API para a agência
        $avail_token = '';
        $budget_id = '';
        $destination_code = '';

        // Tentar extrair availToken do budget_data
        if (isset($budget_data['availToken'])) {
            $avail_token = $budget_data['availToken'];
        } elseif (isset($budget_data['budget']['availToken'])) {
            $avail_token = $budget_data['budget']['availToken'];
        }

        // Tentar extrair budgetId
        if (isset($budget_data['budgetId'])) {
            $budget_id = $budget_data['budgetId'];
        } elseif (isset($budget_data['budget']['budgetId'])) {
            $budget_id = $budget_data['budget']['budgetId'];
        }

        // Tentar extrair destination code (ex: PUJ, CUN, etc)
        if (isset($budget_data['searchParams']['destination'])) {
            $destination_code = $budget_data['searchParams']['destination'];
        } elseif (isset($budget_data['destination'])) {
            $destination_code = $budget_data['destination'];
        }

        // Preparar dados para emails
        $email_data = array(
            'cliente' => array(
                'nome' => sanitize_text_field($client_data['nome']),
                'sobrenome' => sanitize_text_field($client_data['sobrenome']),
                'sobrenome2' => isset($client_data['sobrenome2']) ? sanitize_text_field($client_data['sobrenome2']) : '',
                'email' => sanitize_email($client_data['email']),
                'telefone' => sanitize_text_field($client_data['telefone'])
            ),
            'viagem' => array(
                'hotelName' => sanitize_text_field($trip_data['hotelName']),
                'destino' => sanitize_text_field($trip_data['destino']),
                'checkin' => sanitize_text_field($trip_data['checkin']),
                'checkout' => sanitize_text_field($trip_data['checkout']),
                'noites' => intval($trip_data['noites']),
                'quartos' => intval($trip_data['quartos']),
                'regime' => sanitize_text_field($trip_data['regime']),
                'precoTotal' => floatval($trip_data['precoTotal']),
                'roomName' => isset($trip_data['roomName']) ? sanitize_text_field($trip_data['roomName']) : 'Quarto'
            ),
            'passageiros' => array(),
            'observacoes' => $notes,
            'linkCotacao' => home_url('/cotacao-confirmada/'),
            'dadosApi' => array(
                'availToken' => $avail_token,
                'budgetId' => $budget_id,
                'destinationCode' => $destination_code,
                'productType' => 'PACKAGE',
                'startDate' => sanitize_text_field($trip_data['checkin'])
            ),
            'budget_data_completo' => $budget_data
        );

        // Sanitizar dados dos passageiros
        foreach ($passengers as $pax) {
            $email_data['passageiros'][] = array(
                'tipo' => sanitize_text_field($pax['tipo']),
                'sexo' => isset($pax['sexo']) ? sanitize_text_field($pax['sexo']) : 'UNDEFINED',
                'nome' => sanitize_text_field($pax['nome']),
                'sobrenome' => sanitize_text_field($pax['sobrenome']),
                'sobrenome2' => isset($pax['sobrenome2']) ? sanitize_text_field($pax['sobrenome2']) : '',
                'nascimento' => sanitize_text_field($pax['nascimento']),
                'documento' => sanitize_text_field($pax['documento'])
            );
        }

        // Gerar ID único para a cotação
        $quote_id = uniqid('BT-', true);

        $this->log('Cotação gerada: ' . $quote_id);

        // Enviar email para a agência
        $this->log('Enviando email para agência...');
        $agency_email_sent = $this->send_agency_notification_email($email_data);

        if ($agency_email_sent) {
            $this->log('Email enviado para agência com sucesso');
        } else {
            $this->log('Erro ao enviar email para agência', 'error');
        }

        // Enviar email para o cliente
        $this->log('Enviando email para cliente...');
        $client_email_sent = $this->send_client_confirmation_email($email_data);

        if ($client_email_sent) {
            $this->log('Email enviado para cliente com sucesso');
        } else {
            $this->log('Erro ao enviar email para cliente', 'error');
        }

        // Verificar se pelo menos um email foi enviado
        if (!$agency_email_sent && !$client_email_sent) {
            $this->log('Nenhum email foi enviado com sucesso', 'error');
            wp_send_json_error(array(
                'message' => 'Erro ao enviar emails. Por favor, tente novamente ou contacte o suporte.'
            ));
            return;
        }

        // Salvar cotação no banco de dados para consulta no admin
        $this->save_quote_to_database($email_data, $quote_id);

        // Retornar sucesso
        $this->log('Cotação finalizada com sucesso: ' . $quote_id);

        wp_send_json_success(array(
            'message' => 'Cotação gerada com sucesso! Verifique seu email.',
            'quote_id' => $quote_id,
            'emails_sent' => array(
                'agency' => $agency_email_sent,
                'client' => $client_email_sent
            ),
            'redirect_url' => home_url('/cotacao-confirmada/')
        ));
    }

    public function ajax_generate_expedient() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $params = array(
            'destination' => sanitize_text_field($_POST['destination']),
            'availToken' => sanitize_text_field($_POST['avail_token']),
            'bookingHolder' => json_decode(stripslashes($_POST['booking_holder']), true),
            'startDate' => sanitize_text_field($_POST['start_date']),
            'agencyBookingReference' => sanitize_text_field($_POST['reference'])
        );

        $response = $this->generate_expedient($params);

        if (isset($response['expedient'])) {
            wp_send_json_success($response);
        } else {
            wp_send_json_error($response);
        }
    }

    public function ajax_book_package() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $params = array(
            'availToken' => sanitize_text_field($_POST['avail_token']),
            'expedient' => sanitize_text_field($_POST['expedient']),
            'rooms' => json_decode(stripslashes($_POST['rooms']), true),
            'email' => sanitize_email($_POST['email']),
            'phoneNumber' => sanitize_text_field($_POST['phone']),
            'agencyBookingReference' => sanitize_text_field($_POST['reference'])
        );

        $response = $this->book_package($params);

        if (isset($response['booking'])) {
            wp_send_json_success($response);
        } else {
            wp_send_json_error($response);
        }
    }

    public function ajax_get_booking_details() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $booking_reference = sanitize_text_field($_POST['booking_reference']);

        $response = $this->get_booking_details($booking_reference);

        if (isset($response['booking'])) {
            wp_send_json_success($response);
        } else {
            wp_send_json_error($response);
        }
    }

    public function ajax_cancel_booking() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $booking_reference = sanitize_text_field($_POST['booking_reference']);
        $pre_cancel = isset($_POST['pre_cancellation']) ? (bool)$_POST['pre_cancellation'] : true;

        $response = $this->cancel_booking($booking_reference, $pre_cancel);

        wp_send_json_success($response);
    }

    // ========================================
    // 7) FUNCIONALIDADES DE QUOTE AVANÇADAS
    // ========================================

    /**
     * POST /booking/quote/delayedQuote
     * Busca preços finais em background (DelayedQuote)
     *
     * Similar ao DelayedAvailability, mas para a página de quote.
     * Permite carregar a página rapidamente e buscar preços reais depois.
     */
    public function delayed_quote($params) {
        $data = array(
            'budgetId' => $params['budgetId'],
            'availToken' => $params['availToken'],
            'productType' => isset($params['productType']) ? $params['productType'] : 'PACKAGE',
            'fromPage' => isset($params['fromPage']) ? $params['fromPage'] : 'SEARCHER',
            'forceQuote' => true
        );

        // Adicionar myBpAccount se fornecido
        if (isset($params['myBpAccount'])) {
            $data['myBpAccount'] = $params['myBpAccount'];
        }

        $this->log('=== DELAYED QUOTE ===');
        $this->log('Request: ' . json_encode($data));

        $response = $this->make_request('booking/quote/delayedQuote', $data);

        $this->log('Response: ' . json_encode($response));

        return $response;
    }

    /**
     * AJAX Handler para delayed quote
     */
    public function ajax_delayed_quote() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== AJAX DELAYED QUOTE ===');

        $params = array(
            'budgetId' => sanitize_text_field($_POST['budget_id']),
            'availToken' => sanitize_text_field($_POST['avail_token']),
            'productType' => isset($_POST['product_type']) ? sanitize_text_field($_POST['product_type']) : 'PACKAGE',
            'fromPage' => isset($_POST['from_page']) ? sanitize_text_field($_POST['from_page']) : 'SEARCHER',
            'forceQuote' => filter_var($_POST['force_quote'], FILTER_VALIDATE_BOOLEAN)
        );

        // Adicionar myBpAccount se fornecido
        if (isset($_POST['my_bp_account'])) {
            $params['myBpAccount'] = sanitize_text_field($_POST['my_bp_account']);
        }

        $response = $this->delayed_quote($params);

        if ($response && !isset($response['error'])) {
            wp_send_json_success($response);
        } else {
            $error_msg = isset($response['error']) ? $response['error'] : 'Erro ao buscar preços finais';
            wp_send_json_error(array('message' => $error_msg));
        }
    }

    /**
     * POST /booking/quote/updateOptionalService
     * Adiciona ou remove um serviço opcional (seguro, transfer, golf, etc)
     *
     * Atualiza o preço total e persiste no availToken.
     */
    public function update_optional_service($params) {
        $data = array(
            'availToken' => $params['availToken'],
            'serviceId' => $params['serviceId'],
            'addService' => $params['addService'],
            'destinationCode' => $params['destinationCode']
        );

        // Adicionar passageiros se fornecido (para golf/extras)
        if (isset($params['passengers'])) {
            $data['passengers'] = $params['passengers'];
        }

        $this->log('=== UPDATE OPTIONAL SERVICE ===');
        $this->log('Request: ' . json_encode($data));

        $response = $this->make_request('booking/quote/updateOptionalService', $data);

        $this->log('Response: ' . json_encode($response));

        return $response;
    }

    /**
     * AJAX Handler para update optional service
     */
    public function ajax_update_optional_service() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== AJAX UPDATE OPTIONAL SERVICE ===');

        $service_data = json_decode(stripslashes($_POST['service_data']), true);

        if (!$service_data) {
            wp_send_json_error(array('message' => 'Dados inválidos'));
            return;
        }

        $params = array(
            'availToken' => sanitize_text_field($service_data['availToken']),
            'serviceId' => sanitize_text_field($service_data['serviceId']),
            'addService' => filter_var($service_data['addService'], FILTER_VALIDATE_BOOLEAN),
            'destinationCode' => sanitize_text_field($service_data['destinationCode'])
        );

        if (isset($service_data['passengers'])) {
            $params['passengers'] = $service_data['passengers'];
        }

        $response = $this->update_optional_service($params);

        if ($response && !isset($response['error'])) {
            wp_send_json_success($response);
        } else {
            $error_msg = isset($response['error']) ? $response['error'] : 'Erro ao atualizar serviço';
            wp_send_json_error(array('message' => $error_msg));
        }
    }

    // ========================================
    // 8) VALIDAÇÕES AVANÇADAS
    // ========================================

    /**
     * AJAX Handler para validar expediente
     * Validação em tempo real (com debouncing no cliente)
     */
    public function ajax_validate_expedient() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $expedient = sanitize_text_field($_POST['expedient']);
        $client_code = isset($_POST['client_code']) ? sanitize_text_field($_POST['client_code']) : '';
        $branch_office_code = isset($_POST['branch_office_code']) ? sanitize_text_field($_POST['branch_office_code']) : '';

        $this->log('=== VALIDATE EXPEDIENT ===');
        $this->log('Expedient: ' . $expedient);

        // Validação básica
        if (empty($expedient)) {
            wp_send_json_error(array(
                'valid' => false,
                'message' => 'Expediente não pode estar vazio'
            ));
            return;
        }

        // Validação de formato: mínimo 3 caracteres, alfanumérico
        if (strlen($expedient) < 3 || !preg_match('/^[A-Za-z0-9-]+$/', $expedient)) {
            wp_send_json_success(array(
                'valid' => false,
                'message' => 'Formato de expediente inválido'
            ));
            return;
        }

        // Se passar nas validações básicas
        wp_send_json_success(array(
            'valid' => true,
            'message' => 'Expediente válido'
        ));
    }

    /**
     * AJAX Handler para validar passageiros (nomes duplicados)
     */
    public function ajax_validate_passengers() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== VALIDATE PASSENGERS ===');

        $passenger_data = json_decode(stripslashes($_POST['passenger_data']), true);

        if (!$passenger_data) {
            wp_send_json_error(array('message' => 'Dados inválidos'));
            return;
        }

        // Extrair nomes dos passageiros
        $names = array();

        if (isset($passenger_data['rooms']) && is_array($passenger_data['rooms'])) {
            foreach ($passenger_data['rooms'] as $room) {
                if (isset($room['passengers']) && is_array($room['passengers'])) {
                    foreach ($room['passengers'] as $passenger) {
                        if (isset($passenger['firstName']) && isset($passenger['lastName1'])) {
                            $fullName = strtolower(trim($passenger['firstName'] . ' ' . $passenger['lastName1']));
                            $names[] = $fullName;
                        }
                    }
                }
            }
        }

        // Verificar duplicatas
        $duplicates = array();
        $name_count = array_count_values($names);

        foreach ($name_count as $name => $count) {
            if ($count > 1) {
                $duplicates[] = $name;
            }
        }

        if (count($duplicates) > 0) {
            // Encontrados nomes duplicados
            $duplicate_list = implode(', ', array_map('ucwords', $duplicates));

            wp_send_json_success(array(
                'duplicates' => true,
                'names' => $duplicates,
                'message' => 'Foram encontrados passageiros com nomes duplicados: ' . $duplicate_list . '. Deseja continuar?'
            ));
        } else {
            // Nenhuma duplicata
            wp_send_json_success(array(
                'duplicates' => false,
                'message' => 'Validação concluída'
            ));
        }
    }

    // ========================================
    // 9) PRINT E EMAIL DE COTAÇÃO
    // ========================================

    /**
     * POST /booking/quote/print
     * Gera PDF da cotação
     */
    public function print_quote($params) {
        $data = array(
            'budgetId' => $params['budgetId'],
            'availToken' => $params['availToken'],
            'breakdownView' => isset($params['breakdownView']) ? $params['breakdownView'] : 'gross'
        );

        // Adicionar dados do formulário se fornecidos
        if (isset($params['rooms'])) {
            $data['rooms'] = $params['rooms'];
        }
        if (isset($params['holder'])) {
            $data['holder'] = $params['holder'];
        }
        if (isset($params['agency'])) {
            $data['agency'] = $params['agency'];
        }

        $this->log('=== PRINT QUOTE ===');
        $this->log('Request: ' . json_encode($data));

        $response = $this->make_request('booking/quote/print', $data);

        $this->log('Response: ' . json_encode($response));

        return $response;
    }

    /**
     * AJAX Handler para imprimir cotação
     */
    public function ajax_print_quote() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== AJAX PRINT QUOTE ===');

        $quote_data = json_decode(stripslashes($_POST['quote_data']), true);

        if (!$quote_data) {
            wp_send_json_error(array('message' => 'Dados inválidos'));
            return;
        }

        $this->log('Quote data para impressão: ' . json_encode($quote_data));

        // Chamar API da Soltour para gerar PDF
        $response = $this->print_quote($quote_data);

        if ($response && !isset($response['error'])) {
            // API retorna URL do PDF ou HTML
            if (isset($response['pdfUrl'])) {
                wp_send_json_success(array(
                    'pdf_url' => $response['pdfUrl'],
                    'message' => 'PDF gerado com sucesso'
                ));
            } else if (isset($response['result']) && $response['result']['ok']) {
                // Fallback: criar PDF localmente se API não retornar URL
                $pdf_url = $this->generate_local_pdf($quote_data);
                wp_send_json_success(array(
                    'pdf_url' => $pdf_url,
                    'message' => 'PDF gerado com sucesso'
                ));
            } else {
                wp_send_json_error(array('message' => 'Erro ao gerar PDF'));
            }
        } else {
            $error_msg = isset($response['error']) ? $response['error'] : 'Erro ao gerar PDF';
            wp_send_json_error(array('message' => $error_msg));
        }
    }

    /**
     * Gera PDF localmente como fallback
     */
    private function generate_local_pdf($data) {
        // Esta é uma implementação básica de fallback
        // Em produção, você pode usar uma biblioteca como TCPDF ou mPDF

        // Por enquanto, gerar um HTML que pode ser impresso
        $upload_dir = wp_upload_dir();
        $pdf_dir = $upload_dir['basedir'] . '/soltour-quotes/';

        if (!file_exists($pdf_dir)) {
            wp_mkdir_p($pdf_dir);
        }

        $filename = 'quote-' . time() . '.html';
        $filepath = $pdf_dir . $filename;

        // Gerar HTML da cotação
        $html = $this->build_quote_html($data);

        // Salvar arquivo
        file_put_contents($filepath, $html);

        // Retornar URL
        return $upload_dir['baseurl'] . '/soltour-quotes/' . $filename;
    }

    /**
     * Constrói HTML da cotação para impressão
     */
    private function build_quote_html($data) {
        $html = '<!DOCTYPE html><html><head>';
        $html .= '<meta charset="UTF-8">';
        $html .= '<title>Cotação Soltour</title>';
        $html .= '<style>';
        $html .= 'body { font-family: Arial, sans-serif; margin: 40px; }';
        $html .= 'h1 { color: #ff211c; }';
        $html .= 'table { width: 100%; border-collapse: collapse; margin: 20px 0; }';
        $html .= 'th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }';
        $html .= 'th { background-color: #ff211c; color: white; }';
        $html .= '.total { font-size: 24px; font-weight: bold; color: #ff211c; }';
        $html .= '@media print { button { display: none; } }';
        $html .= '</style></head><body>';

        $html .= '<h1>Cotação Soltour</h1>';
        $html .= '<p><strong>Data:</strong> ' . date('d/m/Y H:i') . '</p>';

        // Informações do titular se disponível
        if (isset($data['holder'])) {
            $html .= '<h2>Dados do Titular</h2>';
            $html .= '<p><strong>Nome:</strong> ' . esc_html($data['holder']['name'] ?? '') . '</p>';
            $html .= '<p><strong>Email:</strong> ' . esc_html($data['holder']['email'] ?? '') . '</p>';
        }

        // Breakdown de preços
        if (isset($data['breakdownView'])) {
            $html .= '<h2>Detalhamento de Preços (' . ($data['breakdownView'] === 'gross' ? 'Bruto' : 'Líquido') . ')</h2>';
        }

        // Total
        if (isset($data['totalAmount'])) {
            $html .= '<div class="total">';
            $html .= '<p>Valor Total: €' . number_format($data['totalAmount'], 2, ',', '.') . '</p>';
            $html .= '</div>';
        }

        $html .= '<button onclick="window.print()">Imprimir</button>';
        $html .= '</body></html>';

        return $html;
    }

    /**
     * POST /booking/quote/send
     * Envia cotação por email
     */
    public function send_quote_email($params) {
        $data = array(
            'budgetId' => $params['budgetId'],
            'availToken' => $params['availToken'],
            'email' => $params['email'],
            'breakdownView' => isset($params['breakdownView']) ? $params['breakdownView'] : 'gross'
        );

        // Adicionar dados do formulário se fornecidos
        if (isset($params['rooms'])) {
            $data['rooms'] = $params['rooms'];
        }
        if (isset($params['holder'])) {
            $data['holder'] = $params['holder'];
        }
        if (isset($params['agency'])) {
            $data['agency'] = $params['agency'];
        }

        $this->log('=== SEND QUOTE EMAIL ===');
        $this->log('Request: ' . json_encode($data));

        $response = $this->make_request('booking/quote/send', $data);

        $this->log('Response: ' . json_encode($response));

        return $response;
    }

    /**
     * AJAX Handler para enviar cotação por email
     */
    public function ajax_send_quote_email() {
        check_ajax_referer('soltour_booking_nonce', 'nonce');

        $this->log('=== AJAX SEND QUOTE EMAIL ===');

        $email_data = json_decode(stripslashes($_POST['email_data']), true);

        if (!$email_data) {
            wp_send_json_error(array('message' => 'Dados inválidos'));
            return;
        }

        // Validar email
        if (!isset($email_data['email']) || !is_email($email_data['email'])) {
            wp_send_json_error(array('message' => 'Email inválido'));
            return;
        }

        $to_email = sanitize_email($email_data['email']);

        $this->log('Enviando cotação para: ' . $to_email);

        // Tentar enviar via API da Soltour primeiro
        $response = $this->send_quote_email($email_data);

        if ($response && !isset($response['error'])) {
            if (isset($response['result']) && $response['result']['ok']) {
                $this->log('Email enviado via API Soltour');
                wp_send_json_success(array('message' => 'Email enviado com sucesso'));
                return;
            }
        }

        // Fallback: enviar via wp_mail se API falhar
        $this->log('Fallback: enviando via wp_mail');

        $subject = 'Sua Cotação Soltour';
        $message = $this->build_quote_email_html($email_data);
        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . SOLTOUR_EMAIL_FROM_NAME . ' <' . SOLTOUR_EMAIL_FROM . '>',
            'Reply-To: ' . SOLTOUR_EMAIL_REPLY_TO
        );

        $sent = wp_mail($to_email, $subject, $message, $headers);

        if ($sent) {
            $this->log('Email enviado com sucesso via wp_mail');
            wp_send_json_success(array('message' => 'Email enviado com sucesso'));
        } else {
            $this->log('Erro ao enviar email');
            wp_send_json_error(array('message' => 'Erro ao enviar email. Por favor, tente novamente.'));
        }
    }

    /**
     * Constrói HTML do email de cotação
     */
    private function build_quote_email_html($data) {
        $html = '<html><body>';
        $html .= '<h2>Sua Cotação Soltour</h2>';
        $html .= '<p>Obrigado pelo seu interesse!</p>';

        // Adicionar dados da cotação
        if (isset($data['totalAmount'])) {
            $html .= '<p><strong>Valor Total:</strong> €' . number_format($data['totalAmount'], 2, ',', '.') . '</p>';
        }

        $html .= '<p>Para mais informações, entre em contato conosco.</p>';
        $html .= '</body></html>';

        return $html;
    }

    /**
     * Envia email interno para a agência com detalhes da cotação
     */
    public function send_agency_notification_email($data) {
        // Email de destino da agência (pode conter múltiplos emails separados por vírgula)
        $agency_emails = explode(',', SOLTOUR_AGENCY_EMAIL);
        $to = array_map('trim', $agency_emails); // Remove espaços e converte para array
        $subject = 'Nova Cotação Recebida - ' . $data['viagem']['hotelName'] . ' (' . date('d/m/Y') . ')';

        // Extrair dados do budget_data_completo
        $budget = isset($data['budget_data_completo']) ? $data['budget_data_completo'] : array();
        $accommodation = isset($budget['accommodation']) ? $budget['accommodation'][0] : array();
        $priceInfo = isset($budget['priceInfo']) ? $budget['priceInfo'] : array();

        // Extrair informações de voos
        $outbound_flight = null;
        $inbound_flight = null;

        // Primeiro, tentar extrair do flightData (estrutura usada pelo JavaScript)
        if (isset($budget['flightData']) && !empty($budget['flightData'])) {
            // Extrair voo de ida (outbound)
            if (isset($budget['flightData']['outboundSegments']) && !empty($budget['flightData']['outboundSegments'])) {
                $outbound_flight = array(
                    'segments' => $budget['flightData']['outboundSegments']
                );
            }

            // Extrair voo de volta (inbound)
            if (isset($budget['flightData']['returnSegments']) && !empty($budget['flightData']['returnSegments'])) {
                $inbound_flight = array(
                    'segments' => $budget['flightData']['returnSegments']
                );
            }
        }

        // Se não encontrou no flightData, tentar no array de flight_services
        if (!$outbound_flight || !$inbound_flight) {
            // Tentar múltiplas possíveis localizações dos voos
            $flight_services = array();

            if (isset($budget['flightServices'])) {
                $flight_services = $budget['flightServices'];
            } elseif (isset($budget['flights'])) {
                $flight_services = $budget['flights'];
            } elseif (isset($budget['services'])) {
                // Filtrar apenas serviços de voo
                $all_services = $budget['services'];
                foreach ($all_services as $service) {
                    if (isset($service['type']) && $service['type'] === 'FLIGHT') {
                        $flight_services[] = $service;
                    }
                }
            } elseif (isset($budget['budget']) && isset($budget['budget']['flightServices'])) {
                $flight_services = $budget['budget']['flightServices'];
            } elseif (isset($budget['budget']) && isset($budget['budget']['services'])) {
                // Filtrar apenas serviços de voo
                $all_services = $budget['budget']['services'];
                foreach ($all_services as $service) {
                    if (isset($service['type']) && $service['type'] === 'FLIGHT') {
                        $flight_services[] = $service;
                    }
                }
            }

            // Processar flight_services se disponível
            if (!$outbound_flight && !$inbound_flight && is_array($flight_services)) {
                foreach ($flight_services as $flight) {
                // Tentar diferentes possíveis campos para identificar o tipo de voo
                $flight_type = null;

                if (isset($flight['type'])) {
                    $flight_type = $flight['type'];
                } elseif (isset($flight['direction'])) {
                    $flight_type = $flight['direction'];
                } elseif (isset($flight['flightType'])) {
                    $flight_type = $flight['flightType'];
                }

                if ($flight_type) {
                    if ($flight_type === 'OUTBOUND' || $flight_type === 'outbound') {
                        $outbound_flight = $flight;
                    } elseif ($flight_type === 'INBOUND' || $flight_type === 'inbound') {
                        $inbound_flight = $flight;
                    }
                }
                }
            }
        }

        // Função helper para mapear códigos de companhias aéreas
        $airline_names = array(
            '2W' => 'World2Fly',
            'TP' => 'TAP Air Portugal',
            'IB' => 'Iberia',
            'UX' => 'Air Europa',
            'VY' => 'Vueling',
            'FR' => 'Ryanair',
            'U2' => 'easyJet',
            'LH' => 'Lufthansa',
            'BA' => 'British Airways',
            'AF' => 'Air France',
            'KL' => 'KLM'
        );

        function get_airline_name($code, $airline_names) {
            return isset($airline_names[$code]) ? $airline_names[$code] : $code;
        }

        ob_start();
        ?>
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
            <div style="background: linear-gradient(135deg, #019CB8 0%, #0176a8 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Nova Cotação - Beauty Travel</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema de Gestão de Reservas</p>
            </div>

            <div style="padding: 30px; background: white; margin-top: 2px;">
                <!-- 1. IDENTIFICAÇÃO DO PRODUTO -->
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px;">
                    🔖 1. Identificação do Produto
                </h2>
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Budget ID:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;"><?php echo esc_html($data['dadosApi']['budgetId'] ?? 'N/A'); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Quote Token:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; word-break: break-all;"><?php echo esc_html(isset($budget['quoteToken']) ? $budget['quoteToken'] : 'N/A'); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Avail Token:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; word-break: break-all;"><?php echo esc_html($data['dadosApi']['availToken'] ?? 'N/A'); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Product Type:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html($data['dadosApi']['productType'] ?? 'PACKAGE'); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Market:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(SOLTOUR_API_MARKET); ?></td>
                    </tr>
                </table>

                <!-- 2. DADOS DA ESTADIA -->
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px; margin-top: 40px;">
                    🏨 2. Dados da Estadia
                </h2>
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Hotel:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html($data['viagem']['hotelName']); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Código Hotel:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;"><?php echo esc_html(isset($accommodation['hotelCode']) ? $accommodation['hotelCode'] : 'N/A'); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Quarto:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($accommodation['roomName']) ? $accommodation['roomName'] : (isset($data['viagem']['roomName']) ? $data['viagem']['roomName'] : $data['viagem']['quartos'] . ' quarto(s)')); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Regime:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html($data['viagem']['regime']); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Check-in:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(date('d/m/Y', strtotime($data['viagem']['checkin']))); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Check-out:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(date('d/m/Y', strtotime($data['viagem']['checkout']))); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Noites:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html($data['viagem']['noites']); ?></td>
                    </tr>
                </table>

                <!-- 3. VOOS -->
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px; margin-top: 40px;">
                    ✈️ 3. Informações de Voos
                </h2>

                <?php if ($outbound_flight && isset($outbound_flight['segments']) && !empty($outbound_flight['segments'])):
                    $segments = $outbound_flight['segments'];
                    $first_seg = $segments[0];
                    $last_seg = $segments[count($segments) - 1];
                ?>
                <h3 style="color: #555; margin-top: 20px;">🛫 Voo de Ida</h3>
                <table style="width: 100%; margin: 10px 0; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Companhia:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php
                            $carrier_code = isset($first_seg['operatingCompanyCode']) ? $first_seg['operatingCompanyCode'] : (isset($first_seg['carrierCode']) ? $first_seg['carrierCode'] : null);
                            echo esc_html($carrier_code ? get_airline_name($carrier_code, $airline_names) : 'N/A');
                        ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Número do Voo:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;"><?php echo esc_html(isset($first_seg['flightNumber']) ? $first_seg['flightNumber'] : 'N/A'); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Origem:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($first_seg['originAirport']) ? $first_seg['originAirport'] : (isset($first_seg['origin']) ? $first_seg['origin'] : 'N/A')); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Destino:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($last_seg['destinationAirport']) ? $last_seg['destinationAirport'] : (isset($last_seg['destination']) ? $last_seg['destination'] : 'N/A')); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Horário Partida:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($first_seg['departureTime']) ? substr($first_seg['departureTime'], 0, 5) : 'N/A'); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Horário Chegada:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($last_seg['arrivalTime']) ? substr($last_seg['arrivalTime'], 0, 5) : 'N/A'); ?></td>
                    </tr>
                    <?php if (count($segments) > 1): ?>
                    <tr style="background: #fff3cd;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Escalas:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(count($segments) - 1); ?> escala(s)</td>
                    </tr>
                    <?php endif; ?>
                </table>
                <?php endif; ?>

                <?php if ($inbound_flight && isset($inbound_flight['segments']) && !empty($inbound_flight['segments'])):
                    $segments = $inbound_flight['segments'];
                    $first_seg = $segments[0];
                    $last_seg = $segments[count($segments) - 1];
                ?>
                <h3 style="color: #555; margin-top: 20px;">🛬 Voo de Volta</h3>
                <table style="width: 100%; margin: 10px 0; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Companhia:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php
                            $carrier_code = isset($first_seg['operatingCompanyCode']) ? $first_seg['operatingCompanyCode'] : (isset($first_seg['carrierCode']) ? $first_seg['carrierCode'] : null);
                            echo esc_html($carrier_code ? get_airline_name($carrier_code, $airline_names) : 'N/A');
                        ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Número do Voo:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;"><?php echo esc_html(isset($first_seg['flightNumber']) ? $first_seg['flightNumber'] : 'N/A'); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Origem:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($first_seg['originAirport']) ? $first_seg['originAirport'] : (isset($first_seg['origin']) ? $first_seg['origin'] : 'N/A')); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Destino:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($last_seg['destinationAirport']) ? $last_seg['destinationAirport'] : (isset($last_seg['destination']) ? $last_seg['destination'] : 'N/A')); ?></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Horário Partida:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($first_seg['departureTime']) ? substr($first_seg['departureTime'], 0, 5) : 'N/A'); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Horário Chegada:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(isset($last_seg['arrivalTime']) ? substr($last_seg['arrivalTime'], 0, 5) : 'N/A'); ?></td>
                    </tr>
                    <?php if (count($segments) > 1): ?>
                    <tr style="background: #fff3cd;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Escalas:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html(count($segments) - 1); ?> escala(s)</td>
                    </tr>
                    <?php endif; ?>
                </table>
                <?php endif; ?>

                <?php if (!$outbound_flight && !$inbound_flight): ?>
                <p style="color: #666; font-style: italic;">Informações de voos não disponíveis nesta cotação.</p>
                <?php endif; ?>

                <!-- 4. PASSAGEIROS -->
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px; margin-top: 40px;">
                    👥 4. Passageiros (<?php echo count($data['passageiros']); ?>)
                </h2>
                <?php foreach ($data['passageiros'] as $index => $pax):
                    $birthdate = new DateTime($pax['nascimento']);
                    $today = new DateTime('today');
                    $age = $birthdate->diff($today)->y;
                ?>
                <div style="background: <?php echo $index % 2 == 0 ? '#f9fafb' : '#fff'; ?>; padding: 15px; margin: 10px 0; border-left: 4px solid #019CB8; border-radius: 4px;">
                    <h4 style="margin: 0 0 10px 0; color: #019CB8;">Passageiro <?php echo ($index + 1); ?></h4>
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 4px 0; width: 180px;"><strong>Nome Completo:</strong></td>
                            <td style="padding: 4px 0;"><?php echo esc_html($pax['nome'] . ' ' . $pax['sobrenome']); ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>Data de Nascimento:</strong></td>
                            <td style="padding: 4px 0;"><?php echo esc_html($pax['nascimento']); ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>Idade:</strong></td>
                            <td style="padding: 4px 0;"><?php echo esc_html($age); ?> anos</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>Tipo:</strong></td>
                            <td style="padding: 4px 0;"><?php echo esc_html($pax['tipo']); ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>Documento:</strong></td>
                            <td style="padding: 4px 0;"><?php echo esc_html($pax['documento']); ?></td>
                        </tr>
                    </table>
                </div>
                <?php endforeach; ?>

                <!-- 5. TITULAR DA RESERVA -->
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px; margin-top: 40px;">
                    📋 5. Titular da Reserva
                </h2>
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd; width: 180px;"><strong>Nome:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html($data['cliente']['nome'] . ' ' . $data['cliente']['sobrenome']); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:<?php echo esc_attr($data['cliente']['email']); ?>"><?php echo esc_html($data['cliente']['email']); ?></a></td>
                    </tr>
                    <tr style="background: #f9fafb;">
                        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Telefone:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><?php echo esc_html($data['cliente']['telefone']); ?></td>
                    </tr>
                </table>

                <!-- 6. PREÇO FINAL -->
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px; margin-top: 40px;">
                    💰 6. Preço Final
                </h2>
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 8px 0;"><strong>Valor Total:</strong></td>
                            <td style="padding: 8px 0; text-align: right; font-size: 24px; font-weight: bold; color: #019CB8;">
                                €<?php echo number_format($data['viagem']['precoTotal'], 2, ',', '.'); ?>
                            </td>
                        </tr>
                        <?php
                        $num_passengers = count($data['passageiros']);
                        $price_per_person = $num_passengers > 0 ? $data['viagem']['precoTotal'] / $num_passengers : 0;
                        ?>
                        <tr>
                            <td style="padding: 8px 0;"><strong>Valor Por Pessoa:</strong></td>
                            <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #555;">
                                €<?php echo number_format($price_per_person, 2, ',', '.'); ?>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php if (isset($data['observacoes']) && !empty($data['observacoes'])): ?>
                <h2 style="color: #019CB8; border-bottom: 2px solid #019CB8; padding-bottom: 10px; margin-top: 40px;">
                    📝 Observações
                </h2>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <?php echo nl2br(esc_html($data['observacoes'])); ?>
                </div>
                <?php endif; ?>
            </div>

            <div style="background: #1a202c; color: white; padding: 20px; text-align: center; font-size: 12px; margin-top: 2px;">
                <p style="margin: 0;">© <?php echo date('Y'); ?> Beauty Travel - Sistema Interno de Gestão</p>
            </div>
        </div>
        <?php
        $body = ob_get_clean();

        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . SOLTOUR_EMAIL_FROM_NAME . ' <' . SOLTOUR_EMAIL_FROM . '>',
            'Reply-To: ' . $data['cliente']['email']
        );

        return wp_mail($to, $subject, $body, $headers);
    }

    /**
     * Envia email de confirmação para o cliente
     */
    public function send_client_confirmation_email($data) {
        $to = $data['cliente']['email'];
        $subject = 'Recebemos a sua cotação – Beauty Travel';

        ob_start();
        ?>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #019CB8 0%, #0176a8 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0;">Beauty Travel</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">A sua agência de viagens de confiança</p>
            </div>

            <div style="padding: 30px; background: #f9fafb;">
                <p>Olá <strong><?php echo esc_html($data['cliente']['nome']); ?></strong>,</p>

                <p>Recebemos a sua solicitação de cotação para:</p>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="color: #019CB8; margin-top: 0;">
                        🏨 <?php echo esc_html($data['viagem']['hotelName']); ?>
                    </h3>
                    <p style="line-height: 1.8;">
                        📍 <strong>Destino:</strong> <?php echo esc_html($data['viagem']['destino']); ?><br>
                        📅 <strong>Check-in:</strong> <?php echo esc_html(date('d/m/Y', strtotime($data['viagem']['checkin']))); ?><br>
                        📅 <strong>Check-out:</strong> <?php echo esc_html(date('d/m/Y', strtotime($data['viagem']['checkout']))); ?><br>
                        🌙 <strong>Duração:</strong> <?php echo esc_html($data['viagem']['noites']); ?> noite(s)<br>
                        🛏️ <strong>Tipo de Quarto:</strong> <?php echo esc_html($data['viagem']['roomName']); ?><br>
                        🏠 <strong>Número de Quartos:</strong> <?php echo esc_html($data['viagem']['quartos']); ?><br>
                        👥 <strong>Passageiros:</strong> <?php echo count($data['passageiros']); ?> pessoa(s)<br>
                        🍽️ <strong>Regime:</strong> <?php echo esc_html($data['viagem']['regime']); ?><br>
                        💰 <strong>Preço Total:</strong> €<?php echo number_format($data['viagem']['precoTotal'], 2, ',', '.'); ?>
                    </p>
                </div>

                <p><strong>Próximos passos:</strong></p>
                <ol style="line-height: 1.8;">
                    <li>A nossa equipa vai validar os valores finais</li>
                    <li>Entraremos em contacto consigo nas próximas 24 horas</li>
                    <li>Após confirmação, enviaremos os dados de pagamento</li>
                </ol>

                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <strong>⚠️ Importante:</strong> Este email não constitui reserva confirmada.
                    Aguarde o nosso contacto para confirmação final dos valores.
                </div>

                <p>Se tiver alguma dúvida, pode responder a este email ou contactar-nos através de:</p>
                <p style="line-height: 1.8;">
                    📧 <a href="mailto:<?php echo esc_attr(SOLTOUR_EMAIL_REPLY_TO); ?>" style="color: #019CB8;"><?php echo esc_html(SOLTOUR_EMAIL_REPLY_TO); ?></a><br>
                    📞 Número de telefone e Whatsapp<br>
                    <strong style="font-size: 16px;">+351 923 190 584</strong><br>
                    <span style="font-size: 12px; color: #666;">*chamada para rede móvel nacional</span>
                </p>

                <p style="margin-top: 30px; text-align: center;">
                    Obrigado por escolher a Beauty Travel 💙
                </p>
            </div>

            <div style="background: #1a202c; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© <?php echo date('Y'); ?> Beauty Travel. Todos os direitos reservados.</p>
            </div>
        </div>
        <?php
        $body = ob_get_clean();

        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . SOLTOUR_EMAIL_FROM_NAME . ' <' . SOLTOUR_EMAIL_FROM . '>',
            'Reply-To: ' . SOLTOUR_EMAIL_REPLY_TO
        );

        return wp_mail($to, $subject, $body, $headers);
    }

    /**
     * Salva cotação no banco de dados para consulta no admin
     */
    private function save_quote_to_database($email_data, $quote_id) {
        global $wpdb;

        $table_name = $wpdb->prefix . 'soltour_quotes';

        // Preparar dados para salvar
        $client_name = $email_data['cliente']['nome'] . ' ' . $email_data['cliente']['sobrenome'];
        $client_email = $email_data['cliente']['email'];
        $total_price = $email_data['viagem']['precoTotal'];

        // Preparar dados completos da cotação para armazenar em JSON
        $quote_data = array(
            'destination_name' => $email_data['viagem']['destino'],
            'hotel_name' => $email_data['viagem']['hotelName'],
            'checkin' => $email_data['viagem']['checkin'],
            'checkout' => $email_data['viagem']['checkout'],
            'nights' => $email_data['viagem']['noites'],
            'rooms' => $email_data['viagem']['quartos'],
            'board_name' => $email_data['viagem']['regime'],
            'room_name' => isset($email_data['viagem']['roomName']) ? $email_data['viagem']['roomName'] : 'N/A',
            'adults' => 0,
            'children' => 0,
            'passengers' => $email_data['passageiros'],
            'client' => $email_data['cliente'],
            'observations' => isset($email_data['observacoes']) ? $email_data['observacoes'] : '',
            'expedient' => isset($email_data['dadosApi']['expedient']) ? $email_data['dadosApi']['expedient'] : '',
            'avail_token' => $email_data['dadosApi']['availToken'],
            'budget_id' => $email_data['dadosApi']['budgetId'],
            'quote_id' => $quote_id
        );

        // Contar adultos e crianças
        foreach ($email_data['passageiros'] as $pax) {
            if (strtoupper($pax['tipo']) === 'ADULT') {
                $quote_data['adults']++;
            } elseif (strtoupper($pax['tipo']) === 'CHILD') {
                $quote_data['children']++;
            }
        }

        // Determinar para quais emails foram enviados
        $email_sent_to = array();
        $agency_emails = explode(',', SOLTOUR_AGENCY_EMAIL);
        foreach ($agency_emails as $agency_email) {
            $email_sent_to[] = trim($agency_email) . ' (Agência)';
        }
        $email_sent_to[] = $client_email . ' (Cliente)';

        // Inserir no banco de dados
        $inserted = $wpdb->insert(
            $table_name,
            array(
                'client_name' => $client_name,
                'client_email' => $client_email,
                'total_price' => $total_price,
                'quote_data' => json_encode($quote_data, JSON_UNESCAPED_UNICODE),
                'email_sent_to' => implode(', ', $email_sent_to),
                'created_at' => current_time('mysql')
            ),
            array('%s', '%s', '%f', '%s', '%s', '%s')
        );

        if ($inserted) {
            $this->log('Cotação salva no banco de dados com ID: ' . $wpdb->insert_id);
        } else {
            $this->log('Erro ao salvar cotação no banco de dados: ' . $wpdb->last_error, 'error');
        }
    }
}
