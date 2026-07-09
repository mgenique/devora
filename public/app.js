'use strict';

function app() {
  return Object.assign(
    {
      // ── Jira state ─────────────────────────────────────────
      loading: false,
      sprint: null,
      issues: [],
      currentIssue: null,
      repos: [],
      searchQuery: '',

      devMode: 'dev',
      instructions: '',
      svgItems: [],
      svgNewTitle: '',
      svgNewContent: '',
      selectedRepo: '',
      useOnemFrontend: false,
      challengeDesignSystem: false,
      dangerouslyGrantPermissions: false,
      devResult: null,
      selectedComments: [],

      // ── Settings state ─────────────────────────────────────
      settingsOpen:  false,
      settingsTab:   'jira',
      settingsMsg:   '',
      settingsMsgOk: true,

      // Jira settings
      boards:        [],
      boardId:       '',
      reposPath:     '',
      designSystemPath: '',
      apiToken:      '',
      hasToken:      false,
      suggestCommit: true,
      commitFormat:  '',

      // Azure persistent settings
      azurePat:     '',
      azureHasPat:  false,
      azureWatches: [],

      // Azure picker state (transient, used only inside settings modal)
      azureProjects:        [],
      azureProjectsLoading: false,
      azurePickProject:     '',
      azurePickRepos:       [],
      azurePickRepoId:      '',
      azurePickBranches:    [],
      azurePickBranch:      '',

      // ── Azure topbar state ─────────────────────────────────
      azureStatus:  [],
      azureLoading: false,

      // ── SonarQube topbar state ──────────────────────────────
      sonarCoverage:  [],
      sonarLoading:   false,

      // SonarQube settings
      sonarBaseUrl:   '',
      sonarToken:     '',
      sonarHasToken:  false,
      sonarProjects:  [],
      sonarNewName:   '',
      sonarNewKey:    '',

      // ── Computed ───────────────────────────────────────────
      get filteredIssues() {
        const q = (this.searchQuery || '').toLowerCase().trim();
        if (!q) return this.issues;
        return this.issues.filter(i =>
          i.key.toLowerCase().includes(q) ||
          (i.fields.summary || '').toLowerCase().includes(q) ||
          (i.fields.assignee?.displayName || '').toLowerCase().includes(q)
        );
      },

      get groupedIssues() {
        const groups = {};
        for (const issue of this.filteredIssues) {
          const s = issue.fields.status?.name || 'Other';
          (groups[s] = groups[s] || []).push(issue);
        }
        const rankMap = { 'in progress': 0, 'in review': 1, 'to do': 2, 'done': 3 };
        function rank(name) {
          const n = (name || '').toLowerCase();
          for (const [k, v] of Object.entries(rankMap)) if (n.includes(k)) return v;
          return 4;
        }
        return Object.entries(groups).sort(([a], [b]) => rank(a) - rank(b));
      },

      get stats() {
        const done = this.issues.filter(i =>
          (i.fields.status?.name || '').toLowerCase() === 'done'
        ).length;
        return `${done} / ${this.issues.length} done`;
      },

      get browseUrl() {
        try {
          const origin = new URL(this.currentIssue.self).origin;
          return `${origin}/browse/${this.currentIssue.key}`;
        } catch { return '#'; }
      },

      get imageAttachments() {
        return (this.currentIssue?.fields?.attachment || []).filter(
          a => a.mimeType?.startsWith('image/')
        );
      },

      get comments() {
        const raw      = this.currentIssue?.fields?.comment?.comments || [];
        const rendered = this.currentIssue?.renderedFields?.comment?.comments || [];
        return raw.map((c, i) => ({ ...c, renderedBody: rendered[i]?.body || '' }));
      },

      get detailState() {
        if (!this.currentIssue)          return 'empty';
        if (this.currentIssue.loading)   return 'loading';
        if (this.currentIssue.error)     return 'error';
        return 'content';
      },

      // ── Init + keyboard ───────────────────────────────────
      async init() {
        await this.loadSprint();
        const saved = localStorage.getItem('devora_repo');
        if (saved && this.repos.includes(saved)) this.selectedRepo = saved;
        this.$watch('selectedRepo', val => { if (val) localStorage.setItem('devora_repo', val); });

        this.useOnemFrontend = localStorage.getItem('devora_onem_skill') === 'true';
        this.$watch('useOnemFrontend', val => localStorage.setItem('devora_onem_skill', val));

        this.challengeDesignSystem = localStorage.getItem('devora_challenge_ds') === 'true';
        this.$watch('challengeDesignSystem', val => localStorage.setItem('devora_challenge_ds', val));

        this.dangerouslyGrantPermissions = localStorage.getItem('devora_dangerous_perms') === 'true';
        this.$watch('dangerouslyGrantPermissions', val => localStorage.setItem('devora_dangerous_perms', val));

        try { this.svgItems = JSON.parse(localStorage.getItem('devora_svgs')) || []; } catch { this.svgItems = []; }

        await this.loadAzureStatus();
        setInterval(() => this.loadAzureStatus(), 60000);

        await this.loadSonarCoverage();
        setInterval(() => this.loadSonarCoverage(), 5 * 60 * 1000);
      },

      handleKeydown(e) {
        if (e.key === 'Escape') {
          if (this.buildFixOpen) { this.buildFixOpen = false; return; }
          if (this.settingsOpen) this.settingsOpen = false;
        }
      },
    },
    ApiMethods,
    SettingsMethods,
    DevMethods,
    UIHelpers,
    AzureMethods,
    BuildFixMethods,
    SonarMethods
  );
}
