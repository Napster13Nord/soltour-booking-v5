/**
 * Módulo DelayedQuote
 * Carrega preços finais de forma assíncrona na página de Quote
 *
 * Similar ao DelayedAvailability, mas aplicado à cotação final.
 * Permite que a página de quote carregue rapidamente com skeleton,
 * enquanto busca os preços reais em background.
 *
 * Uso:
 * SoltourApp.DelayedQuote.init({delayedQuoteActive: true});
 */

(function($) {
    'use strict';

    window.SoltourApp.DelayedQuote = {
        isActive: false,
        priceInterval: null,

        /**
         * Inicializa o delayed quote
         * @param {Object} options - Opções de configuração
         * @param {boolean} options.delayedQuoteActive - Se delayed quote está ativo
         */
        init: function(options) {
            options = options || {};
            this.isActive = options.delayedQuoteActive || false;

            if (this.isActive) {
                this.startDelayedLoad();
            }
        },

        /**
         * Inicia processo de carregamento assíncrono
         */
        startDelayedLoad: function() {
            this.disableInteractions();
            this.showBlinkingNotification();
            this.startPriceBlinking();
            this.loadDelayedQuote();
        },

        /**
         * Desabilita interações durante loading
         */
        disableInteractions: function() {

            // Desabilitar botão de reservar
            $('.js-submit-form').each(function() {
                $(this).prop('disabled', true);
            });

            // Desabilitar checkboxes de serviços opcionais - Seguros
            if ($("#insurancesQuoteData").length) {
                $("#insurancesQuoteData").find('.c-checkbox__element').each(function() {
                    $(this).prop('disabled', true);
                });
            }

            // Desabilitar checkboxes de serviços opcionais - Transfers
            if ($("#transferQuoteData").length) {
                $("#transferQuoteData").find('.c-checkbox__element').each(function() {
                    $(this).prop('disabled', true);
                });
            }

            // Desabilitar botões de ação
            $('.js-print-quote').on('click', function(e) {
                e.preventDefault();
                $(this).prop('disabled', true);
            });
            $('.js-send-mail').on('click', function(e) {
                e.preventDefault();
                $(this).prop('disabled', true);
            });
            $('#breakdownToggle').on('click', function(e) {
                e.preventDefault();
                $(this).prop('disabled', true);
            });
            $('.js-mybp-login').on('click', function(e) {
                e.preventDefault();
                $(this).prop('disabled', true);
            });

            // Desabilitar campos de breakdown
            $('#quoteBreakdownBox :input').prop('disabled', true);

            // Remover atributos href para prevenir navegação
            $(".js-print-quote").removeAttr('href');
            $(".js-send-mail").removeAttr('href');
            $("#breakdownToggle").removeAttr('href');
            $("#breakdownToggle").off();

            // Ocultar seção MyBP
            $('.myBpContainer').each(function() {
                $(this).addClass('u-display-none');
            });
        },

        /**
         * Re-habilita interações após loading
         */
        enableInteractions: function() {

            $('.js-submit-form').each(function() {
                $(this).prop('disabled', false);
            });

            if ($("#insurancesQuoteData").length) {
                $("#insurancesQuoteData").find('.c-checkbox__element').each(function() {
                    $(this).prop('disabled', false);
                });
            }

            if ($("#transferQuoteData").length) {
                $("#transferQuoteData").find('.c-checkbox__element').each(function() {
                    $(this).prop('disabled', false);
                });
            }

            $('.js-print-quote').off('click').prop('disabled', false);
            $('.js-send-mail').off('click').prop('disabled', false);
            $('#breakdownToggle').off('click').prop('disabled', false);
            $('#quoteBreakdownBox :input').prop('disabled', false);

            $('.myBpContainer').each(function() {
                $(this).removeClass('u-display-none');
            });
        },

        /**
         * Mostra notificação piscando
         */
        showBlinkingNotification: function() {
            const notification = `
                <div id="delayedQuoteWarning" style="
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
                    z-index: 999998;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 15px;
                    font-weight: 500;
                    animation: slideInRight 0.3s ease-out;
                ">
                    <span style="font-size: 20px;">⏳</span>
                    <span>Calculando preços finais...</span>
                </div>
                <style>
                    @keyframes slideInRight {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                </style>
            `;
            $('body').append(notification);
        },

        /**
         * Remove notificação
         */
        hideBlinkingNotification: function() {
            $('#delayedQuoteWarning').fadeOut(300, function() {
                $(this).remove();
            });
        },

        /**
         * Inicia animação de blinking no preço
         */
        startPriceBlinking: function() {
            const self = this;

            function blinkPrice() {
                $('#titlePrice').fadeOut(500);
                $('#titlePrice').fadeIn(500);
                $('#summaryPrice').fadeOut(500);
                $('#summaryPrice').fadeIn(500);
            }

            this.priceInterval = setInterval(blinkPrice, 1000);
        },

        /**
         * Para animação de blinking
         */
        stopPriceBlinking: function() {
            if (this.priceInterval) {
                clearInterval(this.priceInterval);
                this.priceInterval = null;

                // Garantir que os elementos fiquem visíveis
                $('#titlePrice').stop(true, true).css('opacity', 1);
                $('#summaryPrice').stop(true, true).css('opacity', 1);
            }

            // Remover warning do DOM
            $('#delayedQuoteWarning').remove();
        },

        /**
         * Carrega quote com preços finais
         */
        loadDelayedQuote: function() {
            const self = this;

            const params = {
                action: 'soltour_delayed_quote',
                nonce: soltourData.nonce,
                budget_id: window.SoltourApp.budgetId,
                avail_token: window.SoltourApp.availToken,
                product_type: window.SoltourApp.productType || 'PACKAGE',
                from_page: 'SEARCHER',
                force_quote: true
            };


            $.ajax({
                url: soltourData.ajaxurl,
                type: 'POST',
                data: params,
                timeout: 30000,
                success: function(response) {

                    if (response.success && response.data) {
                        self.updateQuoteContent(response.data);
                        self.stopPriceBlinking();
                        self.enableInteractions();
                        self.hideBlinkingNotification();
                        self.isActive = false;

                        // Mostrar toast de sucesso
                        if (window.SoltourApp.Toast) {
                            window.SoltourApp.Toast.success(
                                'Preços atualizados com sucesso!',
                                3000
                            );
                        }

                    } else {
                        self.handleDelayedQuoteError(response);
                    }
                },
                error: function(xhr, status, error) {

                    self.handleDelayedQuoteError({
                        success: false,
                        data: {
                            message: 'Erro ao carregar preços. Tente novamente.'
                        }
                    });
                }
            });
        },

        /**
         * Atualiza conteúdo da página com novos preços
         * @param {Object} data - Dados retornados pela API
         */
        updateQuoteContent: function(data) {

            // Atualizar título com preço
            if (data.titleHtml) {
                $('#titleContent').html(data.titleHtml);
            }

            // Atualizar breakdown
            if (data.breakdownHtml) {
                $('#breakdownContent').html(data.breakdownHtml);
            }

            // Atualizar formulário
            if (data.formHtml) {
                $('#formContent').html(data.formHtml);
            }

            // Atualizar resumo
            if (data.summaryHtml) {
                $('#summaryContent').html(data.summaryHtml);
            }

            // Atualizar mensagens de warning
            if (data.warningMessagesHtml) {
                $('#quoteWarningMessages').html(data.warningMessagesHtml);
            }

            // Atualizar modal de pagamento
            if (data.paymentHtml) {
                $('#payModal').html(data.paymentHtml);
            }

            // Atualizar availToken se mudou
            if (data.availToken) {
                window.SoltourApp.availToken = data.availToken;
            }

            // Atualizar total
            if (data.totalAmount) {
                window.SoltourApp.totalAmount = data.totalAmount;
                $('[data-js-total-amount]').each(function() {
                    $(this).data('jsTotalAmount', data.totalAmount);
                    $(this).html(data.totalAmount.toFixed(2) + ' &euro;');
                });
            }

            // Re-inicializar componentes se necessário
            if (data.jsInit) {
                try {
                    // Patch para substituir strings literais que devem ser código
                    let jsInit = data.jsInit.replace("\"$('.myBpContainer')\"", "$('.myBpContainer')");
                    jsInit = jsInit.replace("\"$('.myBpSummary')\"", "$('.myBpSummary')");
                    eval(jsInit);
                } catch (e) {
                }
            }

            // Re-inicializar módulo Quote se disponível
            if (typeof window.SoltourApp.Quote !== 'undefined' &&
                typeof window.SoltourApp.Quote.initAfterDelayed === 'function') {
                window.SoltourApp.Quote.initAfterDelayed();
            }

        },

        /**
         * Trata erros do delayed quote
         * @param {Object} response - Resposta de erro
         */
        handleDelayedQuoteError: function(response) {

            this.stopPriceBlinking();
            this.enableInteractions();
            this.hideBlinkingNotification();
            this.isActive = false;

            let message = 'Não foi possível calcular os preços finais.';
            if (response.data && response.data.message) {
                message = response.data.message;
            }


            if (window.SoltourApp.Toast) {
                window.SoltourApp.Toast.error(message, 6000);
            } else {
                alert(message);
            }

            // Opcional: voltar para availability se erro crítico
            // if (response.data && response.data.critical) {
            //     setTimeout(function() {
            //         window.history.back();
            //     }, 2000);
            // }
        }
    };

})(jQuery);
