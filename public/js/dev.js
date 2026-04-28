'use strict';

var DevMethods = {
  async startDev() {
    if (!this.selectedRepo) return;

    const rf       = this.currentIssue.renderedFields || {};
    const parser   = new DOMParser();
    const doc      = parser.parseFromString(rf.description || '', 'text/html');
    const descText = doc.body.innerText || doc.body.textContent || '';

    const attachments = (this.currentIssue.fields.attachment || [])
      .filter(a => a.mimeType?.startsWith('image/'))
      .map(a => ({ url: a.content, filename: a.filename }));

    const selectedCommentData = this.selectedComments.map(id => {
      const c = this.comments.find(c => c.id === id);
      if (!c) return null;
      const d    = parser.parseFromString(c.renderedBody || '', 'text/html');
      const text = (d.body.innerText || d.body.textContent || '').trim();
      return { author: c.author?.displayName || 'Unknown', text };
    }).filter(Boolean);

    this.devResult = { launching: true };

    try {
      const result = await this.api('/api/start-dev', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ticketKey:         this.currentIssue.key,
          ticketTitle:       this.currentIssue.fields.summary,
          ticketDescription: descText,
          instructions:      this.instructions,
          attachments,
          mode:              this.devMode,
          repo:              this.selectedRepo,
          useOnemFrontend:   this.useOnemFrontend,
          suggestCommit:     this.suggestCommit,
          commitFormat:      this.commitFormat,
          comments:          selectedCommentData,
        }),
      });
      this.devResult = result;
    } catch (err) {
      this.devResult = { error: err.message };
    }
  },

  toggleComment(id) {
    const idx = this.selectedComments.indexOf(id);
    if (idx === -1) this.selectedComments.push(id);
    else this.selectedComments.splice(idx, 1);
  },
};
