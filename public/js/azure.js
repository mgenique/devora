'use strict';

var AzureMethods = {
  azureStatus:  [],
  azureLoading: false,

  async loadAzureStatus() {
    this.azureLoading = true;
    try {
      this.azureStatus = await this.api('/api/azure/status');
    } catch (_) {
      this.azureStatus = [];
    } finally {
      this.azureLoading = false;
    }
  },

  bubbleClass(colour) {
    const map = {
      green: 'bg-green-500',
      red:   'bg-red-500',
      blue:  'bg-blue-400 animate-pulse',
      grey:  'bg-neutral-600',
    };
    return map[colour] || 'bg-neutral-600';
  },
};
