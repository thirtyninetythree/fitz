// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "processTryOn") {
        // Find the image with the matching URL
        const images = document.querySelectorAll('img');
        let targetImage = null;
        
        for (const img of images) {
            if (img.src === message.imageUrl) {
                targetImage = img;
                break;
            }
        }
        
        if (!targetImage) {
            console.error('Could not find image with URL:', message.imageUrl);
            alert('Error: Could not find the image on the page.');
            return;
        }
        
        // Show loading indicator on the image
        const overlay = createLoadingOverlay(targetImage);
        
        // Send the image URL to the background script for processing
        chrome.runtime.sendMessage(
            {
                action: "sendImageUrlToApi",
                imageUrl: message.imageUrl
            },
            function(response) {
                // Remove the loading overlay
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                
                if (chrome.runtime.lastError) {
                    console.error("Error in API call:", chrome.runtime.lastError.message);
                    alert(`Error: ${chrome.runtime.lastError.message}`);
                    return;
                }
                
                if (!response) {
                    console.error("No response received from background script");
                    alert("No response received. Is the extension running?");
                    return;
                }
                
                if (response.success) {
                    // Replace the image with the processed version
                    if (response.data && response.data.replacementImageUrl) {
                        targetImage.src = response.data.replacementImageUrl;
                        // Show success indicator
                        showSuccessIndicator(targetImage);
                    } else {
                        console.warn('No replacement image URL in response');
                        alert('API response did not contain a replacement image.');
                    }
                } else {
                    console.error('API call failed:', response.error);
                    alert(`API Error: ${response.error}`);
                }
            }
        );
    }
});

// Create a loading overlay to show while processing
function createLoadingOverlay(imageElement) {
    const rect = imageElement.getBoundingClientRect();
    const overlay = document.createElement('div');
    
    overlay.style.position = 'absolute';
    overlay.style.left = window.scrollX + rect.left + 'px';
    overlay.style.top = window.scrollY + rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';
    
    const spinner = document.createElement('div');
    spinner.textContent = '⏳ Processing...';
    spinner.style.color = 'white';
    spinner.style.fontWeight = 'bold';
    spinner.style.padding = '10px';
    spinner.style.borderRadius = '5px';
    spinner.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
    
    return overlay;
}

// Show a brief success indicator
function showSuccessIndicator(imageElement) {
    const rect = imageElement.getBoundingClientRect();
    const indicator = document.createElement('div');
    
    indicator.style.position = 'absolute';
    indicator.style.left = window.scrollX + rect.right - 80 + 'px';
    indicator.style.top = window.scrollY + rect.top + 10 + 'px';
    indicator.style.padding = '8px 12px';
    indicator.style.backgroundColor = 'rgba(0, 150, 0, 0.8)';
    indicator.style.color = 'white';
    indicator.style.borderRadius = '5px';
    indicator.style.fontWeight = 'bold';
    indicator.style.zIndex = '9999';
    indicator.textContent = '✓ Try-On Complete!';
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 2000);
}