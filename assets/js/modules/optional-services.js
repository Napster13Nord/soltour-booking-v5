/**
 * Módulo Optional Services
 * Gerencia serviços opcionais (seguros, transfers, golf, bagagem, etc)
 *
 * Funcionalidades:
 * - Adicionar/remover serviços opcionais dinamicamente
 * - Atualização de preço em tempo real via API
 * - Atualização do breakdown (desglose)
 * - Persistência no availToken
 */

(function($) {
    'use strict';

    window.SoltourApp.OptionalServices = {
        /**
         * Inicializa eventos de serviços opcionais
         */
        init: function() {

            this.bindEvents();
            this.initBaggage();
            this.initGolf();
        },

        /**
         * Bind eventos gerais
         */
        bindEvents: function() {
            const self = this;

            // Checkboxes de serviços opcionais
            $(document.body).on('change', '.js-toggle-from-quote-summary', function() {
                const $this = $(this);
                self.toggleOptionalService($this);

                // Se é dinâmico (precisa chamar API), atualizar
                if ($this.data('isDynamic') == true || $this.data('is-dynamic') == 'true') {
                    self.updateOptionalService($this);
                }
            });
        },

        /**
         * Alterna serviço opcional no resumo
         * @param {jQuery} $element - Checkbox do serviço
         */
        toggleOptionalService: function($element) {
            const checked = $element.is(':checked');
            const code = $element.data('code');
            const summaryType = $element.data('summaryType') || $element.data('summary-type');
            const price = parseFloat($element.data('price')) || 0;


            // Encontrar row do serviço no resumo
            const $row = $('.js-optional-service' +
                          '[data-summary-type="' + summaryType + '"]' +
                          '[data-code="' + code + '"]');

            // Tratamento especial para transfers
            if (summaryType === 'transfer') {
                this.handleTransferToggle($element, checked);
            }

            // Tratamento especial para golf
            if (summaryType === 'golf') {
                $row.find('.js-breakdown-column').data('value', price);
                $row.find('.js-breakdown-column').html(price.toFixed(2) + '&nbsp;&euro;');
            }

            // Mostrar/ocultar row no resumo
            $row.toggleClass('u-display-none', !checked);

            // Atualizar total
            this.updateTotalAmount();

            // Atualizar containers
            this.toggleSummaryContainers();

            // Recalcular totais do breakdown
            this.calculateBreakdownTotals();
        },

        /**
         * Tratamento especial para transfers
         */
        handleTransferToggle: function($element, checked) {
            const code = $element.data('code');
            const description = $element.data('description');

            // Verificar quais transfers estão selecionados
            const toHotel = !!$('.js-toggle-from-quote-summary' +
                               '[data-summary-type="transfer"]' +
                               '[data-code^="AH"]:checked').length;

            const toAirport = !!$('.js-toggle-from-quote-summary' +
                                 '[data-summary-type="transfer"]' +
                                 '[data-code^="HA"]:checked').length;

            // Alternar entre coletivo e privado
            $('.js-summary-hotel-transfer')
                .find('.js-summary-collective-transfer')
                .toggleClass('u-display-none', toHotel);

            $('.js-summary-hotel-transfer')
                .find('.js-summary-private-transfer')
                .toggleClass('u-display-none', !toHotel);

            $('.js-summary-airport-transfer')
                .find('.js-summary-collective-transfer')
                .toggleClass('u-display-none', toAirport);

            $('.js-summary-airport-transfer')
                .find('.js-summary-private-transfer')
                .toggleClass('u-display-none', !toAirport);

            // Atualizar descrição no popover
            const popoverContainer = code.indexOf('AH') === 0
                ? '.js-summary-hotel-transfer'
                : '.js-summary-airport-transfer';

            $(popoverContainer)
                .find('.js-summary-transfer-popover')
                .html(description);

            // Atualizar totais de cancelamento se dinâmico
            if ($element.data('isDynamic') == 'true' || $element.data('is-dynamic') == 'true') {
                this.updateTransferCancelTotals(checked, $element.data('price'));
            }
        },

        /**
         * Atualiza totais de cancelamento de transfer
         */
        updateTransferCancelTotals: function(checked, addPrice) {
            $('.js-cancellationCharges-transfer').each(function() {
                let priceText = this.innerHTML.match(/<strong>\d+\,?\d*<\/strong>/g);
                if (!priceText || !priceText[0]) return;

                let price = parseFloat(
                    priceText[0].substring(8, priceText[0].length - 9).replace(',', '.')
                );

                let newPrice;
                if (checked) {
                    newPrice = '<strong>' +
                              (price + parseFloat(addPrice)).toString().replace('.', ',') +
                              '</strong>';
                } else {
                    newPrice = '<strong>' +
                              (price - parseFloat(addPrice)).toString().replace('.', ',') +
                              '</strong>';
                }

                this.innerHTML = this.innerHTML.replace(/<strong>\d+\,?\d*<\/strong>/g, newPrice);
            });
        },

        /**
         * Atualiza serviço opcional via API
         * @param {jQuery} $element - Checkbox do serviço
         * @param {Object} updateRq - Request customizado (opcional, para golf)
         * @param {Function} callback - Callback após sucesso
         */
        updateOptionalService: function($element, updateRq, callback) {
            const self = this;

            let rq;

            if (updateRq) {
                // Request customizado (para golf)
                rq = {
                    availToken: window.SoltourApp.availToken,
                    serviceId: updateRq.id,
                    addService: updateRq.addService,
                    passengers: updateRq.passengers,
                    destinationCode: window.SoltourApp.searchParams.destinationCode ||
                                    window.SoltourApp.destinationCode
                };
            } else {
                // Request padrão
                rq = {
                    availToken: window.SoltourApp.availToken,
                    serviceId: $element.data('code'),
                    addService: $element.is(':checked'),
                    destinationCode: window.SoltourApp.searchParams.destinationCode ||
                                    window.SoltourApp.destinationCode
                };
            }


            showLoadingModal('Atualizando...', 'Recalculando preço');

            $.ajax({
                url: soltourData.ajaxurl,
                type: 'POST',
                data: {
                    action: 'soltour_update_optional_service',
                    nonce: soltourData.nonce,
                    service_data: JSON.stringify(rq)
                },
                timeout: 15000,
                success: function(response) {
                    hideLoadingModal();


                    if (response.success && response.data) {

                        // Atualizar availToken se mudou
                        if (response.data.availToken) {
                            window.SoltourApp.availToken = response.data.availToken;
                        }

                        // Atualizar total se fornecido
                        if (response.data.totalAmount) {
                            window.SoltourApp.totalAmount = response.data.totalAmount;
                            self.updateTotalAmount();
                        }

                        // Chamar callback se fornecido
                        if (callback && typeof callback === 'function') {
                            callback($element);
                        }

                        // Toast de sucesso
                        if (window.SoltourApp.Toast) {
                            window.SoltourApp.Toast.success(
                                'Serviço atualizado com sucesso!',
                                2000
                            );
                        }
                    } else {
                        // Erro da API - reverter checkbox
                        $element.prop('checked', !$element.is(':checked'));
                        self.toggleOptionalService($element);

                        const message = response.data && response.data.message
                            ? response.data.message
                            : 'Erro ao atualizar serviço. Tente novamente.';

                        if (window.SoltourApp.Toast) {
                            window.SoltourApp.Toast.error(message, 4000);
                        } else {
                            alert(message);
                        }
                    }
                },
                error: function(xhr, status, error) {
                    hideLoadingModal();

                    // Reverter checkbox
                    $element.prop('checked', !$element.is(':checked'));
                    self.toggleOptionalService($element);

                    if (window.SoltourApp.Toast) {
                        window.SoltourApp.Toast.error(
                            'Erro de conexão. Tente novamente.',
                            4000
                        );
                    } else {
                        alert('Erro de conexão');
                    }
                }
            });
        },

        /**
         * Atualiza total da cotação
         */
        updateTotalAmount: function() {
            let result = window.SoltourApp.baseAmount ||
                        window.SoltourApp.totalAmount ||
                        0;

            // Somar serviços opcionais selecionados
            $('.js-toggle-from-quote-summary:checked').each(function() {
                result += parseFloat($(this).data('price')) || 0;
            });

            // Somar equipagem
            $('.js-change-summary-baggage').each(function() {
                const code = $(this).val();
                if (code && window.SoltourApp.baggagePrices) {
                    result += window.SoltourApp.baggagePrices[code] || 0;
                }
            });

            // Somar golf
            $('.js-golf-toggle-from-quote-summary:checked').each(function() {
                result += parseFloat($(this).data('price')) || 0;
            });


            // Atualizar no DOM
            $('[data-js-total-amount]').each(function() {
                $(this).data('jsTotalAmount', result);
                $(this).html(result.toFixed(2) + ' &euro;');
            });

            // Atualizar na tabela de penalidades
            const $penaltiesTotal = $('#penaltiesTable tr:last-child td:last-child');
            if ($penaltiesTotal.length) {
                $penaltiesTotal.text(result.toFixed(2) + ' €');
            }

            // Atualizar variável global
            window.SoltourApp.totalAmount = result;
        },

        /**
         * Alterna containers do resumo
         */
        toggleSummaryContainers: function() {
            // Container de seguros
            const $insuranceContainer = $('.js-optional-services-container').filter(function() {
                return $(this).find('.js-optional-service[data-summary-type="insurance"]').length > 0;
            });

            if ($insuranceContainer.length &&
                $insuranceContainer.find('.js-optional-service:not(.u-display-none)').length) {
                $insuranceContainer.removeClass('u-display-none');
            }

            // Outros containers (exceto os que não devem ser ocultados)
            $('.js-optional-services-container:not(.js-dont-hide)')
                .not($insuranceContainer)
                .each(function() {
                    if ($(this).find('.js-optional-service:not(.u-display-none)').length) {
                        $(this).removeClass('u-display-none');
                    } else {
                        $(this).addClass('u-display-none');
                    }
                });
        },

        /**
         * Calcula totais do breakdown
         */
        calculateBreakdownTotals: function() {
            $('.js-breakdown-total').each(function() {
                const column = $(this).data('column');
                if (!column) return;

                let total = 0;

                $('.js-breakdown-row:not(.u-display-none) ' +
                  '.js-breakdown-column[data-column="' + column + '"]').each(function() {
                    total += parseFloat($(this).data('value')) || 0;

                    // Adicionar equipagem se presente
                    const $luggageTotal = $(this).find('[data-luggage-total]');
                    if ($luggageTotal.length) {
                        total += parseFloat($luggageTotal.data('luggageTotal')) || 0;
                    }
                });

                $(this).html(total.toFixed(2) + ' &euro;');
            });
        },

        /**
         * Inicializa equipagem adicional
         */
        initBaggage: function() {
            const self = this;

            $('.js-change-summary-baggage').on('change', function() {
                // Copiar código do provider
                const luggage = $(this).data("luggage");
                const luggageItem = $(this).data("luggage-item");
                const luggageItemCode = $('[data-luggage="' + luggage + '"]' +
                                          '[data-luggage-item="' + luggageItem + '"]' +
                                          '[data-luggage-item-code]').val();

                const providerCode = $('[data-luggage-code="' + luggageItemCode + '"]' +
                                      '[data-luggage-option="' + luggageItem + '"]' +
                                      '[data-luggage="' + luggage + '"]')
                                      .data("luggage-provider-code");

                $('[data-luggage="' + luggage + '"]' +
                  '[data-luggage-item="' + luggageItem + '"]' +
                  '[data-luggage-item-provider-code]').val(providerCode);

                self.updateTotalAmount();
            });

            $('.js-breakdown-baggage [data-luggage-total]').on('change', function() {
                const currentTotal = parseFloat($(this).data('luggageTotal')) || 0;
                $(this).closest('.js-breakdown-baggage')
                    .toggleClass('u-display-none', !currentTotal);
                self.calculateBreakdownTotals();
            });
        },

        /**
         * Inicializa extras de golf
         */
        initGolf: function() {
            const self = this;

            // Prevenir clique no select
            $('.js-extra-golf-select').on('click', function(e) {
                e.preventDefault();
            });

            // Checkbox de golf
            $('input[name="optionalGolf[]"]').on('change', function(e) {
                e.preventDefault();

                const $this = $(this);
                const $container = $this.parents('.js-extra-golf-container');
                const $data = $container.find('.js-extra-golf-total').data();

                // Validar número de jogadores
                if (parseInt($data.luggageQuantity, 10) === 0) {
                    const message = window.soltourData && window.soltourData.strings &&
                                  window.soltourData.strings.golfSelectPlayers
                        ? window.soltourData.strings.golfSelectPlayers
                        : 'Por favor, selecione o número de jogadores primeiro';

                    alert(message);
                    $this.prop('checked', '');
                    return;
                }

                // Preparar dados do golf
                const totalPrice = parseFloat($data.luggageTotal);
                $this.data('price', totalPrice);
                $container.find('.js-see-prices').addClass('disabled');

                const golfItem = $data.luggage;
                const $selected = $container.find('.js-extra-golf-selection[data-luggage="' +
                                                 golfItem + '"]');

                const selectedGolf = {
                    id: $(this).data('serviceId') || $(this).data('service-id'),
                    addService: $this.is(':checked'),
                    passengers: []
                };

                if ($this.is(':checked')) {
                    // Adicionar passageiros
                    $selected.each(function() {
                        const $elem = $(this);
                        const numPaxes = $elem.data('luggageQuantity') ||
                                       $elem.data('luggage-quantity');
                        const type = $elem.data('type') === 'child' ? 'CHILD' : 'ADULT';
                        const age = type === 'CHILD' ? 10 : 30;

                        for (let i = 1; i <= numPaxes; i++) {
                            selectedGolf.passengers.push({
                                type: type,
                                age: age
                            });
                        }
                    });
                } else {
                    $container.find('.js-see-prices').removeClass('disabled');
                }

                // Atualizar via API
                self.updateOptionalService($this, selectedGolf, self.toggleOptionalService);
            });
        }
    };

    // Inicializar quando documento estiver pronto
    $(document).ready(function() {
        if (typeof window.SoltourApp !== 'undefined') {
            window.SoltourApp.OptionalServices.init();
        }
    });

})(jQuery);
