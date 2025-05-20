function isMobile() {
    // Use a regular expression to test the user agent for mobile devices
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function notifyLoadingStarted() {
    try {
        window.parent.postMessage({
            type: 'loading_status',
            status: 'started',
            timestamp: new Date().getTime()
        }, '*');
        console.log('Sent loading started message to parent');
    } catch (e) {
        console.error('Error sending message to parent:', e);
    }
}

function notifyLoadingComplete() {
    try {
        window.parent.postMessage({
            type: 'loading_status',
            status: 'complete',
            timestamp: new Date().getTime()
        }, '*');
        console.log('Sent loading complete message to parent');
    } catch (e) {
        console.error('Error sending message to parent:', e);
    }
}

// Global variables
let adRotationTimer = null;
let currentAdObserver = null;
let visibilityObserver = null;
let currentRetry = 0;
let alternateSize = false;
const maxRetries = 3;
const adDisplayTime = 20000;
let isActive = true;
let adRemainingTime = adDisplayTime; // Remaining display time
let lastVisibleTimestamp = 0; // Last visible timestamp
let totalVisibleTime = 0; // Total visible time

// Check if IntersectionObserver is supported
const supportsIntersectionObserver = 'IntersectionObserver' in window;

// Create and start ad visibility monitoring
function watchAdVisibility(adElement) {
    // If browser doesn't support IntersectionObserver, start timer without visibility tracking
    if (!supportsIntersectionObserver) {
        console.log('IntersectionObserver not supported. Starting timer without visibility tracking.');
        startAdDisplayTimer();
        return;
    }
    
    // Clear existing visibility observer
    if (visibilityObserver) {
        visibilityObserver.disconnect();
        visibilityObserver = null;
    }
    
    visibilityObserver = new IntersectionObserver((entries) => {
        // Get current timestamp
        const now = Date.now();
        
        // Check ad element visibility
        for (const entry of entries) {
            if (entry.target === adElement) {
                if (entry.isIntersecting) {
                    // Ad is now visible in viewport
                    console.log('Ad is now visible in viewport');
                    lastVisibleTimestamp = now;
                    
                    // If no timer is running, start it
                    if (!adRotationTimer) {
                        startAdDisplayTimer();
                    }
                } else {
                    // Ad is no longer visible in viewport
                    console.log('Ad is no longer visible in viewport');
                    
                    // Calculate elapsed time and add to total visible time
                    if (lastVisibleTimestamp > 0) {
                        const visibleTime = now - lastVisibleTimestamp;
                        totalVisibleTime += visibleTime;
                        
                        // Calculate remaining time needed to display
                        adRemainingTime = adDisplayTime - totalVisibleTime;
                        
                        // Prevent negative values
                        if (adRemainingTime < 0) {
                            adRemainingTime = 0;
                        }
                        
                        console.log(`Ad was visible for ${visibleTime}ms, total visible time: ${totalVisibleTime}ms, remaining needed: ${adRemainingTime}ms`);
                    }
                    
                    // Pause timer
                    if (adRotationTimer) {
                        clearTimeout(adRotationTimer);
                        adRotationTimer = null;
                    }
                }
            }
        }
    }, {
        // Ensure ad is at least 50% visible and visible time is at least 100ms
        threshold: 0.5,
        root: null,
        rootMargin: '0px'
    });
    
    // Start observing the ad element
    visibilityObserver.observe(adElement);
}

// Start ad display timer - using accumulated time logic
function startAdDisplayTimer() {
    // Clear existing timer
    if (adRotationTimer) {
        clearTimeout(adRotationTimer);
        adRotationTimer = null;
    }
    
    // Set new timer to display ad after remaining time
    adRotationTimer = setTimeout(() => {
        if (isActive) {
            console.log(`Ad display time complete (accumulated ${totalVisibleTime}ms of visible time). Loading next ad...`);
            currentRetry = 0;
            
            // When timer expires, alternate ad size to ensure different size is loaded next time
            alternateSize = !alternateSize;
            
            // Stop observers
            if (currentAdObserver) {
                currentAdObserver.disconnect();
                currentAdObserver = null;
            }
            
            if (visibilityObserver) {
                visibilityObserver.disconnect();
                visibilityObserver = null;
            }
            
            // Reset timestamps and accumulated time
            lastVisibleTimestamp = 0;
            totalVisibleTime = 0;
            adRemainingTime = adDisplayTime;
            
            loadAd();
        }
    }, adRemainingTime);
    
    console.log(`Ad display timer started/resumed with ${adRemainingTime}ms remaining to accumulate`);
}

// Initialize new ad timing when new ad successfully loaded
function initializeNewAdTiming() {
    // Reset accumulated time and remaining time
    totalVisibleTime = 0;
    adRemainingTime = adDisplayTime;
    lastVisibleTimestamp = 0;
    
    // If timer exists, clear it
    if (adRotationTimer) {
        clearTimeout(adRotationTimer);
        adRotationTimer = null;
    }
}

// Watch ad status changes
function watchAdStatus(adElement) {
    // Clear previous observer
    if (currentAdObserver) {
        currentAdObserver.disconnect();
        currentAdObserver = null;
    }
    
    // Create new observer
    currentAdObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "attributes") {
                // Check data-ad-status attribute (some AdSense ads use this)
                if (mutation.attributeName === "data-ad-status") {
                    const status = adElement.getAttribute("data-ad-status");
                    
                    if (status === "unfilled") {
                        handleUnfilledAd();
                    } else if (status === "filled") {
                        handleFilledAd();
                    }
                }
                
                // Check data-adsbygoogle-status attribute (another AdSense ad type uses this)
                if (mutation.attributeName === "data-adsbygoogle-status") {
                    const status = adElement.getAttribute("data-adsbygoogle-status");
                    
                    if (status === "done") {
                        // Ad loaded, check if it was filled
                        // Some ads are marked as done but have no content, we check height
                        setTimeout(() => {
                            if (adElement.clientHeight > 10) {
                                handleFilledAd();
                            } else {
                                handleUnfilledAd();
                            }
                        }, 100); // Short delay to ensure DOM updates complete
                    }
                }
            }
        }
    });
    
    // Helper function: handle unfilled ad
    function handleUnfilledAd() {
        console.log(`Ad unfilled (attempt ${currentRetry + 1} of ${maxRetries})`);
        
        // If ad is unfilled and retry count is not exceeded, try alternate size
        if (currentRetry < maxRetries) {
            currentRetry++;
            alternateSize = !alternateSize;
            
            // Hide unfilled ad
            adElement.style.display = "none";
            
            console.log(`Retrying with ${alternateSize ? 'alternate' : 'standard'} size...`);
            loadAd();
        } else {
            console.log('Max retry attempts reached, resetting counter and trying again');
            // Reset retry counter and try new ad immediately
            currentRetry = 0;
            // Do not reset size state, keep alternating sizes
            loadAd();
        }
    }
    
    // Helper function: handle filled ad
    function handleFilledAd() {
        console.log('Ad filled successfully');
        // Reset retry counter
        currentRetry = 0;
        
        // Initialize new ad timing
        initializeNewAdTiming();
        
        // Start observing ad visibility
        watchAdVisibility(adElement);
    }
    
    // Observe all attribute changes
    currentAdObserver.observe(adElement, { 
        attributes: true, 
        attributeFilter: ["data-ad-status", "data-adsbygoogle-status"] 
    });
}

function loadAd() {
    if (!isActive) return;
    
    const adsContainer = document.getElementById("ads-container");
    if (!adsContainer) return;
    
    let adHTML;
    const isMobileDevice = isMobile();
    
    if (isMobileDevice) {
        if (alternateSize) {
            adHTML = `
                <!-- Loading-Screen-Mobile-Alternate -->
                <ins class="adsbygoogle"
                    style="display:inline-block;width:320px;height:50px"
                    data-ad-client="ca-pub-8722128765990495"
                    data-ad-slot="1407046431"></ins>
            `;
        } else {
            adHTML = `
                <!-- Loading-Screen-Mobile -->
                <ins class="adsbygoogle"
                    style="display:inline-block;width:300px;height:50px"
                    data-ad-client="ca-pub-8722128765990495"
                    data-ad-slot="2482578164"></ins>
            `;
        }
    } else {
        if (alternateSize) {
            adHTML = `
                <!-- Loading-Screen-Desktop-Alternate -->
                <ins class="adsbygoogle"
                    style="display:inline-block;width:468px;height:60px"
                    data-ad-client="ca-pub-8722128765990495"
                    data-ad-slot="2720128100"></ins>
            `;
        } else {
            adHTML = `
                <!-- Loading-Screen-Desktop -->
                <ins class="adsbygoogle"
                    style="display:inline-block;width:728px;height:90px"
                    data-ad-client="ca-pub-8722128765990495"
                    data-ad-slot="1277307707"></ins>
            `;
        }
    }
    
    // Clear container and inject new ad HTML
    adsContainer.innerHTML = adHTML;
    
    // Get newly created ad element
    const adElement = adsContainer.querySelector('.adsbygoogle');
    
    if (adElement) {
        // Initialize ad status listener
        watchAdStatus(adElement);
        
        // Initialize AdSense
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
            console.log(`Ad request sent (${alternateSize ? 'alternate' : 'standard'} size)`);
        } catch (e) {
            console.error('Error initializing AdSense:', e);
        }
    }
}

// Stop ad rotation
function stopAdRotation() {
    isActive = false;
    if (adRotationTimer) {
        clearTimeout(adRotationTimer);
        adRotationTimer = null;
    }
    if (currentAdObserver) {
        currentAdObserver.disconnect();
        currentAdObserver = null;
    }
    if (visibilityObserver) {
        visibilityObserver.disconnect();
        visibilityObserver = null;
    }
}

// Start ad rotation
function startAdRotation() {
    isActive = true;
    
    const adsContainer = document.getElementById("ads-container");
    if (!adsContainer) return;
    
    // Check if in iframe and cross-origin iframe
    const isInIframe = window !== window.top;
    let isCrossDomain = false;
    try {
        // Try accessing parent window's location
        const parentLocation = window.parent.location.href;
    } catch (e) {
        console.log('Cross-origin iframe detected');
        isCrossDomain = true;
    }
    
    // Check IntersectionObserver support
    if ('IntersectionObserver' in window) {
        console.log('Using IntersectionObserver to monitor ads container visibility');
        
        const containerObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    console.log('Ads container is visible, loading ad now');
                    // Container visible, load ad
                    loadAd();
                    // Stop observing container visibility
                    containerObserver.disconnect();
                }
            }
        }, {
            threshold: 0.2  // When 20% visible, trigger
        });
        
        // Start observing ads container
        containerObserver.observe(adsContainer);
    } else {
        // If IntersectionObserver is not supported, load ad immediately
        console.log('IntersectionObserver not supported, loading ad immediately');
        loadAd();
    }
}

// Define the list of disable iframe ads
const disallowAdsDomains = ["xxxx.com"];

// Extract the referrer domain
const referrer = document.referrer;
let referrerDomain = "";

if (referrer) {
    try {
        const url = new URL(referrer);
        referrerDomain = url.hostname;
    } catch (e) {
        console.warn("Invalid referrer URL:", referrer);
    }
}

// Check if the referrer domain is in the disallowed list or if referrerDomain is empty
const isDisallowedAds = !referrerDomain || disallowAdsDomains.some(domain => referrerDomain.includes(domain));

// Notify loading started
notifyLoadingStarted();

// Immediately start ad rotation (without waiting for DOMContentLoaded)
if (!isDisallowedAds) {
    startAdRotation();
}

document.addEventListener("DOMContentLoaded", function() {
    if (isMobile()) {
        document.body.classList.add('mobile-device');
    }
    
    // Notify loading complete
    notifyLoadingComplete();
    
    // Listen for changes to the hidden attribute of the loading element
    const loadingScreen = document.getElementById("loading");
    const adsContainer = document.getElementById("ads-container");
    
    if (loadingScreen && adsContainer) {
        const observer = new MutationObserver(() => {
            if (loadingScreen.hidden && adsContainer) {
                stopAdRotation(); // Stop ad rotation
                adsContainer.remove(); // Remove ads container
            }
        });
        observer.observe(loadingScreen, { attributes: true, attributeFilter: ["hidden"] });
    }
});