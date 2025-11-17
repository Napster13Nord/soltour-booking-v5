/**
 * Modal de Busca Detalhada - BeautyTravel
 * Popup que aparece ao clicar em um card de destino
 */

(function($) {
    'use strict';

    // Namespace global
    window.BeautyTravelSearchModal = {
        isOpen: false,
        currentDestination: null,

        /**
         * Abrir modal com dados pré-preenchidos
         */
        open: function(destinationData) {

            this.currentDestination = destinationData;
            this.isOpen = true;

            // Construir HTML do modal
            const modalHTML = this.buildModalHTML(destinationData);

            // Adicionar ao body se não existir
            if ($('#beauty-travel-search-modal').length === 0) {
                $('body').append(modalHTML);
            }

            // Mostrar modal
            $('#beauty-travel-search-modal').fadeIn(300);
            $('body').addClass('modal-open');

            // Inicializar campos
            this.initializeFields();

            // Bind eventos
            this.bindEvents();
        },

        /**
         * Construir HTML do modal
         */
        buildModalHTML: function(dest) {
            // Pegar origem do sessionStorage ou usar default
            const savedParams = sessionStorage.getItem('soltour_search_params');
            let originCode = 'LIS';
            let originName = 'Lisboa';

            if (savedParams) {
                try {
                    const params = JSON.parse(savedParams);
                    originCode = params.origin_code || 'LIS';
                    originName = params.origin_name || 'Lisboa';
                } catch (e) {}
            }

            return `
                <div id="beauty-travel-search-modal" class="bt-search-modal" style="display: none;">
                    <div class="bt-modal-overlay"></div>
                    <div class="bt-modal-container">
                        <button class="bt-modal-close" type="button">
                            <i class="fas fa-times"></i>
                        </button>

                        <div class="bt-modal-header">
                            <div class="bt-modal-badge">PACOTE</div>
                            <h2 class="bt-modal-title">${dest.cityName || dest.name}</h2>
                            <div class="bt-modal-price">Desde ${dest.minPrice || '1100'}€ p/p</div>
                        </div>

                        <div class="bt-modal-body">
                            <form id="bt-detailed-search-form">
                                <!-- Origem -->
                                <div class="bt-form-group">
                                    <label>Origem</label>
                                    <div class="bt-input-with-icon">
                                        <i class="fas fa-plane-departure"></i>
                                        <select name="origin" id="bt-modal-origin" required>
                                            <option value="${originCode}">${originName}</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Habitações e Passageiros -->
                                <div class="bt-form-group">
                                    <label>Habitações e passageiros</label>
                                    <div class="bt-input-with-icon clickable" id="bt-pax-selector">
                                        <i class="fas fa-users"></i>
                                        <input type="text" readonly value="1 habitação, 2 passageiros" id="bt-pax-display" />
                                    </div>
                                    <div id="bt-pax-dropdown" class="bt-dropdown" style="display: none;">
                                        <div class="bt-pax-config">
                                            <label>Habitações</label>
                                            <div class="bt-counter">
                                                <button type="button" class="bt-counter-btn" data-action="minus" data-target="rooms">-</button>
                                                <input type="number" name="rooms" id="bt-rooms" value="1" min="1" max="5" readonly />
                                                <button type="button" class="bt-counter-btn" data-action="plus" data-target="rooms">+</button>
                                            </div>
                                        </div>
                                        <div class="bt-pax-config">
                                            <label>Adultos</label>
                                            <div class="bt-counter">
                                                <button type="button" class="bt-counter-btn" data-action="minus" data-target="adults">-</button>
                                                <input type="number" name="adults" id="bt-adults" value="2" min="1" max="10" readonly />
                                                <button type="button" class="bt-counter-btn" data-action="plus" data-target="adults">+</button>
                                            </div>
                                        </div>
                                        <div class="bt-pax-config">
                                            <label>Crianças</label>
                                            <div class="bt-counter">
                                                <button type="button" class="bt-counter-btn" data-action="minus" data-target="children">-</button>
                                                <input type="number" name="children" id="bt-children" value="0" min="0" max="10" readonly />
                                                <button type="button" class="bt-counter-btn" data-action="plus" data-target="children">+</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Data de Saída -->
                                <div class="bt-form-group">
                                    <label>Data de saída</label>
                                    <div class="bt-input-with-icon">
                                        <i class="fas fa-calendar"></i>
                                        <input type="date" name="start_date" id="bt-start-date" required />
                                    </div>
                                </div>

                                <!-- Noites -->
                                <div class="bt-form-group">
                                    <label>Noites</label>
                                    <div class="bt-input-with-icon">
                                        <i class="fas fa-moon"></i>
                                        <input type="number" name="nights" id="bt-nights" value="7" min="1" max="30" required />
                                    </div>
                                </div>

                                <!-- Checkboxes -->
                                <div class="bt-form-group">
                                    <label class="bt-checkbox-label">
                                        <input type="checkbox" name="direct_flights" id="bt-direct-flights" />
                                        <span>Só voos diretos</span>
                                    </label>
                                </div>

                                <div class="bt-form-group">
                                    <label class="bt-checkbox-label">
                                        <input type="checkbox" name="alternative_dates" id="bt-alternative-dates" />
                                        <span>Procurar datas alternativas</span>
                                    </label>
                                </div>

                                <!-- Nota informativa -->
                                <p class="bt-modal-note">
                                    <i class="fas fa-info-circle"></i>
                                    Consulte as datas disponíveis e personalize a sua procura para determinar o preço final.
                                    Preço desde baseado em data pré-selecionada.
                                </p>

                                <!-- Botão Buscar -->
                                <button type="submit" class="bt-btn-search">
                                    <i class="fas fa-search"></i> Procurar
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Inicializar campos do formulário
         */
        initializeFields: function() {
            // Data mínima = hoje
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const minDate = tomorrow.toISOString().split('T')[0];
            $('#bt-start-date').attr('min', minDate).val(minDate);

            // Carregar origens via AJAX
            this.loadOrigins();
        },

        /**
         * Carregar lista de origens
         */
        loadOrigins: function() {
            const destinationCode = this.currentDestination.code || 'PUJ';

            $.ajax({
                url: soltourData.ajaxurl,
                type: 'POST',
                data: {
                    action: 'soltour_get_origins',
                    nonce: soltourData.nonce,
                    destination_code: destinationCode
                },
                success: function(response) {
                    if (response.success && response.data && response.data.origins) {
                        const $select = $('#bt-modal-origin');
                        $select.empty();
                        response.data.origins.forEach(function(origin) {
                            $select.append(`<option value="${origin.code}">${origin.name}</option>`);
                        });
                    }
                }
            });
        },

        /**
         * Bind eventos do modal
         */
        bindEvents: function() {
            const self = this;

            // Fechar modal
            $('#beauty-travel-search-modal').off('click').on('click', function(e) {
                if ($(e.target).hasClass('bt-modal-overlay') || $(e.target).hasClass('bt-modal-close') || $(e.target).closest('.bt-modal-close').length) {
                    self.close();
                }
            });

            // Toggle dropdown de passageiros
            $('#bt-pax-selector').off('click').on('click', function(e) {
                e.stopPropagation();
                $('#bt-pax-dropdown').slideToggle(200);
            });

            // Fechar dropdown ao clicar fora
            $(document).off('click.paxDropdown').on('click.paxDropdown', function(e) {
                if (!$(e.target).closest('#bt-pax-selector, #bt-pax-dropdown').length) {
                    $('#bt-pax-dropdown').slideUp(200);
                }
            });

            // Contadores
            $('.bt-counter-btn').off('click').on('click', function(e) {
                e.preventDefault();
                const action = $(this).data('action');
                const target = $(this).data('target');
                const $input = $(`#bt-${target}`);
                let value = parseInt($input.val());
                const min = parseInt($input.attr('min'));
                const max = parseInt($input.attr('max'));

                if (action === 'plus' && value < max) {
                    value++;
                } else if (action === 'minus' && value > min) {
                    value--;
                }

                $input.val(value);
                self.updatePaxDisplay();
            });

            // Submit do formulário
            $('#bt-detailed-search-form').off('submit').on('submit', function(e) {
                e.preventDefault();
                self.submitSearch();
            });
        },

        /**
         * Atualizar display de passageiros
         */
        updatePaxDisplay: function() {
            const rooms = parseInt($('#bt-rooms').val());
            const adults = parseInt($('#bt-adults').val());
            const children = parseInt($('#bt-children').val());

            const roomsText = rooms === 1 ? '1 habitação' : `${rooms} habitações`;
            const paxTotal = adults + children;
            const paxText = paxTotal === 1 ? '1 passageiro' : `${paxTotal} passageiros`;

            $('#bt-pax-display').val(`${roomsText}, ${paxText}`);
        },

        /**
         * Submeter busca
         */
        submitSearch: function() {

            // Coletar dados do formulário
            const originCode = $('#bt-modal-origin').val();
            const originName = $('#bt-modal-origin option:selected').text();
            const startDate = $('#bt-start-date').val();
            const nights = parseInt($('#bt-nights').val());
            const rooms = parseInt($('#bt-rooms').val());
            const adults = parseInt($('#bt-adults').val());
            const children = parseInt($('#bt-children').val());
            const directFlights = $('#bt-direct-flights').is(':checked');
            const alternativeDates = $('#bt-alternative-dates').is(':checked');

            // Construir objeto de busca
            const searchParams = {
                action: 'soltour_search_packages',
                nonce: soltourData.nonce,
                origin_code: originCode,
                origin_name: originName,
                destination_code: this.currentDestination.code,
                destination_name: this.currentDestination.name,
                city_name: this.currentDestination.cityName || this.currentDestination.name,
                start_date: startDate,
                num_nights: nights,
                rooms: rooms,
                adults: adults,
                children: children,
                direct_flights: directFlights,
                alternative_dates: alternativeDates,
                item_count: 100,
                product_type: 'PACKAGE',
                only_hotel: 'N'
            };

            // Salvar no sessionStorage
            sessionStorage.setItem('soltour_search_params', JSON.stringify(searchParams));

            // Fechar modal
            this.close();

            // Redirecionar para página de resultados
            window.location.href = '/pacotes-resultados/';
        },

        /**
         * Fechar modal
         */
        close: function() {
            $('#beauty-travel-search-modal').fadeOut(300, function() {
                $(this).remove();
            });
            $('body').removeClass('modal-open');
            this.isOpen = false;
        }
    };

})(jQuery);
