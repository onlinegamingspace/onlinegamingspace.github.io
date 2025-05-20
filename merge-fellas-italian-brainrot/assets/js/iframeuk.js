window.addEventListener('load', function() {
    // M1
    window.open = function(url) {
        return null;
    };
	
    // (function() {
    //     const originalOpen = window.open;
    //     window.open = function(url, target) {
    //         if (url === 'https://xxx.com/') {
    //             console.log('Redirecting to new URL');
    //             return originalOpen.call(window, 'https://sprunkiscrunkly.com/', target);
    //         }
    //         return originalOpen.apply(window, arguments);
    //     };
    // })();
});