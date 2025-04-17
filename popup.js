document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings when popup opens
    chrome.storage.local.get(['replacementImageUrl', 'isExtensionActive'], function(data) {
      if (data.replacementImageUrl) {
        document.getElementById('replacementImageUrl').value = data.replacementImageUrl;
      }
      
      if (data.hasOwnProperty('isExtensionActive')) {
        document.getElementById('extensionToggle').checked = data.isExtensionActive;
      }
    });
  
    // Toggle extension active state
    document.getElementById('extensionToggle').addEventListener('change', function() {
      const isActive = this.checked;
      
      chrome.storage.local.set({
        isExtensionActive: isActive
      }, function() {
        // Notify content script of the change
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateSettings",
              isExtensionActive: isActive,
              replacementImageUrl: document.getElementById('replacementImageUrl').value
            });
          }
        });
      });
    });
  
    // Save settings when button is clicked
    document.getElementById('saveButton').addEventListener('click', function() {
      const replacementImageUrl = document.getElementById('replacementImageUrl').value;
      const isExtensionActive = document.getElementById('extensionToggle').checked;
      
      // Validate inputs
      if (!replacementImageUrl) {
        showStatus('Please enter a replacement image URL.', false);
        return;
      }
      
      // Save to storage
      chrome.storage.local.set({
        replacementImageUrl: replacementImageUrl,
        isExtensionActive: isExtensionActive
      }, function() {
        showStatus('Settings saved successfully!', true);
        
        // Update active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateSettings",
              replacementImageUrl: replacementImageUrl,
              isExtensionActive: isExtensionActive
            });
          }
        });
      });
    });
    
    function showStatus(message, isSuccess) {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message;
      statusElement.style.display = 'block';
      
      if (isSuccess) {
        statusElement.className = 'status success';
      } else {
        statusElement.className = 'status error';
      }
      
      // Hide status after 3 seconds
      setTimeout(function() {
        statusElement.style.display = 'none';
      }, 3000);
    }
  });