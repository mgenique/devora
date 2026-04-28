'use strict';

var UIHelpers = {
  typeClass(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('story'))                        return 'bg-blue-950 text-blue-300';
    if (t.includes('bug'))                          return 'bg-red-950 text-red-300';
    if (t.includes('task') && !t.includes('sub'))   return 'bg-green-950 text-green-300';
    if (t.includes('epic'))                         return 'bg-purple-950 text-purple-300';
    if (t.includes('sub'))                          return 'bg-amber-950 text-amber-300';
    return 'bg-neutral-800 text-neutral-400';
  },

  statusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('progress'))                                    return 'bg-blue-950 text-blue-300';
    if (s.includes('review') || s.includes('test'))                return 'bg-orange-950 text-orange-300';
    if (s === 'done' || s === 'closed' || s === 'resolved')        return 'bg-green-950 text-green-300';
    return 'bg-neutral-800 text-neutral-500';
  },

  initials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  proxyUrl(url) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  },
};
