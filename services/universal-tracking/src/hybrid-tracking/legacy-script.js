/**
 * Legacy Script - Eski scriptlerle uyumluluk
 * Bu script eski tracking-sdk.js'i taklit eder
 */

(function() {
    'use strict';
    
    console.log('🔄 Legacy script yüklendi - Eski scriptlerle uyumluluk sağlanıyor...');
    
    // Eski global namespace'i kur
    window.UniversalTracking = {
        // Eski init metodu
        init: function(config) {
            console.log('🔄 Legacy init çağrıldı:', config);
            
            // Yeni hibrit sistemi başlat
            if (window.HybridUniversalTracking) {
                const hybridConfig = {
                    customerId: config.site_id || config.customerId || 'unknown',
                    domain: config.domain || window.location.hostname,
                    debug: config.debug || false
                };
                
                window.HybridUniversalTracking.init(hybridConfig);
            } else {
                console.warn('⚠️ Hibrit sistem bulunamadı, legacy modda çalışıyor');
            }
        },
        
        // Eski track metodu
        track: function(eventType, data) {
            console.log('🔄 Legacy track çağrıldı:', eventType, data);
            
            if (window.HybridUniversalTracking) {
                window.HybridUniversalTracking.trackEvent({
                    event_type: eventType,
                    metadata: data
                });
            }
        },
        
        // Eski pageView metodu
        pageView: function(url) {
            console.log('🔄 Legacy pageView çağrıldı:', url);
            
            if (window.HybridUniversalTracking) {
                window.HybridUniversalTracking.trackPageView();
            }
        },
        
        // Eski heartbeat metodu (artık kullanılmıyor ama uyumluluk için)
        heartbeat: function() {
            console.warn('⚠️ Legacy heartbeat çağrıldı - artık kullanılmıyor, pageView kullanın');
            
            if (window.HybridUniversalTracking) {
                window.HybridUniversalTracking.trackPageView();
            }
        },
        
        // Eski bye metodu (artık kullanılmıyor ama uyumluluk için)
        bye: function() {
            console.warn('⚠️ Legacy bye çağrıldı - artık kullanılmıyor, pageView kullanın');
            
            if (window.HybridUniversalTracking) {
                window.HybridUniversalTracking.trackEvent({
                    event_type: 'page_unload',
                    metadata: { legacy_method: 'bye' }
                });
            }
        },
        
        // Eski presence metodu
        presence: {
            beat: function() {
                console.warn('⚠️ Legacy presence beat çağrıldı - artık kullanılmıyor, pageView kullanın');
                
                if (window.HybridUniversalTracking) {
                    window.HybridUniversalTracking.trackPageView();
                }
            },
            
            bye: function() {
                console.warn('⚠️ Legacy presence bye çağrıldı - artık kullanılmıyor, pageView kullanın');
                
                if (window.HybridUniversalTracking) {
                    window.HybridUniversalTracking.trackEvent({
                        event_type: 'page_unload',
                        metadata: { legacy_method: 'presence_bye' }
                    });
                }
            }
        },
        
        // Eski ecommerce metodu
        ecommerce: {
            track: function(eventType, data) {
                console.log('🔄 Legacy ecommerce track çağrıldı:', eventType, data);
                
                if (window.HybridUniversalTracking) {
                    window.HybridUniversalTracking.trackEcommerceEvent(eventType, data);
                }
            }
        }
    };
    
    // Eski API endpoint'lerini mock'la
    const originalFetch = window.fetch;
    
    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : input.toString();
        
        // Eski endpoint'leri yakala
        if (url.includes('/presence/beat')) {
            console.warn('⚠️ Eski /presence/beat endpoint çağrıldı, hibrit sisteme yönlendiriliyor...');
            
            if (window.HybridUniversalTracking) {
                window.HybridUniversalTracking.trackPageView();
            }
            
            return Promise.resolve(new Response(JSON.stringify({ 
                success: true, 
                message: 'Legacy endpoint - redirected to hybrid system' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        
        if (url.includes('/presence/bye')) {
            console.warn('⚠️ Eski /presence/bye endpoint çağrıldı, hibrit sisteme yönlendiriliyor...');
            
            if (window.HybridUniversalTracking) {
                window.HybridUniversalTracking.trackEvent({
                    event_type: 'page_unload',
                    metadata: { legacy_method: 'presence_bye' }
                });
            }
            
            return Promise.resolve(new Response(JSON.stringify({ 
                success: true, 
                message: 'Legacy endpoint - redirected to hybrid system' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        
        if (url.includes('/presence/collect/events')) {
            console.warn('⚠️ Eski /presence/collect/events endpoint çağrıldı, hibrit sisteme yönlendiriliyor...');
            
            // Eski event data'sını parse et ve yeni sisteme gönder
            if (init && init.body) {
                try {
                    const eventData = JSON.parse(init.body);
                    
                    if (window.HybridUniversalTracking) {
                        window.HybridUniversalTracking.trackEvent({
                            event_type: eventData.event_type || 'unknown',
                            metadata: eventData
                        });
                    }
                } catch (error) {
                    console.warn('Legacy event data parse edilemedi:', error);
                }
            }
            
            return Promise.resolve(new Response(JSON.stringify({ 
                success: true, 
                message: 'Legacy endpoint - redirected to hybrid system' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        
        // Diğer istekleri normal şekilde işle
        return originalFetch(input, init);
    };
    
    console.log('✅ Legacy support aktif - Eski scriptler çalışacak');
})();
