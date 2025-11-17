/**
 * Página de Cotação - BeautyTravel
 * Carrega pacote selecionado e gera cotação
 */

(function($) {
    'use strict';

    // Namespace global
    window.BeautyTravelQuote = {
        budgetData: null,
        packageDetails: null,
        passengers: []
    };

    // Aguardar DOM ready
    $(document).ready(function() {

        // Verificar se estamos na página de cotação
        const $quotePage = $('#soltour-quote-page');
        if ($quotePage.length === 0) {
            return;
        }

        initQuotePage();
    });

    /**
     * Inicializar página de cotação
     */
    function initQuotePage() {
        // 1. Carregar pacote selecionado do sessionStorage (CORRIGIDO: soltour_selected_package)
        const selectedPackage = sessionStorage.getItem('soltour_selected_package');

        if (!selectedPackage) {
            renderError('Nenhum pacote selecionado', 'Por favor, volte à página de resultados e selecione um pacote.');
            return;
        }

        try {
            const packageData = JSON.parse(selectedPackage);

            // Verificar se temos todos os dados necessários (APENAS do availability)
            if (!packageData.budget || !packageData.selectedRoom) {
                renderError('Dados incompletos', 'Os dados do pacote estão incompletos. Por favor, selecione novamente.');
                return;
            }

            // Salvar dados no objeto global
            BeautyTravelQuote.packageData = packageData;
            BeautyTravelQuote.budgetData = packageData; // Salvar packageData completo para envio ao servidor

            // Renderizar página completa diretamente (SEM AJAX - apenas dados do availability)
            renderQuotePage();

        } catch (error) {
            renderError('Erro ao carregar pacote', 'Os dados do pacote selecionado estão corrompidos.');
        }
    }

    /**
     * Renderizar página completa de cotação
     */
    function renderQuotePage() {

        const $container = $('#soltour-quote-page');
        const packageData = BeautyTravelQuote.packageData;
        const budget = packageData.budget || {};
        const selectedRoom = packageData.selectedRoom || {};
        const selectedRooms = packageData.selectedRooms || [selectedRoom]; // Array com todos os quartos
        const numRoomsSearched = packageData.numRoomsSearched || 1;
        const hotelService = budget.hotelServices && budget.hotelServices[0];

        // ==============================================
        // DEBUG AVANÇADO - Requisição e Resposta da API
        // ==============================================

        // Debug de transfers
        const transferData = extractTransferData(budget);
        if (transferData.hasTransfers) {
        }

        // Debug de cancelamento
        const cancellationData = extractCancellationData(budget);

        // Debug de seguros (da resposta quote)
        const insuranceData = extractInsuranceData(packageData);
        if (insuranceData?.hasInsurances && insuranceData?.insurances) {
        }

        // Debug de extras (da resposta quote)
        const extrasData = extractExtrasData(packageData);
        if (extrasData?.hasExtras && extrasData?.extras) {
        }

        // Debug de textos legais (da resposta quote)
        const legalData = extractLegalData(packageData);
        if (legalData?.hasLegalInfo && legalData?.legalTexts) {
        }

        // USAR APENAS DADOS DO AVAILABILITY (budget)
        // NÃO usar details.hotelDetails que vem de chamada separada

        // Extrair dados do hotel do BUDGET e HOTELINFO
        const hotelCode = hotelService?.hotelCode || '';

        // IMPORTANTE: Usar dados do hotelInfo (availability) e não do hotelService
        let hotelName = 'Hotel';
        let hotelImage = '';
        let hotelLocation = '';
        let hotelStars = 0;
        let hotelDescription = '';

        if (packageData.hotelInfo) {
            // Usar dados do hotelsFromAvailability que foram salvos
            hotelName = packageData.hotelInfo.name || hotelService?.hotelName || 'Hotel';
            hotelImage = packageData.hotelInfo.mainImage || '';
            hotelLocation = packageData.hotelInfo.destinationDescription || '';
            const categoryCode = packageData.hotelInfo.categoryCode || '';
            hotelStars = (categoryCode.match(/\*/g) || []).length;
            hotelDescription = packageData.hotelInfo.description || packageData.hotelInfo.shortDescription || '';
        } else {
            // Fallback para hotelService se hotelInfo não estiver disponível
            hotelName = hotelService?.hotelName || 'Hotel';
        }

        // Preço
        const price = extractPrice(budget);

        // Passageiros - USAR DADOS CORRETOS DE searchParams (suportar múltiplos quartos)
        let allPassengers = [];
        let adults = 0;
        let children = 0;
        let passengerCount = 0;

        if (packageData.searchParams && packageData.searchParams.rooms) {
            try {
                const rooms = typeof packageData.searchParams.rooms === 'string'
                    ? JSON.parse(packageData.searchParams.rooms)
                    : packageData.searchParams.rooms;


                // Coletar todos os passageiros de todos os quartos
                rooms.forEach(room => {
                    if (room.passengers) {
                        room.passengers.forEach(p => {
                            allPassengers.push(p);
                            if (p.type === 'ADULT') adults++;
                            else if (p.type === 'CHILD') children++;
                        });
                    }
                });

                passengerCount = allPassengers.length;
            } catch (e) {
            }
        }

        const pricePerPerson = passengerCount > 0 ? price / passengerCount : 0;

        // Noites
        const numNights = getNumNights(budget);

        // Voos - Usar flightData (outboundSegments/returnSegments) se disponível
        const flightData = packageData.flightData || null;

        // Meal plan
        const mealPlan = getMealPlan(budget);

        // Datas
        const { startDate, endDate } = getDates(budget);

        // HTML da página
        const html = `
            <div class="bt-quote-header">
                <h1>Cotação do Seu Pacote</h1>
                <p>Preencha os dados abaixo para receber sua cotação personalizada</p>
            </div>

            <!-- Card Informativo sobre Guardar Orçamento -->
            <div class="bt-info-notice">
                <div class="bt-info-notice-icon">ℹ️</div>
                <div class="bt-info-notice-content">
                    Após gerar a cotação final, entraremos em contacto consigo para formalizar a reserva. Enviaremos uma cópia para o seu e-mail.
                </div>
            </div>

            <div class="bt-quote-grid">
                <!-- COLUNA ESQUERDA (70%) -->
                <div class="bt-quote-left-column">

                    <!-- PASSO 1: Resumo do Pacote (expandido) -->
                    <div class="bt-package-summary">
                        <h2>Resumo do Pacote</h2>

                        <!-- Hotel -->
                        <div class="bt-summary-section bt-summary-compact">
                            <h3>🏨 Hotel</h3>
                            <div class="bt-summary-value">
                                <strong>${hotelName}</strong> ${hotelStars > 0 ? `<span class="bt-stars">${'⭐'.repeat(hotelStars)}</span>` : ''}
                                ${hotelLocation ? `<div style="color: #6b7280; font-size: 14px; margin-top: 4px;">📍 ${hotelLocation}${mealPlan ? ` | ${mealPlan}` : ''}</div>` : ''}
                            </div>
                        </div>

                        <!-- Quartos -->
                        <div class="bt-summary-section bt-summary-compact">
                            <h3>🛏️ Quarto${numRoomsSearched > 1 ? 's' : ''}</h3>
                            ${selectedRooms.map((room, index) => `
                                <div class="bt-summary-value" style="margin-bottom: ${index < selectedRooms.length - 1 ? '8px' : '0'};">
                                    ${numRoomsSearched > 1 ? `<strong>Quarto ${index + 1}:</strong> ` : ''}${room.description || 'Quarto Duplo'}
                                </div>
                            `).join('')}
                        </div>

                        <!-- Voos (se disponível) -->
                        ${flightData ? `
                            <div class="bt-summary-section bt-summary-compact">
                                <h3>✈️ Voos</h3>
                                ${(() => {
                                    const outbound = flightData.outboundSegments || [];
                                    const returnFlight = flightData.returnSegments || [];
                                    let flightsHtml = '';

                                    if (outbound.length > 0) {
                                        const firstSeg = outbound[0];
                                        const lastSeg = outbound[outbound.length - 1];
                                        flightsHtml += `<div class="bt-summary-value">${firstSeg.originAirport} → ${lastSeg.destinationAirport} <span style="color: #6b7280;">(Ida)</span></div>`;
                                    }

                                    if (returnFlight.length > 0) {
                                        const firstSeg = returnFlight[0];
                                        const lastSeg = returnFlight[returnFlight.length - 1];
                                        flightsHtml += `<div class="bt-summary-value" style="margin-top: 4px;">${firstSeg.originAirport} → ${lastSeg.destinationAirport} <span style="color: #6b7280;">(Volta)</span></div>`;
                                    }

                                    return flightsHtml;
                                })()}
                            </div>
                        ` : ''}

                        <!-- Datas -->
                        <div class="bt-summary-section bt-summary-compact">
                            <h3>📅 Datas</h3>
                            <div class="bt-summary-value">
                                ${startDate} → ${endDate}
                                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">
                                    ${numNights} noite${numNights !== 1 ? 's' : ''} | ${adults} adulto${adults !== 1 ? 's' : ''}${children > 0 ? ` + ${children} criança${children !== 1 ? 's' : ''}` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Card de Transfers (se disponível) -->
                        ${renderTransferCard(transferData)}
                    </div>

                    <!-- PASSO 2: Dados dos Passageiros -->
                    <div class="bt-passengers-form">
                        <h2>Dados dos Passageiros</h2>
                        ${renderPassengerForms(allPassengers)}
                    </div>

                    <!-- PASSO 3: Custos de Cancelamento -->
                    ${cancellationData && cancellationData.charges && cancellationData.charges.length > 0 ? `
                        <div class="bt-package-summary" style="margin-top: 20px;">
                            <h2>Custos de Cancelamento</h2>
                            ${renderCancellationCard(cancellationData)}
                        </div>
                    ` : ''}

                    <!-- PASSO 3: Informações Importantes -->
                    ${legalData && legalData.hasLegalInfo ? `
                        <div class="bt-package-summary" style="margin-top: 20px;">
                            <h2>Informações Importantes e Condições</h2>
                            ${renderLegalTextsCard(legalData)}
                        </div>
                    ` : ''}

                    <!-- Extras (se disponível) -->
                    ${extrasData && extrasData.hasExtras ? `
                        <div class="bt-package-summary" style="margin-top: 20px;">
                            <h2>🎁 Serviços Extras</h2>
                            ${renderExtrasCard(extrasData)}
                        </div>
                    ` : ''}
                </div>

                <!-- COLUNA DIREITA (30%) - SIDEBAR FIXA -->
                <div class="bt-price-sidebar">
                    <h2>Preço Final da Viagem</h2>

                    <!-- Informações da Viagem -->
                    <div class="bt-sidebar-section">
                        <h3 class="bt-sidebar-title">ℹ️ Detalhes da Viagem</h3>
                        <div class="bt-sidebar-info-row">
                            <span>Check-in:</span>
                            <strong>${startDate}</strong>
                        </div>
                        <div class="bt-sidebar-info-row">
                            <span>Check-out:</span>
                            <strong>${endDate}</strong>
                        </div>
                        <div class="bt-sidebar-info-row">
                            <span>Noites:</span>
                            <strong>${numNights}</strong>
                        </div>
                        <div class="bt-sidebar-info-row">
                            <span>Regime:</span>
                            <strong>${mealPlan}</strong>
                        </div>
                        <div class="bt-sidebar-info-row">
                            <span>Passageiros:</span>
                            <strong>${passengerCount} pessoa${passengerCount > 1 ? 's' : ''}</strong>
                        </div>
                    </div>

                    <!-- Seguros Disponíveis -->
                    ${insuranceData && insuranceData.hasInsurances ? `
                        <div class="bt-sidebar-section">
                            ${renderInsuranceCard(insuranceData)}
                        </div>
                    ` : ''}

                    <!-- Preço -->
                    <div class="bt-sidebar-section bt-sidebar-price">
                        <div class="bt-price-total">
                            <div class="bt-price-total-label">Preço Total</div>
                            <div class="bt-price-total-amount">${price.toFixed(0)}€</div>
                            <div class="bt-price-per-person">(${pricePerPerson.toFixed(0)}€ por pessoa)</div>
                        </div>
                        <div class="bt-price-note">
                            💡 Valor estimado. O preço final será confirmado após preencher os dados.
                        </div>
                    </div>

                    <!-- GDPR - Consentimento -->
                    <div class="bt-gdpr-consent">
                        <label class="bt-gdpr-label">
                            <input type="checkbox" id="gdpr-consent" class="bt-gdpr-checkbox" required />
                            <span class="bt-gdpr-text">
                                Ao gerar a cotação, concordo com os
                                <a href="https://beautytravel.pt/termos-e-condicoes" target="_blank" rel="noopener">Termos e Condições</a>
                                e
                                <a href="https://beautytravel.pt/politica-de-privacidade" target="_blank" rel="noopener">Política de Privacidade</a>
                                da Beauty Travel.
                            </span>
                        </label>
                    </div>

                    <!-- Botão de Gerar Cotação -->
                    <button type="button" class="bt-btn-generate-quote" id="btn-generate-quote" disabled>
                        <i class="fas fa-file-invoice"></i>
                        Gerar Cotação Final
                    </button>
                </div>
            </div>
        `;

        $container.html(html);

        // NÃO expandir cards por padrão - deixar fechados para layout mais limpo
        // $('.bt-transfer-card, .bt-cancellation-card, .bt-insurance-card, .bt-extras-card, .bt-legal-card').addClass('expanded');

        // Bind eventos
        bindQuoteEvents();

        // Esconder loading modal apenas DEPOIS de renderizar tudo
        // O modal foi aberto em soltour-booking.js quando clicou em "Selecionar"
        if (typeof hideLoadingModal === 'function') {
            hideLoadingModal();
        } else if (window.hideLoadingModal) {
            window.hideLoadingModal();
        } else {
            // Fallback: tentar esconder modal diretamente
            const modal = $('#soltour-loading-modal');
            if (modal.length) {
                modal.removeClass('active');
            }
        }

    }

    /**
     * Renderizar voos para sidebar (versão ultra-compacta)
     */
    function renderFlightsSidebar(flightData) {
        if (!flightData) return '';

        const outboundSegments = flightData.outboundSegments || [];
        const returnSegments = flightData.returnSegments || [];

        let html = '';

        // Voo de IDA
        if (outboundSegments.length > 0) {
            const firstSeg = outboundSegments[0];
            const lastSeg = outboundSegments[outboundSegments.length - 1];
            const stopInfo = outboundSegments.length > 1 ? `${outboundSegments.length - 1} escala${outboundSegments.length > 2 ? 's' : ''}` : 'Direto';

            html += `
                <div class="bt-sidebar-flight">
                    <div class="bt-sidebar-flight-type">🛫 IDA</div>
                    <div class="bt-sidebar-flight-route">${firstSeg.originAirport} → ${lastSeg.destinationAirport}</div>
                    <div class="bt-sidebar-flight-stops">${stopInfo}</div>
                </div>
            `;
        }

        // Voo de VOLTA
        if (returnSegments.length > 0) {
            const firstSeg = returnSegments[0];
            const lastSeg = returnSegments[returnSegments.length - 1];
            const stopInfo = returnSegments.length > 1 ? `${returnSegments.length - 1} escala${returnSegments.length > 2 ? 's' : ''}` : 'Direto';

            html += `
                <div class="bt-sidebar-flight">
                    <div class="bt-sidebar-flight-type">🛬 VOLTA</div>
                    <div class="bt-sidebar-flight-route">${firstSeg.originAirport} → ${lastSeg.destinationAirport}</div>
                    <div class="bt-sidebar-flight-stops">${stopInfo}</div>
                </div>
            `;
        }

        return html;
    }

    /**
     * Renderizar voos de forma compacta (usando estrutura do availability: outboundSegments/returnSegments)
     */
    function renderFlightsCompact(flightData) {
        if (!flightData) return '';

        // Helper para formatar horário do formato HH:mm:ss
        function formatTimeSimple(timeStr) {
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
        function formatDateSimple(dateStr) {
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

        let html = '<h3 class="bt-card-section-title">✈️ Voo selecionado</h3>';

        // ESTRUTURA REAL DO SOLTOUR API: outboundSegments[] e returnSegments[]
        const outboundSegments = flightData.outboundSegments || [];
        const returnSegments = flightData.returnSegments || [];

        // Renderizar IDA (OUTBOUND)
        if (outboundSegments.length > 0) {
            const firstSeg = outboundSegments[0];
            const lastSeg = outboundSegments[outboundSegments.length - 1];
            const airlineName = getAirlineName(firstSeg.operatingCompanyCode);
            const stopInfo = outboundSegments.length > 1 ? `${outboundSegments.length - 1} escala${outboundSegments.length > 2 ? 's' : ''}` : 'Direto';

            html += `
                <div class="flight-card-compact">
                    <div class="flight-compact-header">
                        <span class="flight-type-label">🛫 Ida</span>
                        <span class="flight-compact-date">${formatDateSimple(firstSeg.departureDate)}</span>
                    </div>
                    <div class="flight-compact-body">
                        <div class="flight-compact-route">
                            <div class="flight-compact-point">
                                <div class="flight-compact-time">${formatTimeSimple(firstSeg.departureTime)}</div>
                                <div class="flight-compact-airport">${firstSeg.originAirport}</div>
                            </div>
                            <div class="flight-compact-arrow">
                                <div class="arrow">→</div>
                                <div class="flight-compact-stops">${stopInfo}</div>
                            </div>
                            <div class="flight-compact-point">
                                <div class="flight-compact-time">${formatTimeSimple(lastSeg.arrivalTime)}</div>
                                <div class="flight-compact-airport">${lastSeg.destinationAirport}</div>
                            </div>
                        </div>
                        <div class="flight-compact-details">
                            <span class="flight-compact-airline">${airlineName}</span>
                            <span class="flight-compact-number">Voo ${firstSeg.flightNumber || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Renderizar VOLTA (RETURN)
        if (returnSegments.length > 0) {
            const firstSeg = returnSegments[0];
            const lastSeg = returnSegments[returnSegments.length - 1];
            const airlineName = getAirlineName(firstSeg.operatingCompanyCode);
            const stopInfo = returnSegments.length > 1 ? `${returnSegments.length - 1} escala${returnSegments.length > 2 ? 's' : ''}` : 'Direto';

            html += `
                <div class="flight-card-compact">
                    <div class="flight-compact-header">
                        <span class="flight-type-label">🛬 Volta</span>
                        <span class="flight-compact-date">${formatDateSimple(firstSeg.departureDate)}</span>
                    </div>
                    <div class="flight-compact-body">
                        <div class="flight-compact-route">
                            <div class="flight-compact-point">
                                <div class="flight-compact-time">${formatTimeSimple(firstSeg.departureTime)}</div>
                                <div class="flight-compact-airport">${firstSeg.originAirport}</div>
                            </div>
                            <div class="flight-compact-arrow">
                                <div class="arrow">→</div>
                                <div class="flight-compact-stops">${stopInfo}</div>
                            </div>
                            <div class="flight-compact-point">
                                <div class="flight-compact-time">${formatTimeSimple(lastSeg.arrivalTime)}</div>
                                <div class="flight-compact-airport">${lastSeg.destinationAirport}</div>
                            </div>
                        </div>
                        <div class="flight-compact-details">
                            <span class="flight-compact-airline">${airlineName}</span>
                            <span class="flight-compact-number">Voo ${firstSeg.flightNumber || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Se não houver segmentos, mostrar mensagem genérica
        if (outboundSegments.length === 0 && returnSegments.length === 0) {
            html += `
                <div class="flight-card-compact">
                    <div class="flight-compact-body" style="text-align: center; padding: 20px;">
                        Informações de voo disponíveis na confirmação
                    </div>
                </div>
            `;
        }

        return html;
    }

    /**
     * Renderizar resumo de voos - Cards Bonitos
     */
    function renderFlightsSummary(flights) {
        let html = '<div class="bt-flights-container">';

        const outbound = flights.find(f => f.type === 'OUTBOUND');
        const inbound = flights.find(f => f.type === 'INBOUND');

        // VOO DE IDA
        if (outbound) {
            const segments = outbound.flightSegments || [];
            const firstSegment = segments[0] || {};
            const lastSegment = segments[segments.length - 1] || {};

            const airline = firstSegment.operatingAirline || firstSegment.marketingAirline || 'Companhia Aérea';
            const flightNumber = firstSegment.marketingFlightNumber || firstSegment.operatingFlightNumber || '';
            const originCode = firstSegment.originAirportCode || '';
            const destinationCode = lastSegment.destinationAirportCode || '';
            const originCity = firstSegment.originCity || originCode;
            const destinationCity = lastSegment.destinationCity || destinationCode;

            const departureDateTime = firstSegment.departureDate || '';
            const arrivalDateTime = lastSegment.arrivalDate || '';
            const departureTime = formatTime(departureDateTime);
            const arrivalTime = formatTime(arrivalDateTime);
            const departureDate = formatDate(departureDateTime);

            const numStops = segments.length - 1;
            const duration = calculateFlightDuration(departureDateTime, arrivalDateTime);

            html += `
                <div class="bt-flight-card bt-flight-outbound">
                    <div class="bt-flight-card-header">
                        <div class="bt-flight-type">
                            <span class="bt-flight-icon">🛫</span>
                            <span class="bt-flight-label">Voo de Ida</span>
                        </div>
                        <div class="bt-flight-date">${departureDate}</div>
                    </div>
                    <div class="bt-flight-card-body">
                        <div class="bt-flight-route-visual">
                            <div class="bt-flight-point bt-flight-origin">
                                <div class="bt-airport-code">${originCode}</div>
                                <div class="bt-city-name">${originCity}</div>
                                <div class="bt-time">${departureTime}</div>
                            </div>
                            <div class="bt-flight-path">
                                <div class="bt-flight-line">
                                    <div class="bt-plane-icon">✈️</div>
                                </div>
                                <div class="bt-flight-info">
                                    ${duration ? `<div class="bt-duration">${duration}</div>` : ''}
                                    ${numStops > 0 ? `<div class="bt-stops">${numStops} ${numStops === 1 ? 'escala' : 'escalas'}</div>` : '<div class="bt-stops bt-direct">Direto</div>'}
                                </div>
                            </div>
                            <div class="bt-flight-point bt-flight-destination">
                                <div class="bt-airport-code">${destinationCode}</div>
                                <div class="bt-city-name">${destinationCity}</div>
                                <div class="bt-time">${arrivalTime}</div>
                            </div>
                        </div>
                        <div class="bt-flight-card-footer">
                            <div class="bt-airline-info">
                                <span class="bt-airline-name">${airline}</span>
                                ${flightNumber ? `<span class="bt-flight-number">#${flightNumber}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // VOO DE VOLTA
        if (inbound) {
            const segments = inbound.flightSegments || [];
            const firstSegment = segments[0] || {};
            const lastSegment = segments[segments.length - 1] || {};

            const airline = firstSegment.operatingAirline || firstSegment.marketingAirline || 'Companhia Aérea';
            const flightNumber = firstSegment.marketingFlightNumber || firstSegment.operatingFlightNumber || '';
            const originCode = firstSegment.originAirportCode || '';
            const destinationCode = lastSegment.destinationAirportCode || '';
            const originCity = firstSegment.originCity || originCode;
            const destinationCity = lastSegment.destinationCity || destinationCode;

            const departureDateTime = firstSegment.departureDate || '';
            const arrivalDateTime = lastSegment.arrivalDate || '';
            const departureTime = formatTime(departureDateTime);
            const arrivalTime = formatTime(arrivalDateTime);
            const departureDate = formatDate(departureDateTime);

            const numStops = segments.length - 1;
            const duration = calculateFlightDuration(departureDateTime, arrivalDateTime);

            html += `
                <div class="bt-flight-card bt-flight-inbound">
                    <div class="bt-flight-card-header">
                        <div class="bt-flight-type">
                            <span class="bt-flight-icon">🛬</span>
                            <span class="bt-flight-label">Voo de Regresso</span>
                        </div>
                        <div class="bt-flight-date">${departureDate}</div>
                    </div>
                    <div class="bt-flight-card-body">
                        <div class="bt-flight-route-visual">
                            <div class="bt-flight-point bt-flight-origin">
                                <div class="bt-airport-code">${originCode}</div>
                                <div class="bt-city-name">${originCity}</div>
                                <div class="bt-time">${departureTime}</div>
                            </div>
                            <div class="bt-flight-path">
                                <div class="bt-flight-line">
                                    <div class="bt-plane-icon">✈️</div>
                                </div>
                                <div class="bt-flight-info">
                                    ${duration ? `<div class="bt-duration">${duration}</div>` : ''}
                                    ${numStops > 0 ? `<div class="bt-stops">${numStops} ${numStops === 1 ? 'escala' : 'escalas'}</div>` : '<div class="bt-stops bt-direct">Direto</div>'}
                                </div>
                            </div>
                            <div class="bt-flight-point bt-flight-destination">
                                <div class="bt-airport-code">${destinationCode}</div>
                                <div class="bt-city-name">${destinationCity}</div>
                                <div class="bt-time">${arrivalTime}</div>
                            </div>
                        </div>
                        <div class="bt-flight-card-footer">
                            <div class="bt-airline-info">
                                <span class="bt-airline-name">${airline}</span>
                                ${flightNumber ? `<span class="bt-flight-number">#${flightNumber}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * Calcular duração do voo
     */
    function calculateFlightDuration(departure, arrival) {
        if (!departure || !arrival) return null;

        try {
            const dep = new Date(departure);
            const arr = new Date(arrival);
            const diffMs = arr - dep;
            const diffMins = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMins / 60);
            const minutes = diffMins % 60;

            if (hours > 0) {
                return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
            }
            return `${minutes}m`;
        } catch (e) {
            return null;
        }
    }

    /**
     * Formatar data completa
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';

        try {
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Renderizar formulários de passageiros
     */
    function renderPassengerForms(allPassengers) {
        let html = '';
        let adultCount = 0;
        let childCount = 0;

        allPassengers.forEach((passenger, index) => {
            if (passenger.type === 'ADULT') {
                adultCount++;
                const i = adultCount;
                html += `
                    <div class="bt-form-section">
                        <h3>👤 Adulto ${i} <span class="bt-passenger-badge">Titular ${i === 1 ? '(Responsável)' : ''}</span></h3>
                        <div class="bt-form-row">
                            <div class="bt-form-group">
                                <label for="adult-${i}-gender">Sexo <span class="required">*</span></label>
                                <select id="adult-${i}-gender" name="adult_${i}_gender" required>
                                    <option value="">Seleciona</option>
                                    <option value="MAN">Masculino</option>
                                    <option value="WOMAN">Feminino</option>
                                </select>
                            </div>
                            <div class="bt-form-group">
                                <label for="adult-${i}-firstname">Nome <span class="required">*</span></label>
                                <input type="text" id="adult-${i}-firstname" name="adult_${i}_firstname" required />
                            </div>
                        </div>
                        <div class="bt-form-row">
                            <div class="bt-form-group">
                                <label for="adult-${i}-lastname">Primeiro Apelido <span class="required">*</span></label>
                                <input type="text" id="adult-${i}-lastname" name="adult_${i}_lastname" required />
                            </div>
                            <div class="bt-form-group">
                                <label for="adult-${i}-lastname2">Segundo Apelido</label>
                                <input type="text" id="adult-${i}-lastname2" name="adult_${i}_lastname2" />
                            </div>
                        </div>
                        <div class="bt-form-row">
                            <div class="bt-form-group">
                                <label for="adult-${i}-age">Idade <span class="required">*</span></label>
                                <input type="number" id="adult-${i}-age" name="adult_${i}_age" required min="18" max="120" placeholder="30" />
                            </div>
                            <div class="bt-form-group">
                                <label for="adult-${i}-document">Documento (Passaporte/BI) <span class="required">*</span></label>
                                <input type="text" id="adult-${i}-document" name="adult_${i}_document" required />
                            </div>
                        </div>
                        ${i === 1 ? `
                            <div class="bt-form-row">
                                <div class="bt-form-group">
                                    <label for="adult-1-email">Email <span class="required">*</span></label>
                                    <input type="email" id="adult-1-email" name="adult_1_email" required />
                                </div>
                                <div class="bt-form-group">
                                    <label for="adult-1-phone">Telefone <span class="required">*</span></label>
                                    <input type="tel" id="adult-1-phone" name="adult_1_phone" required placeholder="+351 912 345 678" />
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else if (passenger.type === 'CHILD') {
                childCount++;
                const i = childCount;
                const age = passenger.age || 10;
                html += `
                    <div class="bt-form-section">
                        <h3>👶 Criança ${i} <span class="bt-passenger-badge">Menor (${age} anos)</span></h3>
                        <div class="bt-form-row">
                            <div class="bt-form-group">
                                <label for="child-${i}-gender">Sexo <span class="required">*</span></label>
                                <select id="child-${i}-gender" name="child_${i}_gender" required>
                                    <option value="">Seleciona</option>
                                    <option value="MAN">Masculino</option>
                                    <option value="WOMAN">Feminino</option>
                                </select>
                            </div>
                            <div class="bt-form-group">
                                <label for="child-${i}-firstname">Nome <span class="required">*</span></label>
                                <input type="text" id="child-${i}-firstname" name="child_${i}_firstname" required />
                            </div>
                        </div>
                        <div class="bt-form-row">
                            <div class="bt-form-group">
                                <label for="child-${i}-lastname">Primeiro Apelido <span class="required">*</span></label>
                                <input type="text" id="child-${i}-lastname" name="child_${i}_lastname" required />
                            </div>
                            <div class="bt-form-group">
                                <label for="child-${i}-lastname2">Segundo Apelido</label>
                                <input type="text" id="child-${i}-lastname2" name="child_${i}_lastname2" />
                            </div>
                        </div>
                        <div class="bt-form-row">
                            <div class="bt-form-group">
                                <label for="child-${i}-age">Idade <span class="required">*</span></label>
                                <input type="number" id="child-${i}-age" name="child_${i}_age" required min="0" max="17" placeholder="${age}" />
                            </div>
                            <div class="bt-form-group">
                                <label for="child-${i}-document">Documento (Passaporte/BI) <span class="required">*</span></label>
                                <input type="text" id="child-${i}-document" name="child_${i}_document" required />
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        return html;
    }

    /**
     * Bind eventos da página
     */
    function bindQuoteEvents() {
        // GDPR checkbox - habilitar/desabilitar botão
        $('#gdpr-consent').off('change').on('change', function() {
            $('#btn-generate-quote').prop('disabled', !$(this).is(':checked'));
        });

        // Botão de gerar cotação
        $('#btn-generate-quote').off('click').on('click', function() {
            generateFinalQuote();
        });

        // Event listener para checkboxes de transfer
        $('.bt-transfer-checkbox').off('change').on('change', function() {
            updateTotalPrice();
        });

        // Event listener para checkboxes de seguros
        $('.bt-insurance-checkbox').off('change').on('change', function() {
            updateTotalPrice();
        });

        // Event listener para checkboxes de extras
        $('.bt-extra-checkbox').off('change').on('change', function() {
            updateTotalPrice();
        });

        // Event listener para links "Mais informações"
        $('.bt-transfer-link').off('click').on('click', function(e) {
            e.preventDefault();
            const $service = $(this).closest('.bt-transfer-service');
            const $details = $service.find('.bt-transfer-service-details');

            // Toggle detalhes
            $details.slideToggle(300);

            // Mudar texto do link
            const isVisible = $details.is(':visible');
            $(this).text(isVisible ? 'Menos informações' : 'Mais informações');
        });
    }

    /**
     * Atualizar preço total com transfers, seguros e extras selecionados
     */
    function updateTotalPrice() {
        // Obter preço base do packageData
        const packageData = BeautyTravelQuote.packageData;
        const budget = packageData.budget || {};
        let basePrice = extractPrice(budget);


        // Somar preços dos transfers marcados (excluindo os já incluídos)
        let transfersTotal = 0;
        $('.bt-transfer-checkbox:checked').each(function() {
            const isIncluded = $(this).data('included') === true || $(this).data('included') === 'true';

            // Só adicionar ao total se NÃO estiver incluído
            if (!isIncluded) {
                const transferPrice = parseFloat($(this).data('transfer-price')) || 0;
                transfersTotal += transferPrice;
            } else {
            }
        });

        // Somar preços dos seguros marcados (excluindo os já incluídos)
        let insurancesTotal = 0;
        $('.bt-insurance-checkbox:checked').each(function() {
            const isIncluded = $(this).data('included') === true || $(this).data('included') === 'true';

            // Só adicionar ao total se NÃO estiver incluído
            if (!isIncluded) {
                const insurancePrice = parseFloat($(this).data('insurance-price')) || 0;
                insurancesTotal += insurancePrice;
            } else {
            }
        });

        // Somar preços dos extras marcados (excluindo os já incluídos)
        let extrasTotal = 0;
        $('.bt-extra-checkbox:checked').each(function() {
            const isIncluded = $(this).data('included') === true || $(this).data('included') === 'true';

            // Só adicionar ao total se NÃO estiver incluído
            if (!isIncluded) {
                const extraPrice = parseFloat($(this).data('extra-price')) || 0;
                extrasTotal += extraPrice;
            } else {
            }
        });

        // Calcular novo total
        const newTotal = basePrice + transfersTotal + insurancesTotal + extrasTotal;


        // Atualizar display do preço
        $('.bt-price-total-amount').text(newTotal.toFixed(0) + '€');

        // Atualizar também no objeto global
        if (BeautyTravelQuote.packageData) {
            BeautyTravelQuote.packageData.calculatedTotal = newTotal;
        }
    }

    /**
     * Gerar cotação final
     */
    function generateFinalQuote() {


        // Primeiro validar HTML5 (campos required)
        const $forms = $('.bt-form-section input[required], .bt-form-section select[required]');
        let hasEmptyFields = false;

        $forms.each(function() {
            if (!this.value || this.value.trim() === '') {
                hasEmptyFields = true;
                $(this).addClass('error-field');
            } else {
                $(this).removeClass('error-field');
            }
        });

        if (hasEmptyFields) {
            alert('⚠️ Por favor, preencha todos os campos obrigatórios marcados com (*).');
            return;
        }

        // Validar formulário via JavaScript
        const formData = collectFormData();

        if (!formData) {
            alert('⚠️ Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        // Desabilitar botão
        const $btn = $('#btn-generate-quote');
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Gerando cotação...');

        // Log de debug para verificar dados enviados

        // Enviar para o servidor
        $.ajax({
            url: soltourData.ajaxurl,
            type: 'POST',
            data: {
                action: 'soltour_generate_quote',
                nonce: soltourData.nonce,
                budget_data: BeautyTravelQuote.budgetData,
                passengers: formData.passengers,
                client_data: formData.clientData,
                trip_data: formData.tripData,
                notes: formData.notes
            },
            success: function(response) {

                if (response.success) {
                    // Mostrar mensagem de sucesso
                    alert('✅ Cotação gerada com sucesso!\n\nEm breve receberá um email com os detalhes do seu pacote.');

                    // Limpar sessionStorage
                    sessionStorage.removeItem('soltour_selected_budget');

                    // Redirecionar para página inicial ou confirmação
                    window.location.href = '/';

                } else {
                    alert('❌ Erro ao gerar cotação: ' + (response.data?.message || 'Erro desconhecido'));
                    $btn.prop('disabled', false).html('<i class="fas fa-file-invoice"></i> Gerar Cotação Final');
                }
            },
            error: function(xhr, status, error) {
                alert('❌ Erro de conexão. Por favor, tente novamente.');
                $btn.prop('disabled', false).html('<i class="fas fa-file-invoice"></i> Gerar Cotação Final');
            }
        });
    }

    /**
     * Coletar dados do formulário
     */
    function collectFormData() {
        const passengers = [];
        let clientData = null;
        let hasErrors = false;

        // Pegar todos os inputs do formulário
        $('.bt-form-section').each(function() {
            const $section = $(this);
            const title = $section.find('h3').text();

            // Extrair dados do passageiro
            const gender = $section.find('select[name*="gender"]').val()?.trim();
            const firstName = $section.find('input[name*="firstname"]').val()?.trim();
            const lastName = $section.find('input[name*="lastname"]:not([name*="lastname2"])').val()?.trim();
            const lastName2 = $section.find('input[name*="lastname2"]').val()?.trim();
            const age = $section.find('input[name*="age"]').val();
            const document = $section.find('input[name*="document"]').val()?.trim();
            const email = $section.find('input[name*="email"]').val()?.trim();
            const phone = $section.find('input[name*="phone"]').val()?.trim();

            // Validar campos obrigatórios
            if (!gender || !firstName || !lastName || !age || !document) {
                hasErrors = true;
                return; // Continua iteração mas marca erro
            }

            // Calcular data de nascimento a partir da idade
            const birthDate = calculateBirthDateFromAge(parseInt(age));

            // Se tiver email, é o cliente principal (titular)
            if (email && phone && !clientData) {
                clientData = {
                    nome: firstName,
                    sobrenome: lastName,
                    sobrenome2: lastName2 || '',
                    email: email,
                    telefone: phone
                };
            }

            passengers.push({
                tipo: title.includes('Adulto') ? 'ADULT' : 'CHILD',
                sexo: gender,
                nome: firstName,
                sobrenome: lastName,
                sobrenome2: lastName2 || '',
                nascimento: birthDate,
                documento: document,
                email: email || null,
                phone: phone || null,
                isMainPassenger: email ? true : false
            });

        });

        // Verificar se houve erros
        if (hasErrors) {
            return null;
        }

        // Verificar se todos os passageiros foram preenchidos
        if (passengers.length === 0) {
            return null;
        }

        // Verificar se temos dados do cliente
        if (!clientData) {
            return null;
        }


        // Extrair trip_data do packageData
        const packageData = BeautyTravelQuote.packageData;
        const budget = packageData.budget || {};
        const hotelService = budget.hotelServices?.[0];
        const selectedRooms = packageData.selectedRooms || [];

        // Obter nome do quarto (primeiro selecionado ou todos)
        let roomName = 'Quarto';
        if (selectedRooms.length > 0) {
            if (selectedRooms.length === 1) {
                roomName = selectedRooms[0].description || 'Quarto';
            } else {
                roomName = selectedRooms.map(r => r.description || 'Quarto').join(', ');
            }
        }

        const tripData = {
            hotelName: packageData.hotelInfo?.name || hotelService?.hotelName || 'Hotel',
            destino: packageData.hotelInfo?.destinationDescription || '',
            checkin: hotelService?.checkIn || hotelService?.startDate || '',
            checkout: hotelService?.checkOut || hotelService?.endDate || '',
            noites: getNumNights(budget),
            quartos: packageData.numRoomsSearched || 1,
            regime: getMealPlan(budget),
            precoTotal: extractPrice(budget),
            roomName: roomName
        };

        return {
            passengers: passengers,
            clientData: clientData,
            tripData: tripData,
            notes: $('#quote-notes').val()?.trim() || ''
        };
    }

    /**
     * Mostrar loading
     */
    function showLoading() {
        const html = `
            <div class="bt-quote-loading">
                <div class="spinner"></div>
                <h3>Carregando detalhes...</h3>
                <p>Aguarde enquanto buscamos as informações do seu pacote</p>
            </div>
        `;
        $('#soltour-quote-page').html(html);
    }

    /**
     * Mostrar erro
     */
    function renderError(title, message) {
        const html = `
            <div class="bt-quote-error">
                <h3>❌ ${title}</h3>
                <p>${message}</p>
                <button type="button" class="bt-btn-back" onclick="window.history.back()">
                    ← Voltar
                </button>
            </div>
        `;
        $('#soltour-quote-page').html(html);
    }

    // ===========================
    // FUNÇÕES AUXILIARES
    // ===========================

    function getHotelMainImage(hotel) {
        if (hotel.mainImage) return hotel.mainImage;
        if (hotel.images && hotel.images.length > 0) return hotel.images[0];
        if (hotel.multimedias && hotel.multimedias.length > 0) {
            const img = hotel.multimedias.find(m => m.type === 'IMAGE');
            if (img) return img.url;
        }
        return null;
    }

    function getHotelLocation(hotel) {
        if (hotel.destinationDescription) return hotel.destinationDescription;
        if (hotel.address) {
            if (typeof hotel.address === 'string') return hotel.address;
            if (hotel.address.city) return hotel.address.city;
        }
        return 'Localização não disponível';
    }

    function getHotelStars(hotel) {
        if (hotel.categoryCode) {
            return (hotel.categoryCode.match(/\*/g) || []).length;
        }
        return 0;
    }

    function extractPrice(budget) {
        if (budget.priceBreakdown?.priceBreakdownDetails?.[0]?.priceInfo?.pvp) {
            return budget.priceBreakdown.priceBreakdownDetails[0].priceInfo.pvp;
        }
        return 0;
    }

    function getNumNights(budget) {
        const hotelService = budget.hotelServices?.[0];
        if (hotelService?.nights) return hotelService.nights;

        // Calcular pela diferença de datas
        const startDate = hotelService?.checkIn || hotelService?.startDate;
        const endDate = hotelService?.checkOut || hotelService?.endDate;

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        }

        return 7; // Default
    }

    function getMealPlan(budget) {
        const hotelService = budget.hotelServices?.[0];
        const mealPlan = hotelService?.mealPlan;

        if (typeof mealPlan === 'string') return mealPlan;
        if (mealPlan?.description) return mealPlan.description;
        if (mealPlan?.code) {
            const codes = {
                'AI': 'Tudo Incluído',
                'PC': 'Pensão Completa',
                'MP': 'Meia Pensão',
                'BB': 'Pequeno Almoço',
                'RO': 'Só Alojamento'
            };
            return codes[mealPlan.code] || mealPlan.code;
        }

        return 'Não especificado';
    }

    function getDates(budget) {
        const hotelService = budget.hotelServices?.[0];
        const startDate = hotelService?.checkIn || hotelService?.startDate;
        const endDate = hotelService?.checkOut || hotelService?.endDate;

        return {
            startDate: startDate ? formatDate(startDate) : 'N/A',
            endDate: endDate ? formatDate(endDate) : 'N/A'
        };
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    function getMaxBirthdate(yearsAgo) {
        const date = new Date();
        date.setFullYear(date.getFullYear() - yearsAgo);
        return date.toISOString().split('T')[0];
    }

    /**
     * Calcular data de nascimento a partir da idade
     * Retorna no formato YYYY-MM-DD
     */
    function calculateBirthDateFromAge(age) {
        const today = new Date();
        const birthYear = today.getFullYear() - age;
        // Usar 1 de janeiro do ano de nascimento como aproximação
        const birthDate = new Date(birthYear, 0, 1);
        return birthDate.toISOString().split('T')[0];
    }

    // ===========================
    // FUNÇÕES DE EXTRAÇÃO DE DADOS
    // ===========================

    /**
     * Extrai dados de transfers do budget
     * Conforme documentação: budget.transferServices[]
     */
    function extractTransferData(budget) {
        const transferServices = budget.transferServices || [];
        const hasTransfers = transferServices.length > 0;

        return {
            hasTransfers: hasTransfers,
            transferServices: transferServices
        };
    }

    /**
     * Extrai dados de cancelamento de todos os serviços
     * Conforme documentação:
     * - hotelServices[].cancellationChargeServices[]
     * - flightServices[].cancellationChargeServices[]
     * - transferServices[].cancellationChargeServices[]
     * - insuranceServices[].cancellationChargeServices[]
     */
    function extractCancellationData(budget) {
        const chargesByService = {
            'HOTEL': [],
            'FLIGHT': [],
            'TRANSFER': [],
            'INSURANCE': []
        };

        // Grupos de serviços
        const serviceGroups = [
            { type: 'HOTEL', services: budget.hotelServices || [], icon: '🏨', label: 'Hotel' },
            { type: 'FLIGHT', services: budget.flightServices || [], icon: '✈️', label: 'Voos' },
            { type: 'TRANSFER', services: budget.transferServices || [], icon: '🚗', label: 'Transfer' },
            { type: 'INSURANCE', services: budget.insuranceServices || [], icon: '🛡️', label: 'Seguro' }
        ];

        // Iterar por todos os grupos
        serviceGroups.forEach(group => {
            group.services.forEach(service => {
                const cancellationServices = service.cancellationChargeServices || [];

                cancellationServices.forEach(cancellation => {
                    chargesByService[group.type].push({
                        serviceType: group.type,
                        serviceIcon: group.icon,
                        serviceLabel: group.label,
                        startDate: cancellation.startDate || null,
                        endDate: cancellation.endDate || null,
                        amount: cancellation.priceInfo?.pvp || 0,
                        currency: cancellation.priceInfo?.currency || 'EUR'
                    });
                });
            });
        });

        // Ordenar por data de início dentro de cada serviço
        Object.keys(chargesByService).forEach(serviceType => {
            chargesByService[serviceType].sort((a, b) => {
                if (!a.startDate || !b.startDate) return 0;
                return new Date(a.startDate) - new Date(b.startDate);
            });
        });

        // Verificar se há pelo menos um serviço com custos
        const hasCharges = Object.values(chargesByService).some(charges => charges.length > 0);

        return {
            chargesByService: chargesByService,
            hasCharges: hasCharges
        };
    }

    /**
     * Extrai dados de seguros da resposta quote
     * Conforme documentação: quoteData.insurances[]
     */
    function extractInsuranceData(packageData) {
        // Verificar se temos quoteData
        const quoteData = packageData.quoteData || packageData.quote;
        if (!quoteData) {
            return { hasInsurances: false, insurances: [] };
        }

        const insurances = quoteData.insurances || [];
        const hasInsurances = insurances.length > 0;

        return {
            hasInsurances: hasInsurances,
            insurances: insurances
        };
    }

    /**
     * Extrai dados de extras da resposta quote
     * Conforme documentação: quoteData.extras[]
     */
    function extractExtrasData(packageData) {
        // Verificar se temos quoteData
        const quoteData = packageData.quoteData || packageData.quote;
        if (!quoteData) {
            return { hasExtras: false, extras: [] };
        }

        const extras = quoteData.extras || [];
        const hasExtras = extras.length > 0;

        return {
            hasExtras: hasExtras,
            extras: extras
        };
    }

    /**
     * Extrai textos legais e condições da resposta quote
     * Conforme documentação: quoteData.importantInformation[]
     */
    function extractLegalData(packageData) {
        // Verificar se temos quoteData
        const quoteData = packageData.quoteData || packageData.quote;
        if (!quoteData) {
            return { hasLegalInfo: false, legalTexts: [] };
        }

        const legalTexts = quoteData.importantInformation || [];
        const hasLegalInfo = legalTexts.length > 0;

        return {
            hasLegalInfo: hasLegalInfo,
            legalTexts: legalTexts
        };
    }

    /**
     * Renderiza card de Transfers
     */
    function renderTransferCard(transferData) {
        if (!transferData || !transferData.hasTransfers || !transferData.transferServices) {
            return ''; // Não mostrar card se não houver transfers
        }

        // Filtrar apenas transfers que têm informação válida (com ou sem preço)
        const validTransfers = transferData.transferServices.filter(transfer => {
            // Transfer é válido se tiver título/descrição OU preço definido
            const hasDescription = transfer.title || transfer.description;
            const hasPrice = transfer.priceInfo?.pvp !== undefined || transfer.price?.pvp !== undefined;
            return hasDescription || hasPrice;
        });

        // Se não houver transfers válidos, não mostrar card
        if (validTransfers.length === 0) {
            return '';
        }

        let html = `
            <div class="bt-summary-section bt-transfer-card">
                <div class="bt-transfer-header">
                    <h3>🚗 TRANSFER PRIVADO</h3>
                    <button class="bt-transfer-toggle" onclick="this.closest('.bt-transfer-card').classList.toggle('expanded')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="bt-transfer-body">
                    <p class="bt-transfer-description">Ofereça ao seu cliente um serviço directo ao hotel num carro privado.</p>
                    <div class="bt-transfer-services">
        `;

        // Renderizar cada serviço de transfer válido
        validTransfers.forEach((transfer, index) => {
            const title = transfer.title || transfer.description || 'Transfer privado';
            const serviceId = transfer.serviceId || `transfer-${index}`;

            // Extrair preço do transfer
            const transferPrice = transfer.priceInfo?.pvp || transfer.price?.pvp || 0;
            const currency = transfer.priceInfo?.currency || transfer.price?.currency || 'EUR';
            const currencySymbol = currency === 'EUR' ? '€' : currency;

            // Verificar se transfer já está incluído no preço
            // Transfer incluído = preço 0 OU propriedade included = true OU status = "INCLUDED"
            const isIncluded = transferPrice === 0 ||
                              transfer.included === true ||
                              transfer.status === 'INCLUDED' ||
                              transfer.priceInfo?.included === true;

            // Se incluído, vem pré-selecionado e bloqueado
            const checkedAttr = isIncluded ? 'checked' : '';
            const disabledAttr = isIncluded ? 'disabled' : '';
            const includedClass = isIncluded ? 'bt-transfer-included' : '';
            const includedLabel = isIncluded ? '<span class="bt-included-badge">Incluído</span>' : '';

            html += `
                <div class="bt-transfer-service ${includedClass}" data-transfer-id="${serviceId}" data-transfer-price="${transferPrice}" data-included="${isIncluded}">
                    <div class="bt-transfer-service-checkbox">
                        <input type="checkbox"
                               id="transfer-checkbox-${index}"
                               class="bt-transfer-checkbox"
                               data-transfer-price="${transferPrice}"
                               data-transfer-id="${serviceId}"
                               data-included="${isIncluded}"
                               ${checkedAttr}
                               ${disabledAttr}>
                        <label for="transfer-checkbox-${index}"></label>
                    </div>
                    <div class="bt-transfer-service-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 17h14v-5H5v5z"/>
                            <path d="M3 13h18M5 17l-2 2M19 17l2 2"/>
                        </svg>
                    </div>
                    <div class="bt-transfer-service-content">
                        <div class="bt-transfer-service-title">
                            ${title}
                            ${includedLabel}
                        </div>
                        <div class="bt-transfer-service-details" style="display: none;">
                            <strong>Preço:</strong> ${isIncluded ? 'Incluído no pacote' : transferPrice.toFixed(2) + currencySymbol}
                        </div>
                    </div>
                    <div class="bt-transfer-service-actions">
                        <a href="#" class="bt-transfer-link" data-transfer-index="${index}">Mais informações</a>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Renderiza card de Gastos de Cancelamento
     */
    function renderCancellationCard(cancellationData) {
        if (!cancellationData.hasCharges) {
            return ''; // Não mostrar card se não houver gastos de cancelamento
        }

        let html = `
            <div class="bt-summary-section bt-cancellation-card expanded">
                <div class="bt-cancellation-header" onclick="this.closest('.bt-cancellation-card').classList.toggle('expanded')">
                    <h3>❌ CUSTOS DE CANCELAMENTO</h3>
                    <button class="bt-cancellation-toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="bt-cancellation-body">
                    <p class="bt-cancellation-description">Os custos de cancelamento variam conforme o serviço e a data. Consulte abaixo os detalhes por categoria:</p>
                    <div class="bt-cancellation-accordion">
        `;

        // Renderizar cada tipo de serviço como um accordion
        const serviceTypes = ['HOTEL', 'FLIGHT', 'TRANSFER', 'INSURANCE'];

        serviceTypes.forEach(serviceType => {
            const charges = cancellationData.chargesByService[serviceType];

            // Só renderizar se houver custos para este serviço
            if (!charges || charges.length === 0) return;

            const firstCharge = charges[0];
            const serviceIcon = firstCharge.serviceIcon;
            const serviceLabel = firstCharge.serviceLabel;

            html += `
                <div class="bt-cancellation-service-item">
                    <div class="bt-cancellation-service-header" onclick="this.closest('.bt-cancellation-service-item').classList.toggle('expanded')">
                        <div class="bt-cancellation-service-title">
                            <span class="bt-service-icon">${serviceIcon}</span>
                            <span class="bt-service-label">${serviceLabel}</span>
                            <span class="bt-service-count">${charges.length} período${charges.length > 1 ? 's' : ''}</span>
                        </div>
                        <svg class="bt-cancellation-service-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="bt-cancellation-service-content">
                        <div class="bt-cancellation-table-wrapper">
                            <table class="bt-cancellation-table">
                                <thead>
                                    <tr>
                                        <th>Período de Cancelamento</th>
                                        <th class="bt-text-right">Custo</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            // Renderizar cada período de cancelamento para este serviço
            charges.forEach((charge, index) => {
                const startDate = charge.startDate ? formatDateSimple(charge.startDate) : 'Desde a reserva';
                const endDate = charge.endDate ? formatDateSimple(charge.endDate) : 'Início da viagem';
                const amount = charge.amount.toFixed(2);
                const currency = charge.currency === 'EUR' ? '€' : charge.currency;

                html += `
                    <tr>
                        <td>
                            <div class="bt-date-range">
                                <span class="bt-date-label">De:</span> <strong>${startDate}</strong>
                                <span class="bt-date-separator">até</span>
                                <span class="bt-date-label">:</span> <strong>${endDate}</strong>
                            </div>
                        </td>
                        <td class="bt-text-right">
                            <span class="bt-amount">${amount}${currency}</span>
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Formatar data no formato dd/mm/yyyy
     */
    function formatDateSimple(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Renderiza card de Seguros
     */
    function renderInsuranceCard(insuranceData) {
        if (!insuranceData || !insuranceData.hasInsurances || !insuranceData.insurances) {
            return ''; // Não mostrar card se não houver seguros
        }

        const insurances = insuranceData.insurances;

        let html = `
            <div class="bt-summary-section bt-insurance-card expanded">
                <div class="bt-insurance-header" onclick="this.closest('.bt-insurance-card').classList.toggle('expanded')">
                    <h3>🛡️ SEGUROS DISPONÍVEIS</h3>
                    <button class="bt-insurance-toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="bt-insurance-body">
                    <p class="bt-insurance-description">Proteja a sua viagem com cobertura completa. Selecione os seguros adicionais que deseja incluir:</p>
                    <div class="bt-insurance-grid">
        `;

        // Renderizar cada seguro disponível
        insurances.forEach((insurance, index) => {
            const name = insurance.name || insurance.title || 'Seguro de Viagem';
            const description = insurance.description || 'Cobertura completa para a sua viagem';
            const price = insurance.priceInfo?.pvp || insurance.price?.pvp || 0;
            const currency = insurance.priceInfo?.currency || insurance.price?.currency || 'EUR';
            const currencySymbol = currency === 'EUR' ? '€' : currency;
            const insuranceId = insurance.insuranceId || insurance.serviceId || `insurance-${index}`;

            // Verificar se já está incluído
            const isIncluded = price === 0 || insurance.included === true || insurance.status === 'INCLUDED';
            const checkedAttr = isIncluded ? 'checked' : '';
            const disabledAttr = isIncluded ? 'disabled' : '';
            const includedClass = isIncluded ? 'bt-insurance-included' : '';

            html += `
                <div class="bt-insurance-item ${includedClass}" data-insurance-id="${insuranceId}" data-insurance-price="${price}" data-included="${isIncluded}">
                    <div class="bt-insurance-item-header">
                        <div class="bt-insurance-item-checkbox">
                            <input type="checkbox"
                                   id="insurance-checkbox-${index}"
                                   class="bt-insurance-checkbox"
                                   data-insurance-price="${price}"
                                   data-insurance-id="${insuranceId}"
                                   data-included="${isIncluded}"
                                   ${checkedAttr}
                                   ${disabledAttr}>
                            <label for="insurance-checkbox-${index}"></label>
                        </div>
                        <div class="bt-insurance-item-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="bt-insurance-item-content">
                        <div class="bt-insurance-item-title">
                            ${name}
                            ${isIncluded ? '<span class="bt-included-badge">Incluído</span>' : ''}
                        </div>
                        <div class="bt-insurance-item-description">
                            ${description}
                        </div>
                        <div class="bt-insurance-item-footer">
                            <div class="bt-insurance-item-price">
                                ${isIncluded ? '<span class="bt-price-included">Incluído no pacote</span>' : `<span class="bt-price-value">${price.toFixed(2)}${currencySymbol}</span>`}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Renderiza card de Extras
     */
    function renderExtrasCard(extrasData) {
        if (!extrasData || !extrasData.hasExtras || !extrasData.extras) {
            return ''; // Não mostrar card se não houver extras
        }

        const extras = extrasData.extras;

        let html = `
            <div class="bt-summary-section bt-extras-card expanded">
                <div class="bt-extras-header" onclick="this.closest('.bt-extras-card').classList.toggle('expanded')">
                    <h3>🎁 SERVIÇOS EXTRAS</h3>
                    <button class="bt-extras-toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="bt-extras-body">
                    <p class="bt-extras-description">Personalize sua viagem com serviços adicionais:</p>
                    <div class="bt-extras-grid">
        `;

        // Renderizar cada extra disponível
        extras.forEach((extra, index) => {
            const name = extra.name || extra.title || extra.description || 'Serviço Extra';
            const description = extra.description || extra.shortDescription || '';
            const price = extra.priceInfo?.pvp || extra.price?.pvp || 0;
            const currency = extra.priceInfo?.currency || extra.price?.currency || 'EUR';
            const currencySymbol = currency === 'EUR' ? '€' : currency;
            const extraId = extra.extraId || extra.serviceId || `extra-${index}`;

            // Verificar se já está incluído
            const isIncluded = price === 0 || extra.included === true || extra.status === 'INCLUDED';
            const checkedAttr = isIncluded ? 'checked' : '';
            const disabledAttr = isIncluded ? 'disabled' : '';
            const includedClass = isIncluded ? 'bt-extra-included' : '';

            html += `
                <div class="bt-extra-item ${includedClass}" data-extra-id="${extraId}" data-extra-price="${price}" data-included="${isIncluded}">
                    <div class="bt-extra-item-header">
                        <div class="bt-extra-item-checkbox">
                            <input type="checkbox"
                                   id="extra-checkbox-${index}"
                                   class="bt-extra-checkbox"
                                   data-extra-price="${price}"
                                   data-extra-id="${extraId}"
                                   data-included="${isIncluded}"
                                   ${checkedAttr}
                                   ${disabledAttr}>
                            <label for="extra-checkbox-${index}"></label>
                        </div>
                        <div class="bt-extra-item-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                        </div>
                    </div>
                    <div class="bt-extra-item-content">
                        <div class="bt-extra-item-title">
                            ${name}
                            ${isIncluded ? '<span class="bt-included-badge">Incluído</span>' : ''}
                        </div>
                        ${description ? `<div class="bt-extra-item-description">${description}</div>` : ''}
                        <div class="bt-extra-item-footer">
                            <div class="bt-extra-item-price">
                                ${isIncluded ? '<span class="bt-price-included">Incluído no pacote</span>' : `<span class="bt-price-value">${price.toFixed(2)}${currencySymbol}</span>`}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Renderiza card de Textos Legais e Condições
     */
    function renderLegalTextsCard(legalData) {
        if (!legalData || !legalData.hasLegalInfo || !legalData.legalTexts) {
            return ''; // Não mostrar card se não houver informações legais
        }

        // Filtrar valores null, undefined ou vazios do array
        const legalTexts = legalData.legalTexts.filter(item => {
            if (item === null || item === undefined) return false;

            // Se for string, verificar se não está vazia
            if (typeof item === 'string') {
                return item.trim().length > 0;
            }

            // Se for objeto, aceitar
            return true;
        });

        // Se após filtrar não houver textos válidos, não mostrar o card
        if (legalTexts.length === 0) {
            return '';
        }

        let html = `
            <div class="bt-summary-section bt-legal-card expanded">
                <div class="bt-legal-header" onclick="this.closest('.bt-legal-card').classList.toggle('expanded')">
                    <h3>INFORMAÇÕES IMPORTANTES E CONDIÇÕES</h3>
                    <button class="bt-legal-toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="bt-legal-body">
                    <p class="bt-legal-intro">Leia atentamente as informações e condições relacionadas à sua viagem:</p>
                    <div class="bt-legal-accordion">
        `;

        // Renderizar cada texto legal como item do accordion
        legalTexts.forEach((legalText, index) => {
            // Se for string, converter para objeto
            let title, content, type, category;

            if (typeof legalText === 'string') {
                // É uma string simples - tentar extrair um título inteligente
                const trimmedText = legalText.trim();
                const firstLine = trimmedText.split('\n')[0].trim();

                // Detectar padrões comuns para criar títulos melhores e categorias
                if (firstLine.toUpperCase().includes('AIR EUROPA')) {
                    title = 'AIR EUROPA - Informações de voo';
                    category = 'flight';
                } else if (firstLine.toUpperCase().includes('IMPORTANTE')) {
                    title = 'Informações importantes';
                    category = 'important';
                } else if (trimmedText.includes('taxa turistica') || trimmedText.includes('taxa turística')) {
                    title = 'Taxa turística';
                    category = 'fees';
                } else if (trimmedText.includes('bagagem') || trimmedText.includes('Bagagem')) {
                    title = 'Política de bagagem';
                    category = 'baggage';
                } else if (trimmedText.includes('E-ticket') || trimmedText.includes('e-ticket')) {
                    title = 'E-ticket - República Dominicana';
                    category = 'documentation';
                } else if (trimmedText.includes('crianças') || trimmedText.includes('Crianças')) {
                    title = 'Política de crianças e acomodação';
                    category = 'accommodation';
                } else if (trimmedText.includes('check-in')) {
                    title = 'Informações de check-in';
                    category = 'checkin';
                } else if (trimmedText.toUpperCase().includes('NO SHOW')) {
                    title = 'Política de NO SHOW';
                    category = 'policy';
                } else if (trimmedText.includes('OBSERVAÇÕES')) {
                    title = 'Observações gerais';
                    category = 'general';
                } else {
                    // Usar as primeiras palavras como título
                    const words = firstLine.split(' ').slice(0, 8).join(' ');
                    title = words.length < firstLine.length ? words + '...' : words;
                    category = 'general';
                }

                content = legalText;
                type = category;
            } else {
                // É um objeto - extrair propriedades
                title = legalText.title || legalText.name || `Informação ${index + 1}`;
                content = legalText.content || legalText.description || legalText.text || '';
                type = legalText.type || 'general';
                category = legalText.category || type;
            }

            // Ícone e cor baseado na categoria
            let icon = '📄';
            let categoryClass = 'general';

            if (category.includes('cancel') || type.includes('cancel')) {
                icon = '❌';
                categoryClass = 'cancel';
            } else if (category.includes('payment') || type.includes('payment')) {
                icon = '💳';
                categoryClass = 'payment';
            } else if (category.includes('insurance') || type.includes('insurance')) {
                icon = '🛡️';
                categoryClass = 'insurance';
            } else if (category.includes('policy') || type.includes('policy')) {
                icon = '📜';
                categoryClass = 'policy';
            } else if (category.includes('flight') || type.includes('flight')) {
                icon = '✈️';
                categoryClass = 'flight';
            } else if (category.includes('hotel') || category.includes('accommodation')) {
                icon = '🏨';
                categoryClass = 'hotel';
            } else if (category.includes('baggage')) {
                icon = '🧳';
                categoryClass = 'baggage';
            } else if (category.includes('important')) {
                icon = '⚠️';
                categoryClass = 'important';
            } else if (category.includes('documentation')) {
                icon = '📄';
                categoryClass = 'documentation';
            } else if (category.includes('fees')) {
                icon = '💰';
                categoryClass = 'fees';
            } else if (category.includes('checkin')) {
                icon = '🔑';
                categoryClass = 'checkin';
            }

            // Formatar conteúdo com quebras de linha preservadas
            const formattedContent = content.replace(/\n/g, '<br>');

            html += `
                <div class="bt-legal-item bt-legal-${categoryClass}" data-legal-type="${type}">
                    <div class="bt-legal-item-header" onclick="this.closest('.bt-legal-item').classList.toggle('expanded')">
                        <div class="bt-legal-item-title-wrapper">
                            <span class="bt-legal-item-title">${title}</span>
                        </div>
                        <svg class="bt-legal-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="bt-legal-item-content">
                        <div class="bt-legal-item-text">${formattedContent}</div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

})(jQuery);
