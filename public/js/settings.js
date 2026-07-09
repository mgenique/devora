'use strict';

var SettingsMethods = {

  async openSettings() {
    this.settingsOpen  = true;
    this.settingsTab   = 'jira';
    this.settingsMsg   = '';
    this._resetAzurePicker();

    const cfgPromise    = this.api('/api/config');
    const boardsPromise = this.api('/api/boards');
    const azurePromise  = this.api('/api/azure/config');
    const sonarPromise  = this.api('/api/sonar/config');

    let savedBoardId = '';
    try {
      const cfg          = await cfgPromise;
      this.reposPath     = cfg.reposPath     || '';
      this.designSystemPath = cfg.designSystemPath || '';
      this.hasToken      = cfg.hasToken      || false;
      this.apiToken      = '';
      this.suggestCommit = cfg.suggestCommit ?? true;
      this.commitFormat  = cfg.commitFormat  || '';
      savedBoardId       = String(cfg.boardId || '');
    } catch (err) {
      this.settingsMsg   = err.message;
      this.settingsMsgOk = false;
    }

    try {
      this.boards  = await boardsPromise;
      this.boardId = savedBoardId;
    } catch (_) {}

    try {
      const az          = await azurePromise;
      this.azureHasPat  = az.hasPat  || false;
      this.azurePat     = '';
      this.azureWatches = az.watches || [];
    } catch (_) {}

    try {
      const sq           = await sonarPromise;
      this.sonarBaseUrl  = sq.baseUrl   || '';
      this.sonarHasToken = sq.hasToken  || false;
      this.sonarToken    = '';
      this.sonarProjects = (sq.projects || []).map(p => ({ ...p }));
    } catch (_) {}
  },

  async saveSettings() {
    this.settingsMsg = '';
    try {
      const jiraBody = {
        reposPath:     this.reposPath,
        designSystemPath: this.designSystemPath,
        boardId:       this.boardId,
        suggestCommit: this.suggestCommit,
        commitFormat:  this.commitFormat,
      };
      if (this.apiToken.trim()) jiraBody.apiToken = this.apiToken.trim();

      const azureBody = {
        watches: this.azureWatches,
      };
      if (this.azurePat.trim()) azureBody.pat = this.azurePat.trim();

      const sonarBody = { baseUrl: this.sonarBaseUrl, projects: this.sonarProjects };
      if (this.sonarToken.trim()) sonarBody.token = this.sonarToken.trim();

      await Promise.all([
        this.api('/api/config', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jiraBody),
        }),
        this.api('/api/azure/config', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(azureBody),
        }),
        this.api('/api/sonar/config', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sonarBody),
        }),
      ]);

      this.repos = await this.api('/api/repos');
      await Promise.all([this.loadSprint(), this.loadAzureStatus(), this.loadSonarCoverage()]);

      this.settingsMsg   = 'Saved.';
      this.settingsMsgOk = true;
      setTimeout(() => { this.settingsMsg = ''; this.settingsOpen = false; }, 1000);
    } catch (err) {
      this.settingsMsg   = err.message;
      this.settingsMsgOk = false;
    }
  },

  // ── Azure tab ─────────────────────────────────────────────

  async openAzureTab() {
    this.settingsTab = 'azure';
    this._resetAzurePicker();
    await this.loadAzureProjects();
  },

  async loadAzureProjects() {
    this.azureProjectsLoading = true;
    this.azureProjects        = [];
    this._resetAzurePicker();
    try {
      this.azureProjects = await this.api('/api/azure/projects');
    } catch (_) {
      this.azureProjects = [];
    } finally {
      this.azureProjectsLoading = false;
    }
  },

  async onAzureProjectSelect() {
    this.azurePickRepoId   = '';
    this.azurePickRepos    = [];
    this.azurePickBranches = [];
    this.azurePickBranch   = '';
    if (!this.azurePickProject) return;
    try {
      const repos = await this.api(`/api/azure/repos/${encodeURIComponent(this.azurePickProject)}`);
      this.azurePickRepos = repos;
      if (repos.length === 1) {
        this.azurePickRepoId = repos[0].id;
        await this.onAzureRepoSelect();
      }
    } catch (_) {}
  },

  async onAzureRepoSelect() {
    this.azurePickBranches = [];
    this.azurePickBranch   = '';
    if (!this.azurePickProject || !this.azurePickRepoId) return;
    try {
      this.azurePickBranches = await this.api(
        `/api/azure/branches/${encodeURIComponent(this.azurePickProject)}/${this.azurePickRepoId}`
      );
    } catch (_) {}
  },

  addAzureWatch() {
    if (!this.azurePickProject || !this.azurePickRepoId || !this.azurePickBranch) return;
    const dupe = this.azureWatches.some(
      w => w.repoId === this.azurePickRepoId && w.branch === this.azurePickBranch
    );
    if (dupe) return;
    const repo = this.azurePickRepos.find(r => r.id === this.azurePickRepoId);
    this.azureWatches.push({
      project:  this.azurePickProject,
      repoId:   this.azurePickRepoId,
      repoName: repo?.name || this.azurePickRepoId,
      branch:   this.azurePickBranch,
    });
    // Keep project+repo selected so the user can quickly add another branch
    this.azurePickBranch = '';
  },

  removeAzureWatch(idx) {
    this.azureWatches.splice(idx, 1);
  },

  _resetAzurePicker() {
    this.azureProjects        = [];
    this.azureProjectsLoading = false;
    this.azurePickProject     = '';
    this.azurePickRepos       = [];
    this.azurePickRepoId      = '';
    this.azurePickBranches    = [];
    this.azurePickBranch      = '';
  },
};
