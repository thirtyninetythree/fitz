// Global flag to track if the extension is active on the current page
let isExtensionActive = true; // Default to true, will be updated from storage

/**
 * Applies the hover effects, wrapper, and indicator button to a single image element.
 * @param {HTMLImageElement} img - The image element to process.
 */
function applyEffectsToImage(img) {
    // Skip images that are too small (like icons) - Check dimensions again here in case they loaded late
    // Use naturalWidth/Height if available and rendered width/height are zero.
    const imgWidth = img.offsetWidth || img.naturalWidth;
    const imgHeight = img.offsetHeight || img.naturalHeight;

    if (imgWidth < 50 || imgHeight < 50) {
        // console.log('Skipping small image:', img.src, imgWidth, 'x', imgHeight);
        return;
    }

    // Skip images that already have our wrapper/marker
    if (img.classList.contains('image-replacer-ready') || img.closest('.image-replacer-container')) {
        // console.log('Skipping already processed image:', img.src);
        return;
    }

     // Skip images that are inside links
     if (img.closest('a[href]')) {
        console.log('Skipping linked image:', img.src);
        return;
    }

    console.log('Processing image:', img.src);

    // --- 1. Create Wrapper Container ---
    const container = document.createElement('div');
    container.className = 'image-replacer-container';
    // No fixed width/height - let it size naturally via CSS (display: inline-block)

    // --- 2. Create Corner Indicator Button ---
    const indicator = document.createElement('div');
    indicator.className = 'image-replacer-indicator';
    indicator.innerHTML = '<div class="image-replacer-btn">👕</div>'; // Initial state

    // --- 3. DOM Manipulation: Replace image with container -> put image and indicator inside ---
    // Try/catch for robustness in case img.parentNode is null during dynamic changes
    try {
        img.parentNode.insertBefore(container, img);
        container.appendChild(img); // Move image into container
        container.appendChild(indicator); // Add indicator into container

    } catch (e) {
        console.error('Failed to wrap image:', img.src, e);
        return; // Stop processing this image if wrapping failed
    }


    // --- 4. Hover Effects (managed by adding/removing a class on the container) ---
    container.addEventListener('mouseenter', function() {
        container.classList.add('container-hover');
    });

    container.addEventListener('mouseleave', function() {
        container.classList.remove('container-hover');
    });

    // --- 5. Indicator Click Handler ---
    indicator.addEventListener('click', function(event) {
        event.stopPropagation(); // *** Prevent click from bubbling to parent links etc. ***
        console.log('Indicator clicked for image:', img.src);

        // Visual feedback: Show loading
        indicator.innerHTML = '<div class="image-replacer-btn">⏳</div>';
        indicator.classList.add('indicator-loading'); // Add class for specific loading style if needed
        container.classList.add('container-hover'); // Keep hover effect visible during loading

        // Send image URL to background script
        chrome.runtime.sendMessage(
            {
                action: "sendImageUrlToApi",
                imageUrl: img.src
            },
            function(response) {
                // Always remove loading state class, regardless of outcome
                indicator.classList.remove('indicator-loading');

                if (chrome.runtime.lastError) {
                    console.error("Error sending message:", chrome.runtime.lastError.message);
                    alert(`Error contacting background script: ${chrome.runtime.lastError.message}`);
                    resetIndicator();
                    return;
                }

                if (!response) {
                    console.error("No response received from background script.");
                    alert("No response received from the background script. Is it running?");
                    resetIndicator();
                    return;
                }

                if (response.success) {
                    console.log('API call successful:', response.data);

                    // Replace image with the one returned from the API
                    if (response.data && response.data.replacementImageUrl) {
                        img.src = response.data.replacementImageUrl; // Replace the image source
                        console.log('Image replaced with:', response.data.replacementImageUrl);

                        // Show success indicator briefly
                        indicator.innerHTML = '<div class="image-replacer-btn">✓</div>';
                        indicator.classList.add('indicator-success'); // Add class for styling
                        setTimeout(() => {
                            // Check if container still exists before resetting
                            if(document.body.contains(container)){
                                resetIndicator();
                                indicator.classList.remove('indicator-success');
                                // Decide if hover effect should persist or not after success
                                // container.classList.remove('container-hover');
                            }
                        }, 2000); // Show success for 2 seconds

                    } else {
                        console.warn('API Success, but no replacement image URL in response');
                        // alert('API response did not contain a replacement image.'); // Maybe too noisy
                        resetIndicator();
                    }
                } else {
                    console.error('API call failed:', response.error);
                    alert(`API Error: ${response.error}`);
                    resetIndicator();
                }
            }
        );
    });

    // Function to reset indicator to default state
    function resetIndicator() {
         // Check if indicator still exists before trying to change it
         if(document.body.contains(indicator)){
            indicator.innerHTML = '<div class="image-replacer-btn">👕</div>';
            indicator.classList.remove('indicator-loading', 'indicator-success');
            // Decide if hover state should be removed on reset
            // container.classList.remove('container-hover');
         }
    }

    // Mark image as processed *by adding class to the image itself*
    img.classList.add('image-replacer-ready');
    // console.log('Image processing complete for:', img.src);
}

/**
 * Sets up hover effects for all relevant images currently on the page.
 */
function setupImageHoverEffects() {
    if (!isExtensionActive) {
        console.log('Extension is not active, skipping setup.');
        return;
    }
    console.log('Setting up image hover effects...');
    document.querySelectorAll('img:not(.image-replacer-ready)').forEach(img => {
        // Check parent isn't already a container to avoid double-processing in edge cases
        if (!img.closest('.image-replacer-container')) {
            applyEffectsToImage(img);
        }
    });
}

/**
 * Removes all wrappers, indicators, and event listeners added by the extension.
 */
function cleanupImageHoverEffects() {
    console.log('Cleaning up image hover effects...');
    document.querySelectorAll('.image-replacer-container').forEach(container => {
        const img = container.querySelector('img.image-replacer-ready');
        if (img) {
            // Move the image back out to replace the container
            container.replaceWith(img);
            // Clean marker class from the image
            img.classList.remove('image-replacer-ready');
        } else {
            // If somehow the container is empty or image is missing, just remove container
            container.remove();
        }
        // Event listeners on container and indicator are removed automatically when container is removed/replaced
    });
    console.log('Cleanup complete.');
}

// --- Initialization and Settings Handling ---

// Load initial active state from storage
chrome.storage.local.get(['isExtensionActive'], function (data) {
    // If the value exists in storage, use it; otherwise, stick to the default (true)
    if (data.hasOwnProperty('isExtensionActive')) {
        isExtensionActive = data.isExtensionActive;
    }
    console.log('Initial extension active state:', isExtensionActive);

    // Initial setup or cleanup based on loaded state
    if (isExtensionActive) {
        setupImageHoverEffects();
    } else {
        cleanupImageHoverEffects(); // Clean up if loaded as inactive
    }
    // Start observing AFTER initial setup/cleanup is done based on stored state
    startObserverIfActive();
});

// Listen for messages from the popup (or background)
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log('Message received:', message);

    if (message.action === "updateSettings") {
        const previouslyActive = isExtensionActive;
        // Update active state based on message
        if (message.hasOwnProperty('isExtensionActive')) {
             isExtensionActive = message.isExtensionActive;
        }

        console.log('Settings updated. Active:', isExtensionActive);

        // If state changed, setup or cleanup accordingly
        if (isExtensionActive && !previouslyActive) {
            setupImageHoverEffects();
            startObserverIfActive(); // Start observer if activating
        } else if (!isExtensionActive && previouslyActive) {
            stopObserver(); // Stop observer if deactivating
            cleanupImageHoverEffects();
        }
        // Send simple acknowledgement response
        sendResponse({status: "Settings received"});
    }
     // Handle other actions like API responses if sent back to content script
     // else if (message.action === "apiResponse") { ... }
});

// --- Mutation Observer ---

let observer = null; // Initialize observer variable

const observerCallback = function (mutations) {
    // No need to check isExtensionActive here if we disconnect the observer when inactive
    let processed = false;
    mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                // Check if the added node itself is an image
                if (node.nodeName === 'IMG' && !node.classList.contains('image-replacer-ready')) {
                    applyEffectsToImage(node);
                    processed = true;
                }
                // Check if the added node contains images (and is an Element node)
                else if (node.nodeType === 1) { // Check if it's an Element node
                    node.querySelectorAll('img:not(.image-replacer-ready)').forEach(img => {
                         // Check parent isn't already a container to avoid double-processing
                        if (!img.closest('.image-replacer-container')) {
                            applyEffectsToImage(img);
                            processed = true;
                        }
                    });
                }
            });
        }
        // Optional: Handle attribute changes if needed (e.g., src changes on existing images)
        // else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        //    const imgElement = mutation.target;
        //    // Potentially re-evaluate the image if src changes? Depends on requirements.
        // }
    });
    // if (processed) {
    //     console.log('Mutation observer processed new images.');
    // }
};

function startObserverIfActive() {
    if (isExtensionActive && !observer) {
        console.log('Starting Mutation Observer...');
        observer = new MutationObserver(observerCallback);
        observer.observe(document.body, {
            childList: true,
            subtree: true
            // attributes: true, // Uncomment if you need to watch for attribute changes like src
            // attributeFilter: ['src'] // Example filter
        });
    }
}

function stopObserver() {
    if (observer) {
        console.log('Stopping Mutation Observer...');
        observer.disconnect();
        observer = null;
    }
}


// --- Initial Run Logic ---

// Ensure setup runs after DOM is ready, respecting initial active state loaded from storage
function runInitialSetup() {
     if (isExtensionActive) {
         console.log('Running initial setup...');
        setupImageHoverEffects();
        startObserverIfActive(); // Also start observer on initial load if active
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialSetup);
} else {
    // Already loaded or interactive
    runInitialSetup();
}