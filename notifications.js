const notifications = {
  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    return result;
  },

  getPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  async schedule(userId) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const settings = await dbApi.getByKey('settings', userId) || { userId };
    if (settings.notifications === false) return;

    const all = await tasks.listByUser(userId);
    const today = utils.today();
    const remindDays = parseInt(settings.remindDays) || 1;
    const remindThreshold = utils.addDays(today, remindDays);

    const dueSoon = all.filter(t =>
      !t.deletedAt &&
      t.status !== 'done' &&
      t.dueDate <= remindThreshold &&
      t.dueDate >= today &&
      t.lastNotified !== today
    );

    if (dueSoon.length) {
      try {
        new Notification('任务管家提醒', {
          body: `你有 ${dueSoon.length} 项任务即将到期，请尽快处理`,
          icon: './icons/icon.svg',
          badge: './icons/icon.svg',
          tag: 'task-reminder-' + today
        });
      } catch (e) { /* ignore notification error */ }
      for (const t of dueSoon) {
        t.lastNotified = today;
        await dbApi.put('tasks', t);
      }
    }
  },

  async checkAndSchedule(userId) {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 8 || hour > 22) return;
    await this.schedule(userId);
  }
};
