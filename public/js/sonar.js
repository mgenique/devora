'use strict';

var SonarMethods = {
  sonarCoverage:  [],
  sonarLoading:   false,

  sonarBaseUrl:   '',
  sonarToken:     '',
  sonarHasToken:  false,
  sonarProjects:  [],
  sonarNewName:   '',
  sonarNewKey:    '',

  async loadSonarCoverage() {
    this.sonarLoading = true;
    try {
      this.sonarCoverage = await this.api('/api/sonar/coverage');
    } catch (_) {
      this.sonarCoverage = [];
    } finally {
      this.sonarLoading = false;
    }
  },

  sonarCoverageColour(coverage) {
    if (coverage === null || coverage === undefined) return 'neutral';
    if (coverage >= 80) return 'green';
    if (coverage >= 60) return 'yellow';
    return 'red';
  },

  sonarBadgeClass(coverage) {
    const c = this.sonarCoverageColour(coverage);
    return {
      green:   'text-green-400',
      yellow:  'text-yellow-400',
      red:     'text-red-400',
      neutral: 'text-neutral-500',
    }[c];
  },

  async openSonarTab() {
    this.settingsTab = 'sonar';
    try {
      const cfg          = await this.api('/api/sonar/config');
      this.sonarBaseUrl  = cfg.baseUrl   || '';
      this.sonarHasToken = cfg.hasToken  || false;
      this.sonarToken    = '';
      this.sonarProjects = (cfg.projects || []).map(p => ({ ...p }));
      this.sonarNewName  = '';
      this.sonarNewKey   = '';
    } catch (_) {}
  },

  addSonarProject() {
    const name = (this.sonarNewName || '').trim();
    const key  = (this.sonarNewKey  || '').trim();
    if (!name || !key) return;
    if (this.sonarProjects.some(p => p.key === key)) return;
    this.sonarProjects.push({ name, key });
    this.sonarNewName = '';
    this.sonarNewKey  = '';
  },

  removeSonarProject(idx) {
    this.sonarProjects.splice(idx, 1);
  },
};
