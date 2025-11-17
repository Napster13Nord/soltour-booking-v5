/**
 * Módulo Toast Notifications
 * Sistema de notificações elegante para feedback ao usuário
 *
 * Uso:
 * SoltourApp.Toast.show('Mensagem', 'success');
 * SoltourApp.Toast.show('Erro', 'error', 5000);
 */

(function($) {
    'use strict';

    window.SoltourApp.Toast = {
        /**
         * Mostra uma notificação toast
         * @param {string} message - Mensagem a exibir
         * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
         * @param {number} duration - Duração em ms (default: 4000)
         */
        show: function(message, type, duration) {
            type = type || 'info';
            duration = duration || 4000;

            // Definir ícone e cor baseado no tipo
            const config = this.getToastConfig(type);

            // Criar HTML do toast
            const toastId = 'toast-' + Date.now();
            const toast = `
                <div id="${toastId}" class="soltour-toast soltour-toast-${type}" style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    min-width: 300px;
                    max-width: 500px;
                    background: ${config.background};
                    color: ${config.color};
                    padding: 16px 20px;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px ${config.shadow};
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 15px;
                    line-height: 1.5;
                    opacity: 0;
                    transform: translateX(400px);
                    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                ">
                    <div class="toast-icon" style="
                        font-size: 24px;
                        flex-shrink: 0;
                    ">${config.icon}</div>
                    <div class="toast-message" style="
                        flex: 1;
                        font-weight: 500;
                    ">${message}</div>
                    <button class="toast-close" style="
                        background: none;
                        border: none;
                        color: ${config.color};
                        font-size: 20px;
                        cursor: pointer;
                        padding: 0;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.7;
                        transition: opacity 0.2s;
                        flex-shrink: 0;
                    " onclick="SoltourApp.Toast.hide('${toastId}')" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
                </div>
            `;

            // Adicionar ao DOM
            $('body').append(toast);

            // Animar entrada
            setTimeout(function() {
                $(`#${toastId}`).css({
                    opacity: '1',
                    transform: 'translateX(0)'
                });
            }, 10);

            // Auto-hide após duração
            setTimeout(function() {
                window.SoltourApp.Toast.hide(toastId);
            }, duration);

            return toastId;
        },

        /**
         * Esconde um toast específico
         */
        hide: function(toastId) {
            const $toast = $(`#${toastId}`);

            $toast.css({
                opacity: '0',
                transform: 'translateX(400px)'
            });

            setTimeout(function() {
                $toast.remove();
            }, 300);
        },

        /**
         * Configuração visual por tipo de toast
         */
        getToastConfig: function(type) {
            const configs = {
                success: {
                    icon: '✓',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    shadow: 'rgba(16, 185, 129, 0.4)'
                },
                error: {
                    icon: '✕',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#ffffff',
                    shadow: 'rgba(239, 68, 68, 0.4)'
                },
                warning: {
                    icon: '⚠',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    shadow: 'rgba(245, 158, 11, 0.4)'
                },
                info: {
                    icon: 'ℹ',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#ffffff',
                    shadow: 'rgba(59, 130, 246, 0.4)'
                }
            };

            return configs[type] || configs.info;
        },

        /**
         * Atalhos para tipos comuns
         */
        success: function(message, duration) {
            return this.show(message, 'success', duration);
        },

        error: function(message, duration) {
            return this.show(message, 'error', duration);
        },

        warning: function(message, duration) {
            return this.show(message, 'warning', duration);
        },

        info: function(message, duration) {
            return this.show(message, 'info', duration);
        }
    };

})(jQuery);
