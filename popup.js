document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings when popup opens
  chrome.storage.local.get(['userImageBase64', 'isExtensionActive'], function(data) {
    if (data.userImageBase64) {
      // Display the previously uploaded image
      document.getElementById('imagePreview').style.backgroundImage = `url(${data.userImageBase64})`;
      document.getElementById('imagePreview').innerHTML = '';
    }
    
    if (data.hasOwnProperty('isExtensionActive')) {
      document.getElementById('extensionToggle').checked = data.isExtensionActive;
    }
  });
  
  // Handle file upload button
  document.getElementById('uploadButton').addEventListener('click', function() {
    document.getElementById('fileInput').click();
  });
  
  // Handle file selection
  document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.style.backgroundImage = `url(${e.target.result})`;
        imagePreview.innerHTML = '';
      };
      reader.readAsDataURL(file);
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
            isExtensionActive: isActive
          });
        }
      });
    });
  });
  
  // Save settings when button is clicked
  document.getElementById('saveButton').addEventListener('click', function() {
    const fileInput = document.getElementById('fileInput');
    const isExtensionActive = document.getElementById('extensionToggle').checked;
    
    if (fileInput.files.length === 0 && !document.getElementById('imagePreview').style.backgroundImage) {
      showStatus('Please upload an image of yourself.', false);
      return;
    }
    
    // If a new file is selected, read it
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const userImageBase64 = e.target.result;
        
        // Save to storage
        chrome.storage.local.set({
          userImageBase64: userImageBase64,
          isExtensionActive: isExtensionActive
        }, function() {
          showStatus('Settings saved successfully!', true);
          
          // Update active tab
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateSettings",
                userImageBase64: userImageBase64,
                isExtensionActive: isExtensionActive
              });
            }
          });
        });
      };
      
      reader.readAsDataURL(file);
    } else {
      // No new file selected, use existing image
      chrome.storage.local.get(['userImageBase64'], function(data) {
        if (data.userImageBase64) {
          chrome.storage.local.set({
            isExtensionActive: isExtensionActive
          }, function() {
            showStatus('Settings saved successfully!', true);
            
            // Update active tab
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "updateSettings",
                  userImageBase64: data.userImageBase64,
                  isExtensionActive: isExtensionActive
                });
              }
            });
          });
        }
      });
    }
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