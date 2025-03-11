document.addEventListener('DOMContentLoaded', () => {
    const colorInput = document.getElementById('markerColor');
    const textInput = document.getElementById('markerText');
    const saveButton = document.getElementById('saveSettings');
    const clearButton = document.getElementById('clearList');

    // Load saved settings
    chrome.storage.sync.get({
        markerColor: '#ff0000',
        markerText: '(Отказ)'
    }, (items) => {
        colorInput.value = items.markerColor;
        textInput.value = items.markerText;
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        chrome.storage.sync.set({
            markerColor: colorInput.value,
            markerText: textInput.value
        }, () => {
            // Notify content script to update markers
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateMarkers'
                });
            });
        });
    });

    // Clear blocked list
    clearButton.addEventListener('click', () => {
        chrome.storage.local.set({storedIds: []}, () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'clearMarkers'
                });
            });
        });
    });
});