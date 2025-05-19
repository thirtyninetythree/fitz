// Handles communication with the Gemini API and context menu creation

//DYOUR API KEY GOES HERE
const GEMINI_API_KEY = "";
const IMAGE_GEN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`;
const CONTEXT_MENU_ID = "IMAGE_TRY_ON_MENU_ITEM"
const GENERATION_PROMPT = `
        Transfer the face from the second image onto clothing from the first image (a model wearing the outfit). 
        Make it look natural and realistic, as if the user is wearing the clothing. 
        Preserve the user's face, body shape, and pose. 
        Do not alter any facial features or the overall identity of the user — only the clothing should change.`;


// Create context menu item when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "Fit This Look",
        contexts: ["image"]
    });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
        // Send message to content script to process the image
        chrome.tabs.sendMessage(tab.id, {
            action: "processTryOn",
            imageUrl: info.srcUrl
        });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "sendImageUrlToApi") {
        const imageUrl = message.imageUrl;
        console.log("Background: Received request to send URL to Gemini API:", imageUrl);

        // Process the image with Gemini API
        processImageWithGemini(imageUrl)
            .then(result => {
                console.log("Background: API Success Response:", result);
                sendResponse({
                    success: true,
                    data: result,
                });
            })
            .catch(error => {
                console.error("Background: API Call Error:", error);
                sendResponse({
                    success: false,
                    error: error.message || "Unknown API error"
                });
            });

        return true; // Indicates you wish to send a response asynchronously
    }
});

/**
 * Process the image URL with the Gemini API
 * @param {string} imageUrl - The URL of the image to process
 * @return {Promise} - A promise that resolves with the API response
 */
async function processImageWithGemini(imageUrl) {
    try {
        // First, we need to fetch the image and convert it to base64
        const imageBase64 = await fetchImageAsBase64(imageUrl);

        // Get the user's image from storage
        const userImageData = await new Promise((resolve) => {
            chrome.storage.local.get(['userImageBase64'], function (data) {
                if (data.userImageBase64) {
                    // Extract base64 data without the prefix
                    const base64Data = data.userImageBase64.split(',')[1];
                    resolve(base64Data);
                } else {
                    resolve(null);
                }
            });
        });

        // If no user image, return an error
        if (!userImageData) {
            console.log("No user image found, asking user to upload an image");
            throw new Error("Please upload your photo in the extension popup first!");
        }

        console.log("User image found, using it for virtual try-on");

        // Prepare the request payload with both images
        const generationPayload = {
            contents: [{
                parts: [
                    { text: GENERATION_PROMPT },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageBase64  // Fashion item image
                        }
                    },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: userImageData  // User's image
                        }
                    }
                ]
            }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"]
            }
        };


        // Send the request to Gemini image editing API
        const generationResponse = await fetch(IMAGE_GEN_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(generationPayload)
        });


        if (!generationResponse.ok) {
            let errorDetails = `HTTP status ${generationResponse.status}`;
            try {
                const errorData = await generationResponse.json();
                errorDetails += `: ${JSON.stringify(errorData)}`;
            } catch (e) { /* Ignore if response is not JSON */ }
            throw new Error(errorDetails);
        }

        const generationData = await generationResponse.json();
        console.log("Gemini Image Generation API response:", generationData);

        // Extract the generated image data
        let base64Image = "";
        if (generationData.candidates && generationData.candidates[0] && generationData.candidates[0].content &&
            generationData.candidates[0].content.parts) {

            for (const part of generationData.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }
        }

        if (!base64Image) {
            throw new Error("No image data found in the API response");
        }

        // Convert the base64 data to a data URL for an image
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        return {
            replacementImageUrl: dataUrl
        };

    } catch (error) {
        console.error("Error processing image with Gemini:", error);
        throw error;
    }
}

/**
 * Fetch an image and convert it to base64
 * @param {string} imageUrl - The URL of the image to fetch
 * @return {Promise<string>} - A promise that resolves with the base64-encoded image
 */
async function fetchImageAsBase64(imageUrl) {
    try {
        // Use a proxy if needed to avoid CORS issues
        const fetchResponse = await fetch(imageUrl);

        if (!fetchResponse.ok) {
            throw new Error(`Failed to fetch image: ${fetchResponse.status}`);
        }

        const blob = await fetchResponse.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove the data URL prefix (e.g. "data:image/jpeg;base64,")
                const base64data = reader.result.split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image to base64:", error);
        throw error;
    }
}

console.log("Background script loaded with context menu support.");