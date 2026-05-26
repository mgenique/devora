'use strict';

var BuildFixMethods = {
  buildFixOpen:         false,
  buildFixLoading:      false,
  buildFixWatch:        null,
  buildFixContext:      null,
  buildFixInstructions: '',
  buildFixRepo:         '',
  buildFixMode:         'dev',
  buildFixResult:       null,

  async openBuildFix(watch) {
    this.buildFixWatch        = watch;
    this.buildFixContext      = null;
    this.buildFixInstructions = '';
    this.buildFixResult       = null;
    this.buildFixRepo         = this.selectedRepo || '';
    this.buildFixMode         = 'dev';
    this.buildFixOpen         = true;
    await this.loadBuildContext(watch.project, watch.buildId);
  },

  async loadBuildContext(project, buildId) {
    this.buildFixLoading = true;
    try {
      this.buildFixContext = await this.api(
        `/api/azure/build-context/${encodeURIComponent(project)}/${buildId}`
      );
    } catch (err) {
      this.buildFixContext = { error: err.message };
    } finally {
      this.buildFixLoading = false;
    }
  },

  async launchBuildFix() {
    if (!this.buildFixRepo) return;
    this.buildFixResult = { launching: true };
    try {
      const result = await this.api('/api/fix-build', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          buildContext:  this.buildFixContext,
          instructions:  this.buildFixInstructions,
          repo:          this.buildFixRepo,
          mode:          this.buildFixMode,
          suggestCommit: this.suggestCommit,
          commitFormat:  this.commitFormat,
        }),
      });
      this.buildFixResult = result;
    } catch (err) {
      this.buildFixResult = { error: err.message };
    }
  },
};
