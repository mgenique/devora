'use strict';

var ApiMethods = {
  async api(url, opts) {
    const res  = await fetch(url, opts);
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },

  async loadSprint() {
    this.loading = true;
    try {
      const [sprintData, repoList] = await Promise.all([
        this.api('/api/sprint'),
        this.api('/api/repos'),
      ]);
      this.sprint = sprintData.sprint || null;
      this.issues = sprintData.issues || [];
      this.repos  = repoList;
    } catch (_) {
      this.issues = [];
      this.sprint = null;
    } finally {
      this.loading = false;
    }
  },

  async selectTicket(key) {
    if (this.currentIssue?.key === key && this.detailState !== 'error') return;

    this.currentIssue     = { key, loading: true };
    this.devResult        = null;
    this.selectedComments = [];

    if (this.$refs.detailPanel) this.$refs.detailPanel.scrollTop = 0;

    try {
      const issue = await this.api(`/api/ticket/${key}`);
      this.currentIssue = issue;
      await this.$nextTick();
      if (this.$refs.detailPanel) this.$refs.detailPanel.scrollTop = 0;
    } catch (err) {
      this.currentIssue = { key, error: err.message };
    }
  },
};
