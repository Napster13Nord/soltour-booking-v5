/**
 * Soltour Booking V4 - JavaScript COMPLETO
 * COM TODOS OS CAMPOS MAPEADOS CORRETAMENTE
 */

(function($) {
    'use strict';

    // MAPEAMENTOS DE DESTINOS E ORIGENS
    const DESTINATIONS_MAP = {
        'PUJ': { country: 'República Dominicana', city: 'Punta Cana' },
        'SDQ': { country: 'República Dominicana', city: 'Santo Domingo' },
        'STI': { country: 'República Dominicana', city: 'Santiago' },
        'LRM': { country: 'República Dominicana', city: 'La Romana' },
        'AUA': { country: 'Aruba', city: 'Oranjestad' },
        'CUN': { country: 'México', city: 'Cancún' },
        'CZM': { country: 'México', city: 'Cozumel' },
        'VRA': { country: 'Cuba', city: 'Varadero' },
        'HAV': { country: 'Cuba', city: 'Havana' },
        'MBJ': { country: 'Jamaica', city: 'Montego Bay' }
    };

    const ORIGINS_MAP = {
        'LIS': 'Lisboa',
        'OPO': 'Porto',
        'FAO': 'Faro',
        'MAD': 'Madrid',
        'BCN': 'Barcelona',
        'SVQ': 'Sevilha',
        'BIO': 'Bilbau',
        'VLC': 'Valência'
    };

    window.SoltourApp = {
        availToken: null,
        budgetId: null,
        hotelCode: null,
        providerCode: null,
        expedient: null,
        searchParams: {},
        selectedPackage: null,
        state: 0, // Contador de estado para tracking no URL
        currentMonth: new Date().getMonth() + 1,
        currentYear: new Date().getFullYear(),
        currentPage: 1,
        itemsPerPage: 10,
        totalBudgets: 0,
        allBudgets: [],
        enrichedPackages: {},
        uniqueHotels: [],
        allUniqueHotels: [], // TODOS os hotéis únicos deduplicados (para paginação local)
        originalHotels: [], // Cópia dos hotéis originais sem filtros (para poder resetar filtros)
        hotelsFromAvailability: {},
        flightsFromAvailability: {}, // Voos do availability
        selectedRooms: {}, // Quartos selecionados por budgetId: { budgetId: [roomData, roomData, ...] }
        numRoomsSearched: 1, // Número de quartos pesquisados (padrão 1)
        minDate: null,
        maxDate: null,
        // Filtros
        filters: {
            sortBy: 'price-asc', // 'price-asc', 'price-desc', 'stars-desc'
            minPrice: 0, // Preço mínimo absoluto dos dados
            maxPrice: 10000,
            absoluteMaxPrice: 10000, // Preço máximo absoluto dos dados (para saber se filtro está ativo)
            selectedStars: [], // Array de estrelas selecionadas [3, 4, 5]
            selectedMealPlans: [] // Array de códigos de regime alimentar ['TI', 'MP', etc]
        }
    };

    // ========================================
    // FUNÇÕES DO MODAL DE CARREGAMENTO
    // ========================================

    /**
     * Mostra o modal de carregamento com mensagem personalizada
     * @param {string} title - Título do modal (opcional)
     * @param {string} message - Mensagem do modal (opcional)
     * @param {boolean} rotateMessages - Se true, rotaciona mensagens de busca (padrão: false)
     * @param {boolean} showTimeInfo - Se true, mostra mensagem de tempo de espera (padrão: false)
     */
    function showLoadingModal(title, message, rotateMessages, showTimeInfo) {
        const modal = $('#soltour-loading-modal');

        if (modal.length) {
            // Atualizar textos se fornecidos
            if (title) {
                $('#loading-modal-title').text(title);
            }
            if (message) {
                $('#loading-modal-message').text(message);
            }

            // Mostrar ou ocultar mensagem de tempo de espera
            if (showTimeInfo === true) {
                $('.loading-time-info').show();
            } else {
                $('.loading-time-info').hide();
            }

            // Mostrar modal com animação
            modal.addClass('active');

            // Prevenir scroll do body
            $('body').css('overflow', 'hidden');

            // Iniciar rotação de mensagens APENAS se solicitado
            if (rotateMessages === true) {
                startLoadingMessageRotation();
            }
        }
    }

    /**
     * Rotaciona as mensagens do modal de loading a cada 7 segundos
     */
    var loadingMessageInterval = null;
    function startLoadingMessageRotation() {
        // Limpar intervalo anterior se existir
        if (loadingMessageInterval) {
            clearInterval(loadingMessageInterval);
        }

        const messages = [
            'Buscando os melhores voos...',
            'Buscando os melhores hotéis...',
            'Buscando os melhores pacotes...'
        ];

        let currentIndex = 0;

        // Definir primeira mensagem
        $('#loading-modal-title').text(messages[currentIndex]);

        // Rotacionar a cada 7 segundos
        loadingMessageInterval = setInterval(function() {
            currentIndex = (currentIndex + 1) % messages.length;
            $('#loading-modal-title').text(messages[currentIndex]);
        }, 7000);
    }

    /**
     * Esconde o modal de carregamento
     */
    function hideLoadingModal() {
        const modal = $('#soltour-loading-modal');

        if (modal.length) {
            // Limpar intervalo de rotação de mensagens
            if (loadingMessageInterval) {
                clearInterval(loadingMessageInterval);
                loadingMessageInterval = null;
            }

            // Remover classe active para esconder
            modal.removeClass('active');

            // Restaurar scroll do body
            $('body').css('overflow', '');

        }
    }

    /**
     * Atualiza a mensagem do modal sem esconder
     * @param {string} title - Novo título
     * @param {string} message - Nova mensagem
     */
    function updateLoadingModal(title, message) {
        if (title) {
            $('#loading-modal-title').text(title);
        }
        if (message) {
            $('#loading-modal-message').text(message);
        }
    }

    // ========================================
    // STATE TRACKING E URL MANAGEMENT
    // ========================================

    /**
     * Atualiza a URL com availToken e state tracking
     * Permite manter estado após reload da página
     * @param {string} availToken - Token de disponibilidade da API
     */
    function updateURLState(availToken) {
        if (!availToken) {
            return;
        }

        // Incrementar contador de estado
        SoltourApp.state++;

        // Atualizar URL sem reload
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('availToken', availToken);
        newUrl.searchParams.set('state', SoltourApp.state);

        window.history.replaceState({}, '', newUrl);

    }

    /**
     * Restaura estado da URL ao carregar página
     * Usado quando usuário dá reload ou volta para resultados
     */
    function restoreStateFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const availToken = urlParams.get('availToken');
        const state = parseInt(urlParams.get('state') || '0');

        if (availToken && state > 0) {
            SoltourApp.availToken = availToken;
            SoltourApp.state = state;
            return true;
        }

        return false;
    }

    $(document).ready(function() {
        initSearchForm();
        initResultsPage();
    });

    function initSearchForm() {
        if ($('#soltour-search-form').length === 0) return;

        // Verificar se há mensagem de "sem resultados" no localStorage
        const noResultsMessage = localStorage.getItem('soltour_no_results_message');
        if (noResultsMessage) {
            // Mostrar mensagem de alerta
            const alertHtml = `
                <div class="soltour-alert soltour-alert-warning" style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px; color: #856404;">
                    <div style="display: flex; align-items: start; gap: 15px;">
                        <div style="font-size: 32px;">⚠️</div>
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Nenhum pacote encontrado</h4>
                            <p style="margin: 0; line-height: 1.6;">${noResultsMessage}</p>
                        </div>
                        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #856404; padding: 0; line-height: 1;">×</button>
                    </div>
                </div>
            `;
            $('.soltour-search-wrapper').prepend(alertHtml);

            // Limpar mensagem do localStorage
            localStorage.removeItem('soltour_no_results_message');
        }

        loadDestinations();
        
        $('#soltour-destination').on('change', function() {
            const destCode = $(this).val();
            if (destCode) {
                loadOrigins(destCode);
                SoltourApp.searchParams.destinationCode = destCode;
            }
        });

        $('#soltour-origin').on('change', function() {
            SoltourApp.searchParams.originCode = $(this).val();
        });

        $('#soltour-nights').on('change', function() {
            SoltourApp.searchParams.numNights = $(this).val();
        });

        // Renderizar configuração de quartos ao carregar
        renderRoomsConfig(1);

        // Event listener para número de quartos
        $('#soltour-num-rooms').on('change', function() {
            const numRooms = parseInt($(this).val());
            renderRoomsConfig(numRooms);
        });

        $('#soltour-search-form').on('submit', function(e) {
            e.preventDefault();
            performSearch();
        });
    }

    function loadDestinations() {
        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_get_destinations',
                nonce: soltourData.nonce
            },
            success: function(response) {
                if (response.success) {
                    const $select = $('#soltour-destination');
                    $select.empty().append('<option value="">Selecione um destino</option>');
                    response.data.forEach(function(dest) {
                        $select.append(`<option value="${dest.code}">${dest.displayName}</option>`);
                    });
                }
            }
        });
    }

    function loadOrigins(destinationCode) {
        $('#soltour-origin').html('<option value="">A carregar...</option>');
        
        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_get_origins',
                nonce: soltourData.nonce,
                destination_code: destinationCode
            },
            success: function(response) {
                const $select = $('#soltour-origin');
                $select.empty().append('<option value="">Selecione a origem</option>');
                if (response.success) {
                    response.data.forEach(function(origin) {
                        $select.append(`<option value="${origin.code}">${origin.description}</option>`);
                    });
                }
            }
        });
    }

    function renderRoomsConfig(numRooms) {
        const $container = $('#soltour-rooms-config');
        $container.empty();

        for (let i = 0; i < numRooms; i++) {
            const roomHtml = `
                <div class="soltour-room-item soltour-room-config" data-room="${i}">
                    <div class="soltour-room-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        <h4>Quarto ${i + 1}</h4>
                    </div>
                    <div class="soltour-room-fields">
                        <div class="soltour-form-group">
                            <label>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                Adultos
                            </label>
                            <select class="room-adults" data-room="${i}">
                                ${Array.from({length: 8}, (_, j) => `<option value="${j + 1}" ${j === 1 ? 'selected' : ''}>${j + 1}</option>`).join('')}
                            </select>
                        </div>
                        <div class="soltour-form-group">
                            <label>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="8" r="3"></circle>
                                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
                                </svg>
                                Crianças (0-17)
                            </label>
                            <select class="room-children" data-room="${i}">
                                ${Array.from({length: 7}, (_, j) => `<option value="${j}">${j}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="room-adults-ages" data-room="${i}" style="display:none;"></div>
                    <div class="room-children-ages" data-room="${i}" style="display:none;"></div>
                </div>
            `;
            $container.append(roomHtml);
        }

        // Event listeners para adultos
        $('.room-adults').on('change', function() {
            const roomIndex = $(this).data('room');
            const numAdults = parseInt($(this).val());
            showRoomAdultsAges(roomIndex, numAdults);
        });

        // Event listeners para crianças
        $('.room-children').on('change', function() {
            const roomIndex = $(this).data('room');
            const numChildren = parseInt($(this).val());
            showRoomChildrenAges(roomIndex, numChildren);
        });

        // Trigger inicial para mostrar campos de idade dos adultos
        $('.room-adults').each(function() {
            const roomIndex = $(this).data('room');
            const numAdults = parseInt($(this).val());
            showRoomAdultsAges(roomIndex, numAdults);
        });
    }

    function showRoomAdultsAges(roomIndex, numAdults) {
        const $container = $(`.room-adults-ages[data-room="${roomIndex}"]`);
        $container.empty();

        if (numAdults === 0) {
            $container.hide();
            return;
        }

        $container.html(`
            <div class="soltour-room-fields" style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
                <div style="margin-bottom: 12px; color: #6b7280; font-size: 14px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Informe a idade de cada adulto
                </div>
                ${Array.from({length: numAdults}, (_, i) => `
                    <div class="soltour-form-group">
                        <label>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Idade adulto ${i + 1}
                        </label>
                        <select class="adult-age" data-room="${roomIndex}" data-adult="${i}" required>
                            ${Array.from({length: 83}, (_, j) => {
                                const age = j + 18; // Idade mínima 18, máxima 100
                                return `<option value="${age}" ${age === 30 ? 'selected' : ''}>${age} anos</option>`;
                            }).join('')}
                        </select>
                    </div>
                `).join('')}
            </div>
        `);
        $container.show();
    }

    function showRoomChildrenAges(roomIndex, numChildren) {
        const $container = $(`.room-children-ages[data-room="${roomIndex}"]`);
        $container.empty();

        if (numChildren === 0) {
            $container.hide();
            return;
        }

        $container.html(`
            <div class="soltour-room-fields" style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
                <div style="margin-bottom: 12px; color: #6b7280; font-size: 14px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Informe a idade de cada criança
                </div>
                ${Array.from({length: numChildren}, (_, i) => `
                    <div class="soltour-form-group">
                        <label>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="8" r="3"></circle>
                                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
                            </svg>
                            Idade criança ${i + 1}
                        </label>
                        <select class="child-age" data-room="${roomIndex}" data-child="${i}" required>
                            ${Array.from({length: 18}, (_, j) => `<option value="${j}">${j} anos</option>`).join('')}
                        </select>
                    </div>
                `).join('')}
            </div>
        `);
        $container.show();
    }

    function performSearch() {
        const startDate = $('#soltour-start-date').val();
        const nights = parseInt($('#soltour-nights').val());

        if (!startDate || !SoltourApp.searchParams.originCode || !SoltourApp.searchParams.destinationCode) {
            alert('Preencha todos os campos');
            return;
        }

        // Montar array de quartos
        const rooms = [];
        $('.soltour-room-config').each(function() {
            const roomIndex = $(this).data('room');
            const adults = parseInt($(`.room-adults[data-room="${roomIndex}"]`).val());
            const children = parseInt($(`.room-children[data-room="${roomIndex}"]`).val());

            const passengers = [];

            // Adicionar adultos com suas idades reais
            for (let i = 0; i < adults; i++) {
                const age = parseInt($(`.adult-age[data-room="${roomIndex}"][data-adult="${i}"]`).val()) || 30;
                passengers.push({ type: 'ADULT', age: age });
            }

            // Adicionar crianças com suas idades
            for (let i = 0; i < children; i++) {
                const age = parseInt($(`.child-age[data-room="${roomIndex}"][data-child="${i}"]`).val()) || 10;
                passengers.push({ type: 'CHILD', age: age });
            }

            rooms.push({ passengers: passengers });
        });

        // Armazenar número de quartos pesquisados
        SoltourApp.numRoomsSearched = rooms.length;


        // Resetar para primeira página na nova busca
        SoltourApp.currentPage = 1;

        // Determinar tipo de produto baseado se tem origem ou não
        const hasOrigin = !!SoltourApp.searchParams.originCode;
        const onlyHotel = hasOrigin ? "N" : "S";
        const productType = onlyHotel === "S" ? "HOTEL_PRODUCT" : "PACKAGE";

        SoltourApp.searchParams = {
            action: 'soltour_search_packages',
            nonce: soltourData.nonce,
            origin_code: SoltourApp.searchParams.originCode,
            destination_code: SoltourApp.searchParams.destinationCode,
            start_date: startDate,
            num_nights: nights,
            rooms: JSON.stringify(rooms),

            // Parâmetros críticos para API processar corretamente
            only_hotel: onlyHotel,
            product_type: productType,

            // Paginação (corrigido para pageNumber/rowsPerPage conforme documentação Soltour)
            page_number: 0,
            rows_per_page: 100 // Buscar todos os budgets de uma vez
        };

        if ($('#soltour-results-list').length > 0) {
            searchPackagesAjax();
        } else {
            sessionStorage.setItem('soltour_search_params', JSON.stringify(SoltourApp.searchParams));
            window.location.href = '/pacotes-resultados/';
        }
    }

    function initResultsPage() {
        if ($('#soltour-results-list').length === 0) return;

        const savedParams = sessionStorage.getItem('soltour_search_params');
        if (savedParams) {
            // MOSTRAR MODAL IMEDIATAMENTE ao carregar página de resultados
            showLoadingModal(
                'Buscando os melhores pacotes...',
                'Encontraremos as melhores opções para sua viagem',
                true,  // Ativar rotação de mensagens a cada 7 segundos
                true   // Mostrar mensagem de tempo de espera (30-45 segundos)
            );

            SoltourApp.searchParams = JSON.parse(savedParams);

            // CORREÇÃO: Definir numRoomsSearched a partir dos parâmetros de busca
            if (SoltourApp.searchParams.rooms) {
                try {
                    // Se rooms é uma string JSON (formato do formulário principal)
                    if (typeof SoltourApp.searchParams.rooms === 'string') {
                        const roomsArray = JSON.parse(SoltourApp.searchParams.rooms);
                        SoltourApp.numRoomsSearched = Array.isArray(roomsArray) ? roomsArray.length : 1;
                    }
                    // Se rooms é um número (formato do modal)
                    else if (typeof SoltourApp.searchParams.rooms === 'number') {
                        SoltourApp.numRoomsSearched = SoltourApp.searchParams.rooms;
                    }
                    // Se rooms é um array
                    else if (Array.isArray(SoltourApp.searchParams.rooms)) {
                        SoltourApp.numRoomsSearched = SoltourApp.searchParams.rooms.length;
                    }
                } catch(e) {
                    SoltourApp.numRoomsSearched = 1; // fallback
                }
            }


            searchPackagesAjax();
        }

        // Inicializar filtros
        initFilters();
    }

    // ========================================
    // FUNÇÕES DE FILTROS
    // ========================================

    function initFilters() {

        // Filtro de ordenação
        $('#soltour-sort-by').on('change', function() {
            SoltourApp.filters.sortBy = $(this).val();
            applyFilters();
        });

        // Filtro de preço máximo
        $('#soltour-max-price').on('input', function() {
            const value = parseInt($(this).val());
            SoltourApp.filters.maxPrice = value;
            $('#soltour-max-price-value').text(value.toLocaleString('pt-PT') + '€');
        });

        $('#soltour-max-price').on('change', function() {
            applyFilters();
        });

        // Filtro de estrelas
        $('.soltour-star-filter input[type="checkbox"]').on('change', function() {
            const starValue = parseInt($(this).val());

            if ($(this).is(':checked')) {
                if (!SoltourApp.filters.selectedStars.includes(starValue)) {
                    SoltourApp.filters.selectedStars.push(starValue);
                }
            } else {
                SoltourApp.filters.selectedStars = SoltourApp.filters.selectedStars.filter(s => s !== starValue);
            }

            applyFilters();
        });

        // Filtro de regime alimentar
        $('.soltour-meal-plan-filter input[type="checkbox"]').on('change', function() {
            const mealPlanCode = $(this).val();

            if ($(this).is(':checked')) {
                if (!SoltourApp.filters.selectedMealPlans.includes(mealPlanCode)) {
                    SoltourApp.filters.selectedMealPlans.push(mealPlanCode);
                }
            } else {
                SoltourApp.filters.selectedMealPlans = SoltourApp.filters.selectedMealPlans.filter(mp => mp !== mealPlanCode);
            }

            applyFilters();
        });
    }

    function applyFilters() {

        // Resetar para primeira página
        SoltourApp.currentPage = 1;

        // Obter hotéis filtrados e ordenados
        const filteredHotels = getFilteredHotels();

        // Atualizar allUniqueHotels com hotéis filtrados
        SoltourApp.allUniqueHotels = filteredHotels;


        // Atualizar state tracking (mantém estado na URL)
        if (SoltourApp.availToken) {
            updateURLState(SoltourApp.availToken);
        }

        // Se não houver resultados após filtros, mostrar mensagem inline
        if (filteredHotels.length === 0) {
            const $list = $('#soltour-results-list');
            $list.empty();
            $list.html(`
                <div style="text-align: center; padding: 60px 20px; grid-column: 1 / -1;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                    <h3 style="color: #1a202c; font-size: 24px; margin-bottom: 12px;">Nenhum pacote corresponde aos filtros</h3>
                    <p style="color: #6b7280; font-size: 16px;">Tente ajustar os filtros para ver mais resultados</p>
                </div>
            `);
            $('#soltour-results-count').text('0 hotéis encontrados');
            $('#soltour-pagination').empty();
        } else {
            // Re-renderizar primeira página
            renderLocalPage(1);
        }
    }

    function getFilteredHotels() {
        // Filtrar a partir dos hotéis originais (sem filtros aplicados)
        let hotels = [...SoltourApp.originalHotels];


        // FILTRO 1: Preço máximo
        // Só aplicar filtro se o usuário ajustou o slider (maxPrice diferente do absoluto)
        if (SoltourApp.filters.maxPrice < SoltourApp.filters.absoluteMaxPrice) {
            hotels = hotels.filter(pkg => {
                const price = getHotelPrice(pkg);
                // Incluir apenas pacotes com preço <= maxPrice selecionado
                return price <= SoltourApp.filters.maxPrice;
            });
        }

        // FILTRO 2: Estrelas selecionadas
        if (SoltourApp.filters.selectedStars.length > 0) {
            hotels = hotels.filter(pkg => {
                const hotelStars = getHotelStars(pkg);
                const isMatch = SoltourApp.filters.selectedStars.includes(hotelStars);
                return isMatch;
            });
        }

        // FILTRO 3: Regime Alimentar
        if (SoltourApp.filters.selectedMealPlans.length > 0) {
            hotels = hotels.filter(pkg => {
                const mealPlanCode = getHotelMealPlan(pkg);
                const isMatch = SoltourApp.filters.selectedMealPlans.includes(mealPlanCode);
                return isMatch;
            });
        }

        // ORDENAÇÃO
        hotels.sort((a, b) => {
            if (SoltourApp.filters.sortBy === 'price-asc') {
                // Menor preço primeiro
                return getHotelPrice(a) - getHotelPrice(b);
            } else if (SoltourApp.filters.sortBy === 'price-desc') {
                // Maior preço primeiro
                return getHotelPrice(b) - getHotelPrice(a);
            } else if (SoltourApp.filters.sortBy === 'stars-desc') {
                // Mais estrelas primeiro
                return getHotelStars(b) - getHotelStars(a);
            }
            return 0;
        });


        return hotels;
    }

    function getHotelPrice(pkg) {
        const budget = pkg.budget;
        if (budget.priceBreakdown && budget.priceBreakdown.priceBreakdownDetails &&
            budget.priceBreakdown.priceBreakdownDetails[0] &&
            budget.priceBreakdown.priceBreakdownDetails[0].priceInfo) {
            return budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.pvp || 0;
        }
        return 0;
    }

    function getHotelStars(pkg) {
        const budget = pkg.budget;
        const hotelService = budget.hotelServices && budget.hotelServices[0];

        if (!hotelService) return 0;

        let hotelStars = 0;
        const hotelFromAvailability = SoltourApp.hotelsFromAvailability[hotelService.hotelCode];

        // Usar a MESMA lógica da renderização dos cards
        if (hotelFromAvailability && hotelFromAvailability.categoryCode) {
            hotelStars = (hotelFromAvailability.categoryCode.match(/\*/g) || []).length;
        } else if (pkg.details && pkg.details.hotelDetails && pkg.details.hotelDetails.hotel && pkg.details.hotelDetails.hotel.categoryCode) {
            hotelStars = (pkg.details.hotelDetails.hotel.categoryCode.match(/\*/g) || []).length;
        }

        return hotelStars;
    }

    function getHotelMealPlan(pkg) {
        const budget = pkg.budget;
        const hotelService = budget.hotelServices && budget.hotelServices[0];

        if (!hotelService || !hotelService.mealPlan) return '';

        // Retornar o código do regime alimentar (TI, MP, PC, etc)
        return hotelService.mealPlan.code || '';
    }

    function setupPriceFilter() {
        // Encontrar o preço mínimo e máximo nos resultados
        let minPrice = Infinity;
        let maxPrice = 0;

        SoltourApp.originalHotels.forEach(pkg => {
            const price = getHotelPrice(pkg);
            if (price > 0) { // Só considerar preços válidos
                if (price < minPrice) {
                    minPrice = price;
                }
                if (price > maxPrice) {
                    maxPrice = price;
                }
            }
        });

        // O slider controla o PREÇO MÁXIMO que o usuário quer pagar
        // Para garantir que sempre apareça pelo menos o pacote mais barato:
        // 1. Arredondar o menor preço para CIMA (ex: 2970.54 → 2971)
        // 2. Adicionar 10 euros (2971 + 10 = 2981)
        // Assim quando slider no mínimo (2981), filtro price <= 2981 inclui pacote de 2971
        minPrice = Math.ceil(minPrice) + 10;

        // Arredondar máximo para cima (múltiplos de 100)
        maxPrice = Math.ceil(maxPrice / 100) * 100;

        // Configurar o slider
        const $slider = $('#soltour-max-price');
        if ($slider.length) {
            $slider.attr('min', minPrice);
            $slider.attr('max', maxPrice);
            $slider.val(maxPrice);
            SoltourApp.filters.minPrice = minPrice;
            SoltourApp.filters.maxPrice = maxPrice;
            SoltourApp.filters.absoluteMaxPrice = maxPrice; // Guardar o máximo absoluto
            $('#soltour-max-price-value').text(maxPrice.toLocaleString('pt-PT') + '€');
        }
    }

    function setupStarsFilter() {
        // Encontrar quais estrelas existem nos resultados
        const availableStars = new Set();

        SoltourApp.originalHotels.forEach(pkg => {
            const stars = getHotelStars(pkg);
            if (stars > 0) {
                availableStars.add(stars);
            }
        });


        // Mostrar/esconder checkboxes baseado nas estrelas disponíveis
        $('.soltour-star-filter input[type="checkbox"]').each(function() {
            const starValue = parseInt($(this).val());
            const $label = $(this).parent();

            if (availableStars.has(starValue)) {
                $label.show();
            } else {
                $label.hide();
                // Desmarcar se estava marcado
                $(this).prop('checked', false);
            }
        });

    }

    function setupMealPlanFilter() {
        // Encontrar quais regimes alimentares existem nos resultados
        const availableMealPlans = new Set();

        SoltourApp.originalHotels.forEach(pkg => {
            const mealPlanCode = getHotelMealPlan(pkg);
            if (mealPlanCode) {
                availableMealPlans.add(mealPlanCode);
            }
        });

        // Mostrar/esconder checkboxes baseado nos regimes disponíveis
        $('.soltour-meal-plan-filter input[type="checkbox"]').each(function() {
            const mealPlanValue = $(this).val();
            const $label = $(this).parent();

            if (availableMealPlans.has(mealPlanValue)) {
                $label.show();
            } else {
                $label.hide();
                // Desmarcar se estava marcado
                $(this).prop('checked', false);
            }
        });
    }

    function showSkeletonCards() {
        const $list = $('#soltour-results-list');
        $list.empty();

        // Mostrar 10 skeleton cards com barra de loading
        for (let i = 0; i < 10; i++) {
            const skeleton = `
                <div class="soltour-package-card skeleton-card">
                    <div class="package-image skeleton-shimmer">
                        <div class="skeleton-loading-bar">
                            <div class="skeleton-loading-progress"></div>
                        </div>
                    </div>
                    <div class="package-info">
                        <div class="skeleton-line skeleton-shimmer" style="width: 60%; height: 20px; margin-bottom: 12px;"></div>
                        <div class="skeleton-line skeleton-shimmer" style="width: 85%; height: 26px; margin-bottom: 12px;"></div>
                        <div class="skeleton-line skeleton-shimmer" style="width: 45%; height: 18px; margin-bottom: 16px;"></div>
                        <div class="skeleton-line skeleton-shimmer" style="width: 75%; height: 16px; margin-bottom: 10px;"></div>
                        <div class="skeleton-line skeleton-shimmer" style="width: 70%; height: 16px;"></div>
                    </div>
                    <div class="package-price">
                        <div class="skeleton-line skeleton-shimmer" style="width: 55%; height: 20px; margin-bottom: 12px;"></div>
                        <div class="skeleton-line skeleton-shimmer" style="width: 90%; height: 36px; margin-bottom: 16px;"></div>
                        <div class="skeleton-line skeleton-shimmer" style="width: 100%; height: 44px; border-radius: 12px;"></div>
                    </div>
                </div>
            `;
            $list.append(skeleton);
        }
    }

    function searchPackagesAjax() {

        // O modal já foi mostrado em initResultsPage(), não mostrar novamente aqui
        $('#soltour-results-loading').hide();

        // Buscar TODOS os resultados de uma vez (100 itens)
        const searchParamsWithLargeLimit = $.extend({}, SoltourApp.searchParams, {
            page_number: 0,
            rows_per_page: 100  // Buscar 100 budgets de uma vez
        });

        // ========================================
        // 🔍 DEBUG: Log detalhado da requisição
        // ========================================

        // Parse e exibir rooms de forma formatada
        let roomsData;
        try {
            roomsData = typeof searchParamsWithLargeLimit.rooms === 'string'
                ? JSON.parse(searchParamsWithLargeLimit.rooms)
                : searchParamsWithLargeLimit.rooms;


            roomsData.forEach((room, index) => {

                const adults = room.passengers.filter(p => p.type === 'ADULT');
                const children = room.passengers.filter(p => p.type === 'CHILD');

                if (adults.length > 0) {
                    adults.forEach((adult, i) => {
                    });
                }

                if (children.length > 0) {
                    children.forEach((child, i) => {
                    });
                }
            });

        } catch (e) {
        }


        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: searchParamsWithLargeLimit,
            success: function(response) {
                $('#soltour-results-loading').hide();

                // ========================================
                // 🔍 DEBUG: Log detalhado da resposta
                // ========================================

                if (response.success && response.data) {

                    if (response.data.budgets && response.data.budgets.length > 0) {
                    }
                } else {
                }


                if (response.success && response.data) {
                    SoltourApp.availToken = response.data.availToken;
                    SoltourApp.allBudgets = response.data.budgets || [];
                    SoltourApp.totalBudgets = response.data.totalCount || SoltourApp.allBudgets.length;

                    // Atualizar URL com state tracking
                    updateURLState(SoltourApp.availToken);


                    // Armazenar dados dos hotéis vindos do endpoint availability
                    if (response.data.hotels && Array.isArray(response.data.hotels)) {
                        SoltourApp.hotelsFromAvailability = {};
                        response.data.hotels.forEach(function(hotel) {
                            SoltourApp.hotelsFromAvailability[hotel.code] = hotel;
                        });
                    }

                    // ✈️ ARMAZENAR DADOS DOS VOOS vindos do endpoint availability
                    if (response.data.flights && Array.isArray(response.data.flights)) {
                        SoltourApp.flightsFromAvailability = {};
                        response.data.flights.forEach(function(flight) {
                            SoltourApp.flightsFromAvailability[flight.id] = flight;
                        });
                    }

                    if (SoltourApp.allBudgets.length > 0) {
                        // Deduplicar TODOS os budgets de uma vez
                        loadAllDetailsWithDeduplication(SoltourApp.allBudgets);
                    } else {
                        // Quando não há budgets, redirecionar para página de busca com mensagem

                        // Salvar mensagem no localStorage
                        localStorage.setItem('soltour_no_results_message', 'Não foram encontrados pacotes para o destino selecionado com a origem escolhida. Por favor, tente outra origem ou ajuste os critérios de busca.');

                        // Redirecionar para página de busca
                        const searchPageUrl = window.location.href.replace('/pacotes-resultados', '/buscar-pacotes');
                        window.location.href = searchPageUrl;
                        return;
                    }
                } else {
                    // Quando resposta não tem success, redirecionar para busca

                    localStorage.setItem('soltour_no_results_message', 'Ocorreu um erro na busca. Por favor, tente novamente com outros critérios.');

                    const searchPageUrl = window.location.href.replace('/pacotes-resultados', '/buscar-pacotes');
                    window.location.href = searchPageUrl;
                    return;
                }
            },
            error: function(xhr, status, error) {
                $('#soltour-results-loading').hide();

                // ========================================
                // 🔍 DEBUG: Log de erro
                // ========================================
                if (xhr.responseText) {
                    try {
                        const responseJson = JSON.parse(xhr.responseText);
                    } catch (e) {
                        // Response não é JSON válido
                    }
                }

                // Esconder modal em caso de erro
                hideLoadingModal();

                // Mostrar mensagem de erro com toast
                if (window.SoltourApp.Toast) {
                    window.SoltourApp.Toast.error('Erro ao buscar pacotes. Por favor, tente novamente.', 5000);
                }

                // Mostrar mensagem de erro
                alert('Ocorreu um erro ao buscar os pacotes. Por favor, tente novamente.');

            }
        });
    }

    /**
     * Nova função: Deduplicar TODOS os budgets e armazenar todos os hotéis únicos
     * Depois fazer paginação local
     */
    function loadAllDetailsWithDeduplication(budgets) {

        const uniqueBudgets = {};
        budgets.forEach(function(budget) {
            const hotelService = budget.hotelServices && budget.hotelServices[0];
            if (hotelService) {
                const hotelCode = hotelService.hotelCode;

                // Buscar o preço correto
                let price = 0;
                if (budget.priceBreakdown && budget.priceBreakdown.priceBreakdownDetails &&
                    budget.priceBreakdown.priceBreakdownDetails[0] &&
                    budget.priceBreakdown.priceBreakdownDetails[0].priceInfo) {
                    price = budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.pvp || 0;
                }

                if (!uniqueBudgets[hotelCode] || price < uniqueBudgets[hotelCode].price) {
                    uniqueBudgets[hotelCode] = {
                        budget: budget,
                        price: price
                    };
                }
            }
        });

        const uniqueBudgetsList = Object.values(uniqueBudgets).map(item => item.budget);

        // Se não há hotéis únicos após deduplicação, redirecionar para página de busca
        if (uniqueBudgetsList.length === 0) {

            localStorage.setItem('soltour_no_results_message', 'Não foram encontrados pacotes para o destino selecionado com a origem escolhida. Por favor, tente outra origem ou ajuste os critérios de busca.');

            const searchPageUrl = window.location.href.replace('/pacotes-resultados', '/buscar-pacotes');
            window.location.href = searchPageUrl;
            return;
        }

        let completed = 0;
        const tempEnrichedPackages = {};

        uniqueBudgetsList.forEach(function(budget) {
            const hotelService = budget.hotelServices && budget.hotelServices[0];
            if (!hotelService) {
                completed++;
                return;
            }

            const hotelCode = hotelService.hotelCode;
            const providerCode = hotelService.providerCode || 'UNDEFINED';

            $.ajax({
                url: soltourData.ajaxurl,
                type: 'POST',
                data: {
                    action: 'soltour_get_package_details',
                    nonce: soltourData.nonce,
                    avail_token: SoltourApp.availToken,
                    budget_id: budget.budgetId,
                    hotel_code: hotelCode,
                    provider_code: providerCode
                },
                success: function(response) {
                    if (response.success && response.data && response.data.hotelDetails) {
                        tempEnrichedPackages[hotelCode] = {
                            budget: budget,
                            details: response.data,
                            hotelCode: hotelCode
                        };
                    } else {
                        tempEnrichedPackages[hotelCode] = {
                            budget: budget,
                            details: null,
                            hotelCode: hotelCode
                        };
                    }

                    completed++;
                    if (completed === uniqueBudgetsList.length) {
                        // Armazenar TODOS os hotéis únicos deduplicados
                        SoltourApp.allUniqueHotels = Object.values(tempEnrichedPackages);
                        SoltourApp.originalHotels = [...SoltourApp.allUniqueHotels]; // Salvar cópia original

                        // Configurar filtro de preço baseado nos dados reais
                        setupPriceFilter();

                        // Configurar filtro de estrelas baseado nos dados reais
                        setupStarsFilter();

                        // Configurar filtro de regime alimentar baseado nos dados reais
                        setupMealPlanFilter();

                        // Resetar para página 1
                        SoltourApp.currentPage = 1;

                        // Renderizar primeira página (paginação local)
                        renderLocalPage(1);

                        // IMPORTANTE: Esconder modal de loading após renderizar
                        hideLoadingModal();

                        // ✅ PREÇOS JÁ CARREGADOS
                    }
                },
                error: function() {
                    tempEnrichedPackages[hotelCode] = {
                        budget: budget,
                        details: null,
                        hotelCode: hotelCode
                    };
                    completed++;
                    if (completed === uniqueBudgetsList.length) {
                        // Armazenar TODOS os hotéis únicos deduplicados
                        SoltourApp.allUniqueHotels = Object.values(tempEnrichedPackages);
                        SoltourApp.originalHotels = [...SoltourApp.allUniqueHotels]; // Salvar cópia original

                        // Configurar filtro de preço baseado nos dados reais
                        setupPriceFilter();

                        // Configurar filtro de estrelas baseado nos dados reais
                        setupStarsFilter();

                        // Configurar filtro de regime alimentar baseado nos dados reais
                        setupMealPlanFilter();

                        // Resetar para página 1
                        SoltourApp.currentPage = 1;

                        // Renderizar primeira página (paginação local)
                        renderLocalPage(1);

                        // IMPORTANTE: Esconder modal de loading após renderizar
                        hideLoadingModal();

                        // ✅ PREÇOS JÁ CARREGADOS
                    }
                }
            });
        });
    }

    function paginatePackagesAjax(pageNumber, rowsPerPage) {

        // Mostrar modal de carregamento durante paginação
        showLoadingModal(
            'Carregando mais pacotes...',
            'Aguarde enquanto buscamos mais opções'
        );

        showSkeletonCards();
        $('#soltour-results-loading').hide();

        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_paginate_packages',
                nonce: soltourData.nonce,
                avail_token: SoltourApp.availToken,
                page_number: pageNumber,
                rows_per_page: rowsPerPage,
                // Enviar parâmetros originais da busca
                origin_code: SoltourApp.searchParams.origin_code,
                destination_code: SoltourApp.searchParams.destination_code,
                start_date: SoltourApp.searchParams.start_date,
                num_nights: SoltourApp.searchParams.num_nights,
                rooms: SoltourApp.searchParams.rooms
            },
            success: function(response) {
                $('#soltour-results-loading').hide();


                if (response.success && response.data) {
                    // NÃO atualizar availToken - manter o mesmo da busca inicial
                    SoltourApp.allBudgets = response.data.budgets || [];

                    // Manter o totalCount original
                    if (response.data.totalCount) {
                        SoltourApp.totalBudgets = response.data.totalCount;
                    }


                    // Atualizar mapeamento de hotéis
                    if (response.data.hotels && Array.isArray(response.data.hotels)) {
                        response.data.hotels.forEach(function(hotel) {
                            SoltourApp.hotelsFromAvailability[hotel.code] = hotel;
                        });
                    }

                    if (SoltourApp.allBudgets.length > 0) {
                        loadPageDetailsWithDeduplication(SoltourApp.allBudgets);
                    } else {
                        alert('Nenhum pacote encontrado nesta página.');
                    }
                } else {
                    alert('Erro ao carregar página de resultados.');
                }
            },
            error: function(xhr, status, error) {
                $('#soltour-results-loading').hide();
                alert('Erro ao carregar página de resultados. Por favor, tente novamente.');
            }
        });
    }

    function loadPageDetailsWithDeduplication(budgets) {
        
        const uniqueBudgets = {};
        budgets.forEach(function(budget) {
            const hotelService = budget.hotelServices && budget.hotelServices[0];
            if (hotelService) {
                const hotelCode = hotelService.hotelCode;
                
                // Buscar o preço correto
                let price = 0;
                if (budget.priceBreakdown && budget.priceBreakdown.priceBreakdownDetails && 
                    budget.priceBreakdown.priceBreakdownDetails[0] && 
                    budget.priceBreakdown.priceBreakdownDetails[0].priceInfo) {
                    price = budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.pvp || 0;
                }
                
                if (!uniqueBudgets[hotelCode] || price < uniqueBudgets[hotelCode].price) {
                    uniqueBudgets[hotelCode] = {
                        budget: budget,
                        price: price
                    };
                }
            }
        });

        const uniqueBudgetsList = Object.values(uniqueBudgets).map(item => item.budget);

        let completed = 0;
        SoltourApp.enrichedPackages = {};

        uniqueBudgetsList.forEach(function(budget) {
            const hotelService = budget.hotelServices && budget.hotelServices[0];
            if (!hotelService) {
                completed++;
                return;
            }

            const hotelCode = hotelService.hotelCode;
            const providerCode = hotelService.providerCode || 'UNDEFINED';

            $.ajax({
                url: soltourData.ajaxurl,
                type: 'POST',
                data: {
                    action: 'soltour_get_package_details',
                    nonce: soltourData.nonce,
                    avail_token: SoltourApp.availToken,
                    budget_id: budget.budgetId,
                    hotel_code: hotelCode,
                    provider_code: providerCode
                },
                success: function(response) {
                    if (response.success && response.data && response.data.hotelDetails) {
                        SoltourApp.enrichedPackages[hotelCode] = {
                            budget: budget,
                            details: response.data,
                            hotelCode: hotelCode
                        };
                    } else {
                        SoltourApp.enrichedPackages[hotelCode] = {
                            budget: budget,
                            details: null,
                            hotelCode: hotelCode
                        };
                    }
                    
                    completed++;
                    if (completed === uniqueBudgetsList.length) {
                        SoltourApp.uniqueHotels = Object.values(SoltourApp.enrichedPackages);
                        renderPackageCards(SoltourApp.uniqueHotels);
                        renderPagination();
                    }
                },
                error: function() {
                    SoltourApp.enrichedPackages[hotelCode] = {
                        budget: budget,
                        details: null,
                        hotelCode: hotelCode
                    };
                    completed++;
                    if (completed === uniqueBudgetsList.length) {
                        SoltourApp.uniqueHotels = Object.values(SoltourApp.enrichedPackages);
                        renderPackageCards(SoltourApp.uniqueHotels);
                        renderPagination();
                    }
                }
            });
        });
    }

    function renderPackageCards(packages) {

        // Esconder modal de carregamento quando os resultados estiverem prontos
        hideLoadingModal();

        const $list = $('#soltour-results-list');
        $list.empty();

        if (packages.length === 0) {
            $list.html(`
                <div style="text-align: center; padding: 60px 20px; grid-column: 1 / -1;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📦</div>
                    <h3 style="color: #1a202c; font-size: 24px; margin-bottom: 12px;">Nenhum pacote para exibir</h3>
                    <p style="color: #6b7280; font-size: 16px;">Não há pacotes disponíveis nesta página</p>
                </div>
            `);
            return;
        }

        // ✈️ RENDERIZAR VOO RECOMENDADO NO TOPO

        if (SoltourApp.flightsFromAvailability && Object.keys(SoltourApp.flightsFromAvailability).length > 0) {

            // Pegar o primeiro voo disponível
            const firstFlightId = Object.keys(SoltourApp.flightsFromAvailability)[0];
            const firstFlight = SoltourApp.flightsFromAvailability[firstFlightId];


            if (firstFlight) {
                renderRecommendedFlightFromData(firstFlight);
            } else {
            }
        } else {

            // Tentar buscar de forma alternativa nos budgets (fallback)
            if (packages.length > 0 && packages[0].budget && packages[0].budget.flightServices) {
                renderRecommendedFlightFromData(packages[0].budget.flightServices);
            }
        }

        // Mostrar total de HOTÉIS ÚNICOS (não budgets)
        const totalUniqueHotels = SoltourApp.allUniqueHotels.length;
        $('#soltour-results-count').text(`${totalUniqueHotels} hotéis encontrados`);

        packages.forEach(function(pkg) {
            renderCompleteCard(pkg);
        });

    }

    /**
     * ✈️ Renderizar Box de Voo Recomendado no topo
     */
    function renderRecommendedFlight(flightServices) {

        if (!flightServices || flightServices.length === 0) {
            return;
        }

        // Separar voos de ida e volta
        const outboundFlight = flightServices.find(f => f.type === 'OUTBOUND');
        const inboundFlight = flightServices.find(f => f.type === 'INBOUND');

        if (!outboundFlight && !inboundFlight) {
            return;
        }

        // Helper para formatar horário
        function formatTime(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        }

        // Helper para formatar data
        function formatDate(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
        }

        let flightHTML = '';

        if (outboundFlight && outboundFlight.flightSegments && outboundFlight.flightSegments.length > 0) {
            const segments = outboundFlight.flightSegments;
            const firstSeg = segments[0];
            const lastSeg = segments[segments.length - 1];

            flightHTML += `
                <div class="flight-recommendation-item">
                    <div class="flight-direction">🛫 <strong>IDA</strong></div>
                    <div class="flight-details">
                        <div class="flight-route">
                            <span class="flight-time">${formatTime(firstSeg.departureDate)}</span>
                            <span class="flight-airport">${firstSeg.originAirportCode}</span>
                            <span class="flight-arrow">→</span>
                            <span class="flight-airport">${lastSeg.destinationAirportCode}</span>
                            <span class="flight-time">${formatTime(lastSeg.arrivalDate)}</span>
                        </div>
                        <div class="flight-airline">
                            ${firstSeg.operatingAirline || 'Companhia Aérea'} ${firstSeg.flightNumber || ''}
                            ${segments.length > 1 ? ` · ${segments.length - 1} escala${segments.length > 2 ? 's' : ''}` : ' · Direto'}
                        </div>
                    </div>
                </div>
            `;
        }

        if (inboundFlight && inboundFlight.flightSegments && inboundFlight.flightSegments.length > 0) {
            const segments = inboundFlight.flightSegments;
            const firstSeg = segments[0];
            const lastSeg = segments[segments.length - 1];

            flightHTML += `
                <div class="flight-recommendation-item">
                    <div class="flight-direction">🛬 <strong>VOLTA</strong></div>
                    <div class="flight-details">
                        <div class="flight-route">
                            <span class="flight-time">${formatTime(firstSeg.departureDate)}</span>
                            <span class="flight-airport">${firstSeg.originAirportCode}</span>
                            <span class="flight-arrow">→</span>
                            <span class="flight-airport">${lastSeg.destinationAirportCode}</span>
                            <span class="flight-time">${formatTime(lastSeg.arrivalDate)}</span>
                        </div>
                        <div class="flight-airline">
                            ${firstSeg.operatingAirline || 'Companhia Aérea'} ${firstSeg.flightNumber || ''}
                            ${segments.length > 1 ? ` · ${segments.length - 1} escala${segments.length > 2 ? 's' : ''}` : ' · Direto'}
                        </div>
                    </div>
                </div>
            `;
        }

        const flightBox = `
            <div class="recommended-flight-box" style="
                background: linear-gradient(135deg, #019CB8 0%, #0176a8 100%);
                color: #fff;
                padding: 25px;
                border-radius: 12px;
                margin-bottom: 30px;
                grid-column: 1 / -1;
                box-shadow: 0 4px 15px rgba(1, 156, 184, 0.3);
            ">
                <div style="margin-bottom: 15px;">
                    <strong style="font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                        ✈️ Voo Recomendado
                    </strong>
                </div>
                ${flightHTML}
            </div>
        `;

        $('#soltour-results-list').prepend(flightBox);
    }

    /**
     * ✈️ Renderizar Box de Voo Recomendado a partir dos dados do availability
     */
    function renderRecommendedFlightFromData(flightData) {
        try {

            if (!flightData) {
                return;
            }


            // Helper para formatar horário do formato HH:mm:ss
            function formatTime(timeStr) {
                if (!timeStr) return '';
                try {
                    // Se for formato HH:mm:ss, pegar só HH:mm
                    if (timeStr.includes(':')) {
                        const parts = timeStr.split(':');
                        return parts[0] + ':' + parts[1];
                    }
                    // Fallback para Date
                    const date = new Date(timeStr);
                    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                } catch (e) {
                    return timeStr;
                }
            }

            // Helper para formatar data no formato "23 nov"
            function formatDate(dateStr) {
                if (!dateStr) return '';
                try {
                    const date = new Date(dateStr);
                    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                    return date.getDate() + ' ' + months[date.getMonth()];
                } catch (e) {
                    return dateStr;
                }
            }

            // Mapeamento de códigos IATA para nomes de companhias
            const airlineNames = {
                '2W': 'World2Fly',
                'TP': 'TAP Air Portugal',
                'IB': 'Iberia',
                'UX': 'Air Europa',
                'VY': 'Vueling',
                'FR': 'Ryanair',
                'U2': 'easyJet',
                'LH': 'Lufthansa',
                'BA': 'British Airways',
                'AF': 'Air France',
                'KL': 'KLM'
            };

            function getAirlineName(code) {
                return airlineNames[code] || code;
            }

            // ESTRUTURA REAL DO SOLTOUR API: outboundSegments[] e returnSegments[]
            let outboundSegments = null;
            let inboundSegments = null;

            if (flightData.outboundSegments && Array.isArray(flightData.outboundSegments)) {
                outboundSegments = flightData.outboundSegments;
            }

            if (flightData.returnSegments && Array.isArray(flightData.returnSegments)) {
                inboundSegments = flightData.returnSegments;
            }


            // Se não encontrou segmentos, tentar renderizar box simples
            if (!outboundSegments && !inboundSegments) {

                // FALLBACK: Renderizar box simples com informação genérica
                const flightBox = `
                    <div class="recommended-flight-box" style="
                        background: linear-gradient(135deg, #019CB8 0%, #0176a8 100%);
                        color: #fff;
                        padding: 25px;
                        border-radius: 12px;
                        margin-bottom: 30px;
                        grid-column: 1 / -1;
                        box-shadow: 0 4px 15px rgba(1, 156, 184, 0.3);
                    ">
                        <div style="margin-bottom: 15px;">
                            <strong style="font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                                ✈️ Voo Incluído no Pacote
                            </strong>
                        </div>
                        <div class="flight-recommendation-item">
                            <div class="flight-details">
                                <div class="flight-route" style="text-align: center; padding: 10px;">
                                    Informações de voo disponíveis na página de reserva
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const $list = $('#soltour-results-list');

                if ($list.length > 0) {
                    $list.prepend(flightBox);
                }
                return;
            }

            let flightHTML = '';

            // Renderizar IDA (OUTBOUND)
            if (outboundSegments && outboundSegments.length > 0) {

                const firstSeg = outboundSegments[0];
                const lastSeg = outboundSegments[outboundSegments.length - 1];
                const airlineName = getAirlineName(firstSeg.operatingCompanyCode);
                const stopInfo = outboundSegments.length > 1 ? `${outboundSegments.length - 1} escala${outboundSegments.length > 2 ? 's' : ''}` : 'Voo direto';

                flightHTML += `
                    <div class="flight-card-ida" style="background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 100%; box-sizing: border-box; overflow: hidden;">
                        <div style="display: flex; align-items: center; margin-bottom: 18px;">
                            <div style="background: #f0f9fb; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 20px;">
                                ✈️
                            </div>
                            <div>
                                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600; margin-bottom: 3px;">Voo de Ida</div>
                                <div style="font-size: 14px; font-weight: 600; color: #1a202c;">${formatDate(firstSeg.departureDate)}</div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                            <div style="text-align: left; flex: 1; min-width: 0;">
                                <div class="flight-time" style="font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 6px; color: #1a202c;">${formatTime(firstSeg.departureTime)}</div>
                                <div style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px; color: #019CB8;">${firstSeg.originAirport}</div>
                            </div>

                            <div style="text-align: center; padding: 0 15px; flex-shrink: 0;">
                                <div style="color: #019CB8; font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 6px;">→</div>
                                <div style="font-size: 11px; color: #6b7280; font-weight: 500; white-space: nowrap;">${stopInfo}</div>
                            </div>

                            <div style="text-align: right; flex: 1; min-width: 0;">
                                <div class="flight-time" style="font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 6px; color: #1a202c;">${formatTime(lastSeg.arrivalTime)}</div>
                                <div style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px; color: #019CB8;">${lastSeg.destinationAirport}</div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                            <svg style="width: 20px; height: 20px; margin-right: 10px; color: #019CB8; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
                            </svg>
                            <div style="min-width: 0; overflow: hidden;">
                                <div style="font-size: 15px; font-weight: 600; color: #1a202c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${airlineName}</div>
                                <div style="font-size: 13px; color: #6b7280;">Voo ${firstSeg.flightNumber || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Renderizar VOLTA (INBOUND)
            if (inboundSegments && inboundSegments.length > 0) {

                const firstSeg = inboundSegments[0];
                const lastSeg = inboundSegments[inboundSegments.length - 1];
                const airlineName = getAirlineName(firstSeg.operatingCompanyCode);
                const stopInfo = inboundSegments.length > 1 ? `${inboundSegments.length - 1} escala${inboundSegments.length > 2 ? 's' : ''}` : 'Voo direto';

                flightHTML += `
                    <div class="flight-card-volta" style="background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 100%; box-sizing: border-box; overflow: hidden;">
                        <div style="display: flex; align-items: center; margin-bottom: 18px;">
                            <div style="background: #f0f9fb; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 20px; transform: rotate(180deg);">
                                ✈️
                            </div>
                            <div>
                                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600; margin-bottom: 3px;">Voo de Volta</div>
                                <div style="font-size: 14px; font-weight: 600; color: #1a202c;">${formatDate(firstSeg.departureDate)}</div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                            <div style="text-align: left; flex: 1; min-width: 0;">
                                <div class="flight-time" style="font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 6px; color: #1a202c;">${formatTime(firstSeg.departureTime)}</div>
                                <div style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px; color: #019CB8;">${firstSeg.originAirport}</div>
                            </div>

                            <div style="text-align: center; padding: 0 15px; flex-shrink: 0;">
                                <div style="color: #019CB8; font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 6px;">→</div>
                                <div style="font-size: 11px; color: #6b7280; font-weight: 500; white-space: nowrap;">${stopInfo}</div>
                            </div>

                            <div style="text-align: right; flex: 1; min-width: 0;">
                                <div class="flight-time" style="font-size: 24px; font-weight: 700; line-height: 1; margin-bottom: 6px; color: #1a202c;">${formatTime(lastSeg.arrivalTime)}</div>
                                <div style="font-size: 16px; font-weight: 600; letter-spacing: 0.5px; color: #019CB8;">${lastSeg.destinationAirport}</div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                            <svg style="width: 20px; height: 20px; margin-right: 10px; color: #019CB8; flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
                            </svg>
                            <div style="min-width: 0; overflow: hidden;">
                                <div style="font-size: 15px; font-weight: 600; color: #1a202c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${airlineName}</div>
                                <div style="font-size: 13px; color: #6b7280;">Voo ${firstSeg.flightNumber || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            if (!flightHTML) {
                return;
            }

            const flightBox = `
                <div class="recommended-flight-box" style="
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    padding: 30px;
                    border-radius: 16px;
                    margin-bottom: 30px;
                    grid-column: 1 / -1;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                    max-width: 100%;
                    box-sizing: border-box;
                    overflow: hidden;
                ">
                    <div style="margin-bottom: 25px;">
                        <div style="font-size: 22px; font-weight: 700; letter-spacing: 0.3px; color: #1a202c;">✈️ Voos Incluídos</div>
                        <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Ida e volta confirmados no pacote</div>
                    </div>
                    ${flightHTML}
                </div>
            `;

            const $list = $('#soltour-results-list');

            if ($list.length > 0) {
                $list.prepend(flightBox);
            } else {
            }

        } catch (error) {
        }
    }

    function renderCompleteCard(pkg) {
        const $list = $('#soltour-results-list');
        const budget = pkg.budget;
        const details = pkg.details;
        const hotelService = budget.hotelServices && budget.hotelServices[0];
        const flightService = budget.flightServices && budget.flightServices[0];

        // ========================================
        // EXTRAIR QUARTOS DISPONÍVEIS
        // ========================================
        let availableRooms = [];
        if (hotelService && hotelService.mealPlan && hotelService.mealPlan.combination && hotelService.mealPlan.combination.rooms) {
            availableRooms = hotelService.mealPlan.combination.rooms;
        }

        // 🚫 FILTRAR: Se não há quartos disponíveis, não renderizar o card
        if (!availableRooms || availableRooms.length === 0) {
            return;
        }

        // (A) IMAGENS - COLETAR TODAS PARA SLIDER
        let hotelImages = [];
        if (hotelService && hotelService.hotelCode && SoltourApp.hotelsFromAvailability[hotelService.hotelCode]) {
            const hotelFromAvail = SoltourApp.hotelsFromAvailability[hotelService.hotelCode];

            // Adicionar mainImage primeiro
            if (hotelFromAvail.mainImage) {
                hotelImages.push(hotelFromAvail.mainImage);
            }
            // Adicionar demais imagens do multimedias
            if (hotelFromAvail.multimedias && hotelFromAvail.multimedias.length > 0) {
                hotelFromAvail.multimedias.forEach(m => {
                    if (m.type === 'IMAGE' && m.url && !hotelImages.includes(m.url)) {
                        hotelImages.push(m.url);
                    }
                });
            }
        }
        // Fallback para details
        if (hotelImages.length === 0 && details && details.hotelDetails && details.hotelDetails.hotel && details.hotelDetails.hotel.multimedias) {
            details.hotelDetails.hotel.multimedias.forEach(m => {
                if (m.type === 'IMAGE' && m.url) {
                    hotelImages.push(m.url);
                }
            });
        }
        // Limitar a 10 imagens
        hotelImages = hotelImages.slice(0, 10);

        // (B) PAÍS e (C) CIDADE - PRIORIZAR AVAILABILITY
        let country = '';
        let city = '';
        let destinationCode = '';

        if (hotelService && hotelService.hotelCode && SoltourApp.hotelsFromAvailability[hotelService.hotelCode]) {
            const hotelFromAvail = SoltourApp.hotelsFromAvailability[hotelService.hotelCode];
            destinationCode = hotelFromAvail.destinationCode || '';
            // Se houver destinationDescription, usar diretamente
            if (hotelFromAvail.destinationDescription) {
                city = hotelFromAvail.destinationDescription;
            }
            const destInfo = DESTINATIONS_MAP[destinationCode];
            if (destInfo) {
                country = destInfo.country;
                if (!city) city = destInfo.city;
            }
        }
        // Fallback para details
        else if (details && details.hotelDetails && details.hotelDetails.hotel) {
            destinationCode = details.hotelDetails.hotel.destinationCode || '';
            const destInfo = DESTINATIONS_MAP[destinationCode];
            if (destInfo) {
                country = destInfo.country;
                city = destInfo.city;
            }
        }

        // (D) NOME DO HOTEL - APENAS DO AVAILABILITY (sem fallback para details)
        let hotelName = '';
        let hotelCode = pkg.hotelCode || 'N/A';

        // Apenas pegar do availability (nomes limpos sem tags)
        if (hotelService && hotelService.hotelCode && SoltourApp.hotelsFromAvailability[hotelService.hotelCode]) {
            const hotelFromAvail = SoltourApp.hotelsFromAvailability[hotelService.hotelCode];
            hotelName = hotelFromAvail.name || '';
            hotelCode = hotelFromAvail.code || hotelCode;
        }

        // Se não houver nome no availability, não renderizar o card
        if (!hotelName) {
            return;
        }

        // (E) ESTRELAS - PRIORIZAR AVAILABILITY
        let hotelStars = 0;
        if (hotelService && hotelService.hotelCode && SoltourApp.hotelsFromAvailability[hotelService.hotelCode]) {
            const hotelFromAvail = SoltourApp.hotelsFromAvailability[hotelService.hotelCode];
            if (hotelFromAvail.categoryCode) {
                hotelStars = (hotelFromAvail.categoryCode.match(/\*/g) || []).length;
            }
        }
        // Fallback para details
        else if (details && details.hotelDetails && details.hotelDetails.hotel && details.hotelDetails.hotel.categoryCode) {
            hotelStars = (details.hotelDetails.hotel.categoryCode.match(/\*/g) || []).length;
        }

        // (F) ORIGEM DO VOO
        let originCity = '';
        if (SoltourApp.searchParams.origin_code) {
            originCity = ORIGINS_MAP[SoltourApp.searchParams.origin_code] || SoltourApp.searchParams.origin_code;
        }

        // (G) NOITES
        let numNights = SoltourApp.searchParams.num_nights || 7;
        if (hotelService && hotelService.startDate && hotelService.endDate) {
            const start = new Date(hotelService.startDate);
            const end = new Date(hotelService.endDate);
            numNights = Math.round((end - start) / (1000 * 60 * 60 * 24));
        }

        // (H) REGIME
        let mealPlan = '';
        if (hotelService && hotelService.mealPlan) {
            mealPlan = hotelService.mealPlan.description || hotelService.mealPlan.code || '';
        }

        // (I) JANELA DE TEMPORADA (simplificado - usar datas da busca)
        let seasonWindow = '';
        if (hotelService && hotelService.startDate && hotelService.endDate) {
            const startDate = new Date(hotelService.startDate);
            const endDate = new Date(hotelService.endDate);
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            seasonWindow = `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;
        }

        // (J) INFORMAÇÕES DE VOO DETALHADAS
        let flightInfoHTML = '';
        if (budget.flightServices && budget.flightServices.length > 0) {
            budget.flightServices.forEach(function(flight) {
                if (flight.segments && flight.segments.length > 0) {
                    const segment = flight.segments[0]; // Primeiro segmento
                    const origin = segment.origin || '';
                    const destination = segment.destination || '';
                    const departureTime = segment.departureTime ? segment.departureTime.substring(0, 5) : '--:--';
                    const arrivalTime = segment.arrivalTime ? segment.arrivalTime.substring(0, 5) : '--:--';
                    const airline = segment.carrierName || segment.carrier || '';
                    const carrierCode = segment.carrier || '';
                    const flightType = flight.type === 'OUTBOUND' ? 'Saída' : 'Regresso';

                    // Logo da companhia aérea
                    // Pode vir da API ou construímos a URL baseada no código IATA
                    let airlineLogo = segment.carrierLogo || segment.carrierImageUrl || '';
                    if (!airlineLogo && carrierCode) {
                        // Fallback: usar serviço de logos de companhias aéreas
                        airlineLogo = `https://images.kiwi.com/airlines/64/${carrierCode}.png`;
                    }

                    flightInfoHTML += `
                        <div class="flight-info-compact">
                            <span class="flight-type">${flightType}</span>
                            ${airlineLogo ? `<img src="${airlineLogo}" alt="${airline}" class="airline-logo" onerror="this.style.display='none'" />` : ''}
                            <span class="flight-airline">${airline}</span>
                            <span class="flight-times">${departureTime} - ${arrivalTime}</span>
                            <span class="flight-route">${origin} → ${destination}</span>
                        </div>
                    `;
                }
            });
        }

        // (K) PREÇO - CORRETO!
        let price = 0;
        let currency = 'EUR';
        if (budget.priceBreakdown && budget.priceBreakdown.priceBreakdownDetails &&
            budget.priceBreakdown.priceBreakdownDetails[0] &&
            budget.priceBreakdown.priceBreakdownDetails[0].priceInfo) {
            price = budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.pvp || 0;
            currency = budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.currency || 'EUR';
        }

        // (K.1) NÚMERO DE PASSAGEIROS - para calcular preço por pessoa
        let numPassengers = 0;
        if (hotelService && hotelService.mealPlan && hotelService.mealPlan.combination && hotelService.mealPlan.combination.rooms) {
            hotelService.mealPlan.combination.rooms.forEach(room => {
                if (room.passengers) {
                    numPassengers += room.passengers.length;
                }
            });
        }
        // Fallback: usar dados da busca original (searchParams.rooms)
        if (numPassengers === 0 && SoltourApp.searchParams && SoltourApp.searchParams.rooms) {
            try {
                const rooms = typeof SoltourApp.searchParams.rooms === 'string'
                    ? JSON.parse(SoltourApp.searchParams.rooms)
                    : SoltourApp.searchParams.rooms;

                rooms.forEach(room => {
                    if (room.passengers) {
                        numPassengers += room.passengers.length;
                    }
                });
            } catch (e) {
            }
        }
        // Último fallback: garantir pelo menos 2 passageiros (mínimo razoável)
        if (numPassengers === 0) numPassengers = 2;

        // (K.2) PREÇO POR PESSOA
        const pricePerPerson = price / numPassengers;

        // (L) DESCRIÇÃO DO HOTEL
        let hotelDescriptionFull = '';
        let hotelDescriptionShort = '';
        let hasMoreDescription = false;
        if (hotelService && hotelService.hotelCode && SoltourApp.hotelsFromAvailability[hotelService.hotelCode]) {
            const hotelFromAvail = SoltourApp.hotelsFromAvailability[hotelService.hotelCode];
            hotelDescriptionFull = hotelFromAvail.description || hotelFromAvail.shortDescription || '';
            // Criar versão truncada a 150 caracteres
            if (hotelDescriptionFull.length > 150) {
                hotelDescriptionShort = hotelDescriptionFull.substring(0, 150) + '...';
                hasMoreDescription = true;
            } else {
                hotelDescriptionShort = hotelDescriptionFull;
            }
        }

        // (M) TIPO
        const productType = 'PACOTE';

        // Construir slider de imagens
        let sliderHTML = '';
        if (hotelImages.length > 0) {
            sliderHTML = `
                <div class="package-image-slider">
                    <div class="slider-images">
                        ${hotelImages.map((img, index) => `
                            <img src="${img}" alt="${hotelName}" class="slider-image ${index === 0 ? 'active' : ''}" />
                        `).join('')}
                    </div>
                    ${hotelImages.length > 1 ? `
                        <button class="slider-btn slider-prev" onclick="SoltourApp.changeSlide(this, -1)">❮</button>
                        <button class="slider-btn slider-next" onclick="SoltourApp.changeSlide(this, 1)">❯</button>
                        <div class="slider-dots">
                            ${hotelImages.map((_, index) => `
                                <span class="slider-dot ${index === 0 ? 'active' : ''}" onclick="SoltourApp.goToSlide(this, ${index})"></span>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="package-badge">${productType}</div>
                </div>
            `;
        } else {
            sliderHTML = `
                <div class="package-image">
                    <div class="no-image">📷 Sem imagem</div>
                    <div class="package-badge">${productType}</div>
                </div>
            `;
        }

        // Construir card
        const card = `
            <div class="soltour-package-card" data-budget-id="${budget.budgetId}">
                ${sliderHTML}
                <div class="package-info">
                    <div class="package-location">
                        <strong>${country}</strong>
                        <span class="package-city">${city}</span>
                    </div>
                    <h3 class="package-name">${hotelName}</h3>
                    <div class="package-stars">
                        ${hotelStars > 0 ? '⭐'.repeat(hotelStars) : '<span class="no-rating">Hotel</span>'}
                    </div>
                    ${hotelDescriptionShort ? `
                        <div class="package-description">
                            <p class="description-text">
                                <span class="description-short">${hotelDescriptionShort}</span>
                                ${hasMoreDescription ? `
                                    <span class="description-full" style="display: none;">${hotelDescriptionFull}</span>
                                    <a href="javascript:void(0)" class="read-more-btn" onclick="SoltourApp.toggleDescription(this)">ler mais</a>
                                ` : ''}
                            </p>
                        </div>
                    ` : ''}
                    ${flightInfoHTML ? `
                        <div class="package-flights">
                            ${flightInfoHTML}
                        </div>
                    ` : ''}
                    <div class="package-details">
                        <p>🌙 ${numNights} Noites | ${mealPlan}</p>
                        ${seasonWindow ? `<p>📅 ${seasonWindow}</p>` : ''}
                    </div>

                    <!-- QUARTOS DISPONÍVEIS -->
                    <div class="available-rooms-section">
                        <h4 class="rooms-title">🛏️ Quartos Disponíveis</h4>
                        <div class="rooms-list" data-budget-id="${budget.budgetId}">
                            ${availableRooms.map((room, index) => {
                                const roomDescription = room.description || 'Quarto';
                                const numRoomPassengers = room.passengers ? room.passengers.length : 0;
                                // GARANTIR ESPAÇO ENTRE NÚMERO E PALAVRA
                                const passageiroText = numRoomPassengers > 1 ? 'passageiros' : 'passageiro';
                                const paxLabel = numRoomPassengers + ' ' + passageiroText;
                                const roomCode = room.roomCode || '';
                                const maxRooms = SoltourApp.numRoomsSearched || 1;
                                // Pre-selecionar os N primeiros quartos automaticamente
                                const isAutoSelected = index < maxRooms;

                                // Debug log
                                if (index === 0) {
                                }

                                return `
                                    <div class="room-option ${isAutoSelected ? 'selected' : ''}"
                                         data-room-code="${roomCode}"
                                         data-room-index="${index}"
                                         data-room-data='${JSON.stringify(room)}'
                                         onclick="SoltourApp.selectRoom('${budget.budgetId}', this)">
                                        <div class="room-info">
                                            <div class="room-name">${roomDescription}</div>
                                            <div class="room-occupancy"><span>👥</span> <span>${paxLabel}</span></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                <div class="package-price">
                    <div class="price-per-person">
                        <span class="price-label-small">desde</span>
                        <span class="price-amount-large">${pricePerPerson.toFixed(0)}€</span>
                        <span class="price-label-small">/ pax</span>
                    </div>
                    <div class="price-total">
                        <span class="price-total-label">Preço total</span>
                        <span class="price-total-amount">${price.toFixed(0)}€</span>
                    </div>
                    <button class="soltour-btn soltour-btn-primary"
                            style="padding: 20px 35px !important; border-radius: 100px !important; background: #019CB8 !important; color: #fff !important; border: none !important; font-size: 16px !important; font-weight: 700 !important; width: 100% !important;"
                            onclick="SoltourApp.selectPackage('${budget.budgetId}', '${hotelCode}', '${hotelService.providerCode || 'UNDEFINED'}')">
                        Selecionar
                    </button>
                </div>
            </div>
        `;
        $list.append(card);

        // Pre-selecionar automaticamente os N primeiros quartos
        const maxRooms = SoltourApp.numRoomsSearched || 1;


        if (availableRooms.length > 0) {
            // Inicializar como array vazio se não existir
            if (!SoltourApp.selectedRooms[budget.budgetId]) {
                SoltourApp.selectedRooms[budget.budgetId] = [];
            }

            // Pre-selecionar os primeiros N quartos
            SoltourApp.selectedRooms[budget.budgetId] = availableRooms.slice(0, maxRooms);

        }

        // Atualizar contador visual se houver múltiplos quartos
        if (maxRooms > 1) {
            const $card = $list.find('.soltour-package-card').last();
            updateRoomCounter($card, budget.budgetId, maxRooms);
        }
    }

    /**
     * Nova função: Renderizar uma página LOCAL dos hotéis únicos (slice do array)
     */
    function renderLocalPage(page) {

        SoltourApp.currentPage = page;

        // Calcular índices para slice
        const startIndex = (page - 1) * SoltourApp.itemsPerPage;
        const endIndex = startIndex + SoltourApp.itemsPerPage;

        // Pegar apenas os hotéis da página atual
        const hotelsForPage = SoltourApp.allUniqueHotels.slice(startIndex, endIndex);


        // Renderizar cards
        renderPackageCards(hotelsForPage);

        // Renderizar paginação
        renderPagination();

        // Scroll para o topo
        const $resultsList = $('#soltour-results-list');
        if ($resultsList.length > 0 && $resultsList.offset()) {
            $('html, body').animate({scrollTop: $resultsList.offset().top - 100}, 300);
        } else {
            $('html, body').animate({scrollTop: 0}, 300);
        }
    }

    function renderPagination() {
        // Calcular total de páginas baseado em hotéis ÚNICOS, não budgets
        const totalUniqueHotels = SoltourApp.allUniqueHotels.length;
        const totalPages = Math.ceil(totalUniqueHotels / SoltourApp.itemsPerPage);


        if (totalPages <= 1) {
            $('#soltour-pagination').hide();
            return;
        }

        let html = '<div class="pagination-controls">';

        // Seta Anterior
        if (SoltourApp.currentPage > 1) {
            html += `<button onclick="SoltourApp.loadPage(${SoltourApp.currentPage - 1})" class="pagination-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`;
        } else {
            html += `<button class="pagination-arrow disabled" disabled>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`;
        }

        // Dots para indicar páginas
        html += '<div class="pagination-dots">';
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === SoltourApp.currentPage ? 'active' : '';
            html += `<span class="pagination-dot ${activeClass}" onclick="SoltourApp.loadPage(${i})"></span>`;
        }
        html += '</div>';

        // Indicador de página atual
        html += `<div class="pagination-info">${SoltourApp.currentPage} / ${totalPages}</div>`;

        // Seta Próxima
        if (SoltourApp.currentPage < totalPages) {
            html += `<button onclick="SoltourApp.loadPage(${SoltourApp.currentPage + 1})" class="pagination-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`;
        } else {
            html += `<button class="pagination-arrow disabled" disabled>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>`;
        }

        html += '</div>';

        $('#soltour-pagination').html(html).show();
    }

    window.SoltourApp.loadPage = function(page) {

        // Usar paginação LOCAL - não fazer nova chamada à API
        // Todos os hotéis únicos já estão em SoltourApp.allUniqueHotels
        renderLocalPage(page);
    };

    window.SoltourApp.selectPackage = function(budgetId, hotelCode, providerCode) {

        // Verificar se venda está permitida ANTES de prosseguir
        checkAllowedSellingBeforeSelect(budgetId, hotelCode, providerCode);
    };

    /**
     * Verifica se venda está permitida antes de selecionar pacote
     * Implementa validação do site oficial
     */
    function checkAllowedSellingBeforeSelect(budgetId, hotelCode, providerCode) {

        showLoadingModal('Verificando disponibilidade...', 'Validando seu pacote');

        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_check_allowed_selling',
                nonce: soltourData.nonce
            },
            success: function(response) {
                if (response.success && response.data && response.data.allowed) {

                    // Permitir seleção do pacote
                    // NÃO esconder modal - será escondido na página de cotação após renderizar
                    proceedWithPackageSelection(budgetId, hotelCode, providerCode);

                } else {
                    // Venda não permitida - esconder modal e mostrar erro
                    hideLoadingModal();

                    const message = response.data && response.data.message
                        ? response.data.message
                        : 'Desculpe, este pacote não está disponível para venda no momento. Por favor, tente outro pacote ou entre em contato conosco.';


                    // Usar toast em vez de alert
                    if (window.SoltourApp.Toast) {
                        window.SoltourApp.Toast.error(message, 6000);
                    } else {
                        alert(message);
                    }
                }
            },
            error: function(xhr, status, error) {
                // Em caso de erro, permitir continuar (fail-safe)
                // NÃO esconder modal - será escondido na página de cotação após renderizar
                // Pode mudar para fail-secure se preferir
                proceedWithPackageSelection(budgetId, hotelCode, providerCode);
            }
        });
    }

    /**
     * Prossegue com seleção do pacote após validação
     */
    function proceedWithPackageSelection(budgetId, hotelCode, providerCode) {


        // Buscar o pacote completo do array de resultados
        const fullPackage = SoltourApp.allUniqueHotels.find(pkg =>
            pkg.budget.budgetId === budgetId
        );

        if (!fullPackage) {
            alert('Erro: Pacote não encontrado. Por favor, tente novamente.');
            hideLoadingModal();
            return;
        }


        // Buscar quartos selecionados (já pre-selecionados automaticamente)
        const selectedRooms = SoltourApp.selectedRooms[budgetId] || [];
        const maxRooms = SoltourApp.numRoomsSearched || 1;


        // Validação simples - quartos já vêm pre-selecionados
        if (selectedRooms.length === 0) {
            hideLoadingModal();
            alert('Por favor, selecione um quarto antes de continuar.');
            return;
        }

        // Buscar informações do hotel do availability (não do hotelDetails!)
        const hotelInfo = SoltourApp.hotelsFromAvailability[hotelCode] || null;

        // Buscar informações dos voos do availability
        const firstFlightId = Object.keys(SoltourApp.flightsFromAvailability)[0];
        const flightData = SoltourApp.flightsFromAvailability[firstFlightId] || null;


        // Atualizar modal para indicar validação
        showLoadingModal('Validando pacote...', 'Por favor, aguarde enquanto validamos a disponibilidade');


        // ========================================
        // GERAÇÃO DE COTAÇÃO: Chamada direta ao endpoint /booking/quote
        // ========================================
        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_prepare_quote',
                nonce: soltourData.nonce,
                avail_token: SoltourApp.availToken,
                budget_id: budgetId,
                hotel_code: hotelCode,
                provider_code: providerCode
            },
            success: function(response) {

                if (response.success) {


                    // Salvar TODOS os dados no sessionStorage incluindo quote
                    const packageData = {
                        budgetId: budgetId,
                        hotelCode: hotelCode,
                        providerCode: providerCode,
                        availToken: SoltourApp.availToken,
                        budget: fullPackage.budget,           // Budget completo do availability
                        hotelInfo: hotelInfo,                 // Info do hotel do availability (NÃO hotelDetails)
                        flightData: flightData,               // Dados dos voos do availability (outboundSegments/returnSegments)
                        selectedRooms: selectedRooms,         // Array de quartos selecionados (múltiplos quartos)
                        selectedRoom: selectedRooms[0],       // Manter compatibilidade com código legado
                        numRoomsSearched: maxRooms,           // Número de quartos pesquisados
                        searchParams: SoltourApp.searchParams, // USAR searchParams COMPLETO que tem rooms

                        // DADOS DO QUOTE (da resposta /booking/quote)
                        quoteToken: response.data.quoteToken,
                        quoteData: response.data.quote
                    };

                    sessionStorage.setItem('soltour_selected_package', JSON.stringify(packageData));



                    // Redirecionar para página de cotação
                    window.location.href = `/cotacao/?budget=${budgetId}`;

                } else {
                    // Erro na validação


                    hideLoadingModal();

                    const errorMessage = response.data && response.data.message
                        ? response.data.message
                        : 'Este pacote não está mais disponível. Por favor, selecione outro.';


                    // Mostrar mensagem ao usuário
                    if (window.SoltourApp.Toast) {
                        window.SoltourApp.Toast.error(errorMessage, 8000);
                    } else {
                        alert(errorMessage);
                    }

                    // NÃO recarregar página - usuário já está nos resultados
                    // Deixar ele escolher outro pacote manualmente
                }
            },
            error: function(xhr, status, error) {

                hideLoadingModal();

                alert('Erro ao validar pacote. Por favor, tente novamente.\n\nSe o problema persistir, faça uma nova busca.');
            }
        });
    }

    /**
     * Função para alternar entre descrição curta e completa
     */
    window.SoltourApp.toggleDescription = function(btn) {
        const descriptionText = $(btn).closest('.description-text');
        const shortText = descriptionText.find('.description-short');
        const fullText = descriptionText.find('.description-full');

        if (fullText.is(':visible')) {
            // Mostrar texto curto
            fullText.hide();
            shortText.show();
            $(btn).text('ler mais');
        } else {
            // Mostrar texto completo
            shortText.hide();
            fullText.show();
            $(btn).text('ver menos');
        }
    };

    /**
     * Função para mudar slide do carousel
     */
    window.SoltourApp.changeSlide = function(btn, direction) {
        const slider = $(btn).closest('.package-image-slider');
        const images = slider.find('.slider-image');
        const dots = slider.find('.slider-dot');
        const currentIndex = images.filter('.active').index();
        let newIndex = currentIndex + direction;

        // Loop circular
        if (newIndex < 0) newIndex = images.length - 1;
        if (newIndex >= images.length) newIndex = 0;

        // Atualizar imagens
        images.removeClass('active').eq(newIndex).addClass('active');

        // Atualizar dots
        dots.removeClass('active').eq(newIndex).addClass('active');
    };

    /**
     * Função para ir para um slide específico
     */
    window.SoltourApp.goToSlide = function(dot, index) {
        const slider = $(dot).closest('.package-image-slider');
        const images = slider.find('.slider-image');
        const dots = slider.find('.slider-dot');

        // Atualizar imagens
        images.removeClass('active').eq(index).addClass('active');

        // Atualizar dots
        dots.removeClass('active').eq(index).addClass('active');
    };

    /**
     * Função para selecionar um quarto (SIMPLIFICADA)
     * Sempre mantém N quartos selecionados, permitindo troca simples
     */
    window.SoltourApp.selectRoom = function(budgetId, roomElement) {
        const $room = $(roomElement);
        const $roomsList = $room.closest('.rooms-list');
        const $card = $room.closest('.soltour-package-card');
        const roomData = JSON.parse($room.attr('data-room-data'));
        const roomIndex = parseInt($room.attr('data-room-index'));

        // Garantir que selectedRooms[budgetId] é um array
        if (!Array.isArray(SoltourApp.selectedRooms[budgetId])) {
            SoltourApp.selectedRooms[budgetId] = [];
        }

        const maxRooms = SoltourApp.numRoomsSearched || 1;
        const isSelected = $room.hasClass('selected');

        if (isSelected) {
            // Se clicar em um quarto já selecionado, não faz nada
            // (precisa manter N quartos selecionados sempre)
            return;
        }

        // Clicar em quarto não selecionado: trocar o último selecionado por este
        if (SoltourApp.selectedRooms[budgetId].length >= maxRooms) {
            // Remover o último quarto selecionado
            SoltourApp.selectedRooms[budgetId].pop();

            // Desmarcar visualmente o último
            const $allSelected = $roomsList.find('.room-option.selected');
            if ($allSelected.length > 0) {
                $allSelected.last().removeClass('selected');
            }
        }

        // Adicionar o novo quarto
        SoltourApp.selectedRooms[budgetId].push(roomData);
        $room.addClass('selected');

        // Atualizar contador visual
        if (maxRooms > 1) {
            updateRoomCounter($card, budgetId, maxRooms);
        }

    };

    /**
     * Atualizar contador visual de quartos selecionados
     */
    function updateRoomCounter($card, budgetId, maxRooms) {
        // Validar parâmetros
        if (!$card || $card.length === 0) {
            return;
        }

        if (!budgetId) {
            return;
        }

        // Garantir que selectedRooms[budgetId] é um array
        if (!Array.isArray(SoltourApp.selectedRooms[budgetId])) {
            SoltourApp.selectedRooms[budgetId] = [];
        }

        const selectedCount = SoltourApp.selectedRooms[budgetId].length;

        // Verificar se já existe contador, senão criar
        let $counter = $card.find('.room-selection-counter');
        if ($counter.length === 0) {
            // Adicionar contador após a lista de quartos
            const $roomsList = $card.find('.rooms-list');
            if ($roomsList.length > 0) {
                $counter = $('<div class="room-selection-counter"></div>');
                $roomsList.after($counter);
            } else {
                return;
            }
        }

        // Atualizar texto do contador
        if (maxRooms > 1) {
            $counter.html(`
                <div style="
                    padding: 12px 20px;
                    background: ${selectedCount === maxRooms ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'};
                    color: #fff;
                    border-radius: 8px;
                    text-align: center;
                    margin-top: 15px;
                    font-weight: 600;
                    font-size: 14px;
                ">
                    ${selectedCount === maxRooms ? '✓' : ''} Selecionados: ${selectedCount} de ${maxRooms} quarto${maxRooms > 1 ? 's' : ''}
                    ${selectedCount < maxRooms ? '<div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">Selecione mais ' + (maxRooms - selectedCount) + ' quarto' + (maxRooms - selectedCount > 1 ? 's' : '') + '</div>' : ''}
                </div>
            `);
            $counter.show();
        } else {
            $counter.hide();
        }
    }

})(jQuery);
