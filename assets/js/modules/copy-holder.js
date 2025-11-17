/**
 * Módulo Copy Holder
 * Copia dados do titular para o primeiro passageiro automaticamente
 *
 * Permite que o usuário marque um checkbox para que os dados do titular
 * sejam automaticamente copiados para o primeiro passageiro.
 *
 * Uso:
 * <input type="checkbox" class="js-toggle-copy-holder" id="copyHolderToggle">
 * <label for="copyHolderToggle">Titular é o primeiro passageiro</label>
 */

(function($) {
    'use strict';

    window.SoltourApp.CopyHolder = {
        isActive: false,
        holderFields: [],
        passengerFields: [],

        /**
         * Inicializa o módulo
         */
        init: function() {
            this.bindEvents();
            this.mapFields();
        },

        /**
         * Mapeia os campos do titular e primeiro passageiro
         */
        mapFields: function() {
            // Campos do titular que devem ser copiados
            this.holderFields = [
                'holder[name]',
                'holder[surname]',
                'holder[email]',
                'holder[phone]',
                'holder[birthDay]',
                'holder[documentType]',
                'holder[documentNumber]',
                'holder[documentExpiryDate]',
                'holder[nationality]'
            ];

            // Mapeamento titular → primeiro passageiro
            // Assumindo estrutura: rooms[0][passengers][0][campo]
            this.fieldMapping = {
                'holder[name]': 'rooms[0][passengers][0][name]',
                'holder[surname]': 'rooms[0][passengers][0][surname]',
                'holder[birthDay]': 'rooms[0][passengers][0][birthDay]',
                'holder[documentType]': 'rooms[0][passengers][0][documentType]',
                'holder[documentNumber]': 'rooms[0][passengers][0][documentNumber]',
                'holder[documentExpiryDate]': 'rooms[0][passengers][0][documentExpiryDate]',
                'holder[nationality]': 'rooms[0][passengers][0][nationality]'
            };
        },

        /**
         * Bind eventos
         */
        bindEvents: function() {
            const self = this;

            // Toggle copy holder
            $(document.body).on('change', '.js-toggle-copy-holder', function() {
                self.toggleCopyHolder($(this));
            });

            // Se checkbox já estiver marcado no carregamento
            if ($('.js-toggle-copy-holder').is(':checked')) {
                this.enableCopyMode();
            }
        },

        /**
         * Alterna modo de cópia
         */
        toggleCopyHolder: function($checkbox) {

            if ($checkbox.is(':checked')) {
                this.enableCopyMode();
            } else {
                this.disableCopyMode();
            }
        },

        /**
         * Ativa modo de cópia
         */
        enableCopyMode: function() {
            this.isActive = true;

            const self = this;

            // Copiar valores atuais
            this.copyAllFields();

            // Escutar mudanças nos campos do titular
            $.each(this.fieldMapping, function(holderField, passengerField) {
                const $holderInput = $('[name="' + holderField + '"]');

                $holderInput.on('input.copyHolder change.copyHolder', function() {
                    self.copyField(holderField, passengerField);
                });
            });

            // Desabilitar campos do primeiro passageiro
            this.disablePassengerFields(true);

            // Feedback visual
            this.showCopyModeIndicator();
        },

        /**
         * Desativa modo de cópia
         */
        disableCopyMode: function() {
            this.isActive = false;

            // Remover listeners
            $.each(this.fieldMapping, function(holderField, passengerField) {
                $('[name="' + holderField + '"]').off('.copyHolder');
            });

            // Re-habilitar campos do primeiro passageiro
            this.disablePassengerFields(false);

            // Remover feedback visual
            this.hideCopyModeIndicator();
        },

        /**
         * Copia todos os campos
         */
        copyAllFields: function() {
            const self = this;

            $.each(this.fieldMapping, function(holderField, passengerField) {
                self.copyField(holderField, passengerField);
            });

        },

        /**
         * Copia um campo específico
         */
        copyField: function(holderFieldName, passengerFieldName) {
            const $holderInput = $('[name="' + holderFieldName + '"]');
            const $passengerInput = $('[name="' + passengerFieldName + '"]');

            if ($holderInput.length && $passengerInput.length) {
                const value = $holderInput.val();

                // Copiar valor
                $passengerInput.val(value);

                // Triggerar change para validações
                $passengerInput.trigger('change');

            } else {
                // Campo não encontrado (pode não existir no formulário)
                if (!$holderInput.length) {
                }
                if (!$passengerInput.length) {
                }
            }
        },

        /**
         * Desabilita/habilita campos do primeiro passageiro
         */
        disablePassengerFields: function(disable) {
            const self = this;

            $.each(this.fieldMapping, function(holderField, passengerField) {
                const $passengerInput = $('[name="' + passengerField + '"]');

                if ($passengerInput.length) {
                    if (disable) {
                        $passengerInput.prop('disabled', true);
                        $passengerInput.prop('readonly', true);
                        $passengerInput.addClass('copy-holder-disabled');
                    } else {
                        $passengerInput.prop('disabled', false);
                        $passengerInput.prop('readonly', false);
                        $passengerInput.removeClass('copy-holder-disabled');
                    }
                }
            });
        },

        /**
         * Mostra indicador visual de modo de cópia ativo
         */
        showCopyModeIndicator: function() {
            const $passengerContainer = $('.js-first-passenger-container, [data-passenger-index="0"]');

            if ($passengerContainer.length && !$passengerContainer.find('.copy-holder-indicator').length) {
                const indicator = `
                    <div class="copy-holder-indicator" style="
                        background: #e3f2fd;
                        border-left: 4px solid #2196F3;
                        padding: 12px;
                        margin: 10px 0;
                        border-radius: 4px;
                        font-size: 14px;
                        color: #1976d2;
                    ">
                        <strong>ℹ️ Modo ativo:</strong> Os dados do titular estão sendo copiados automaticamente.
                    </div>
                `;

                $passengerContainer.prepend(indicator);
            }
        },

        /**
         * Remove indicador visual
         */
        hideCopyModeIndicator: function() {
            $('.copy-holder-indicator').fadeOut(300, function() {
                $(this).remove();
            });
        },

        /**
         * Validação: garantir que dados foram copiados antes do submit
         */
        validateBeforeSubmit: function() {
            if (!this.isActive) {
                return true;
            }


            // Garantir que todos os campos estão sincronizados
            this.copyAllFields();

            return true;
        }
    };

    // Inicializar quando documento estiver pronto
    $(document).ready(function() {
        if (typeof window.SoltourApp !== 'undefined') {
            window.SoltourApp.CopyHolder.init();
        }
    });

    // Hook para validação antes do submit
    $(document.body).on('submit', 'form#bookForm', function(e) {
        if (window.SoltourApp && window.SoltourApp.CopyHolder) {
            if (!window.SoltourApp.CopyHolder.validateBeforeSubmit()) {
                e.preventDefault();
                return false;
            }
        }
    });

})(jQuery);
