/**
 * Formulário de Busca Simplificado - BeautyTravel
 * Fluxo oficial Soltour: Destino + Origem + Mês → Cards → Modal → Resultados
 */

(function($) {
    'use strict';

    // Aguardar DOM ready
    $(document).ready(function() {

        if (typeof soltourData !== 'undefined') {
        } else {
            alert('Erro: Configuração do plugin não encontrada. Por favor, recarregue a página.');
            return;
        }

        initSimpleSearch();
    });

    /**
     * Inicializar formulário simplificado
     */
    function initSimpleSearch() {
        const $form = $('#soltour-search-form-simple');


        if ($form.length === 0) {
            return;
        }


        // Carregar destinos e origens
        loadDestinations();
        loadOrigins();

        // Bind submit
        $form.on('submit', function(e) {
            e.preventDefault();
            handleSimpleSearch();
        });
    }

    /**
     * Carregar lista de destinos
     */
    function loadDestinations() {

        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_get_destinations',
                nonce: soltourData.nonce
            },
            beforeSend: function() {
            },
            success: function(response) {

                if (response.success && response.data && response.data.destinations) {
                    populateDestinations(response.data.destinations);
                } else {
                    alert('Erro ao carregar destinos. Verifique o console para mais detalhes.');
                }
            },
            error: function(xhr, status, error) {
                alert('Erro de conexão ao carregar destinos: ' + error);
            }
        });
    }

    /**
     * Carregar lista de origens
     */
    function loadOrigins() {

        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_get_origins',
                nonce: soltourData.nonce
            },
            beforeSend: function() {
            },
            success: function(response) {

                if (response.success && response.data && response.data.origins) {
                    populateOrigins(response.data.origins);
                } else {
                    alert('Erro ao carregar origens. Verifique o console para mais detalhes.');
                }
            },
            error: function(xhr, status, error) {
                alert('Erro de conexão ao carregar origens: ' + error);
            }
        });
    }

    /**
     * Preencher select de destinos
     */
    function populateDestinations(destinations) {
        const $select = $('#soltour-destination-simple');


        if ($select.length === 0) {
            return;
        }

        destinations.forEach(function(dest) {
            $select.append(
                $('<option></option>')
                    .val(dest.code)
                    .text(dest.description || dest.name)
            );
        });

    }

    /**
     * Preencher select de origens
     */
    function populateOrigins(origins) {
        const $select = $('#soltour-origin-simple');


        if ($select.length === 0) {
            return;
        }

        origins.forEach(function(origin) {
            $select.append(
                $('<option></option>')
                    .val(origin.code)
                    .text(origin.description || origin.name)
            );
        });

    }

    /**
     * Processar busca simplificada
     */
    function handleSimpleSearch() {

        // Coletar dados do formulário
        const destination = $('#soltour-destination-simple').val();
        const origin = $('#soltour-origin-simple').val();
        const month = $('#soltour-month-simple').val();

        // Validar
        if (!destination || !origin || !month) {
            alert('⚠️ Por favor, preencha todos os campos!');
            return;
        }


        // Salvar parâmetros iniciais no sessionStorage
        sessionStorage.setItem('soltour_initial_search', JSON.stringify({
            destination: destination,
            origin: origin,
            month: month
        }));

        // Mostrar loading
        $('#soltour-search-loading').show();
        $('button[type="submit"]').prop('disabled', true);

        // Buscar cidades/destinos disponíveis
        fetchAvailableDestinations(destination, origin, month);
    }

    /**
     * Buscar destinos disponíveis (cidades) para o país selecionado
     */
    function fetchAvailableDestinations(destinationCode, originCode, month) {

        // Calcular primeira e última data do mês
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${year}-${monthNum}-${lastDay}`;

        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_search_packages',
                nonce: soltourData.nonce,
                destination_code: destinationCode,
                origin_code: originCode,
                start_date: startDate,
                num_nights: 7, // Default
                adults: 2, // Default
                children: 0,
                item_count: 100
            },
            success: function(response) {
                $('#soltour-search-loading').hide();
                $('button[type="submit"]').prop('disabled', false);


                if (response.success && response.data && response.data.budgets) {
                    // Extrair cidades únicas dos budgets
                    const cities = extractUniqueCities(response.data.budgets, response.data.hotels);

                    if (cities.length > 0) {
                        renderDestinationCards(cities);
                    } else {
                        alert('❌ Nenhum destino disponível para os parâmetros selecionados. Tente outras datas ou origens.');
                    }
                } else {
                    alert('❌ Erro ao buscar destinos. Por favor, tente novamente.');
                }
            },
            error: function(xhr, status, error) {
                $('#soltour-search-loading').hide();
                $('button[type="submit"]').prop('disabled', false);

                alert('❌ Erro de conexão. Por favor, tente novamente.');
            }
        });
    }

    /**
     * Extrair cidades únicas dos budgets
     */
    function extractUniqueCities(budgets, hotelsData) {
        const citiesMap = {};

        budgets.forEach(function(budget) {
            const hotelService = budget.hotelServices && budget.hotelServices[0];
            if (!hotelService) return;

            const hotelCode = hotelService.hotelCode;
            const hotel = hotelsData && hotelsData.find(h => h.code === hotelCode);

            if (hotel && hotel.destinationCode) {
                const cityCode = hotel.destinationCode;
                const cityName = hotel.destinationDescription || hotel.destinationName || 'Destino';
                const cityImage = hotel.mainImage || (hotel.multimedias && hotel.multimedias[0] && hotel.multimedias[0].url);

                if (!citiesMap[cityCode]) {
                    citiesMap[cityCode] = {
                        code: cityCode,
                        name: cityName,
                        image: cityImage,
                        hotelCount: 1,
                        minPrice: extractPrice(budget)
                    };
                } else {
                    citiesMap[cityCode].hotelCount++;
                    const price = extractPrice(budget);
                    if (price < citiesMap[cityCode].minPrice) {
                        citiesMap[cityCode].minPrice = price;
                    }
                }
            }
        });

        return Object.values(citiesMap);
    }

    /**
     * Extrair preço do budget
     */
    function extractPrice(budget) {
        if (budget.priceBreakdown && budget.priceBreakdown.priceBreakdownDetails &&
            budget.priceBreakdown.priceBreakdownDetails[0] &&
            budget.priceBreakdown.priceBreakdownDetails[0].priceInfo) {
            return budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.pvp || 0;
        }
        return 0;
    }

    /**
     * Renderizar cards de destinos
     */
    function renderDestinationCards(cities) {

        const $container = $('#soltour-cards-grid');
        $container.empty();

        cities.forEach(function(city) {
            const card = `
                <div class="bt-destination-card" data-city-code="${city.code}" data-city-name="${city.name}">
                    <div class="bt-card-image" style="background-image: url('${city.image || 'https://via.placeholder.com/400x300?text=' + encodeURIComponent(city.name)}')">
                        <div class="bt-card-overlay">
                            <div class="bt-card-price">
                                Desde <span>${city.minPrice > 0 ? city.minPrice.toFixed(0) + '€' : 'Consultar'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="bt-card-content">
                        <h4 class="bt-card-title">${city.name}</h4>
                        <p class="bt-card-hotels">
                            <i class="fas fa-hotel"></i>
                            ${city.hotelCount} ${city.hotelCount === 1 ? 'hotel disponível' : 'hotéis disponíveis'}
                        </p>
                        <button type="button" class="bt-btn-select-city">
                            Escolher Este Destino
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;

            $container.append(card);
        });

        // Mostrar container de cards
        $('#soltour-destination-cards').slideDown(400);

        // Scroll suave até os cards
        $('html, body').animate({
            scrollTop: $('#soltour-destination-cards').offset().top - 100
        }, 600);

        // Bind click nos cards
        bindCardClicks();

    }

    /**
     * Bind clicks nos cards de destinos
     */
    function bindCardClicks() {
        $('.bt-destination-card').off('click').on('click', function() {
            const cityCode = $(this).data('city-code');
            const cityName = $(this).data('city-name');


            // Pegar parâmetros iniciais
            const initialSearch = JSON.parse(sessionStorage.getItem('soltour_initial_search'));

            // Preparar dados do destino para o modal
            const destinationData = {
                code: cityCode,
                name: cityName,
                country: initialSearch.destination,
                originCode: initialSearch.origin,
                month: initialSearch.month
            };

            // Abrir modal de busca detalhada (que já existe!)
            if (window.BeautyTravelSearchModal) {
                window.BeautyTravelSearchModal.open(destinationData);
            } else {
                alert('Erro ao abrir modal. Por favor, recarregue a página.');
            }
        });
    }

})(jQuery);
