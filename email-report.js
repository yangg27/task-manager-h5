const emailReport = {
  async generateWeeklyReport(userId) {
    const today = utils.today();
    const { start, end } = utils.getWeekRange(today);
    const year = parseInt(today.slice(0, 4));
    const month = parseInt(today.slice(5, 7));
    const monthStart = today.slice(0, 8) + '01';
    const monthEnd = today.slice(0, 8) + String(new Date(year, month, 0).getDate()).padStart(2, '0');

    const all = await tasks.listByUser(userId);
    const weekTasks = all.filter(t => !t.deletedAt && t.dueDate >= start && t.dueDate <= end);
    const monthTasks = all.filter(t => !t.deletedAt && t.dueDate >= monthStart && t.dueDate <= monthEnd);
    const completed = monthTasks.filter(t => t.status === 'done');
    const pendingWeek = weekTasks.filter(t => t.status !== 'done');

    const lines = [
      '本周任务提醒',
      `生成时间：${utils.formatDateTime(new Date().toISOString())}`,
      '',
      `【本月已完成】${completed.length} 项`,
      ...completed.map(t => `✓ ${utils.formatDate(t.dueDate)} ${t.title}`),
      '',
      `【本周应完成】${pendingWeek.length} 项`,
      ...pendingWeek.map(t => `□ ${utils.formatDate(t.dueDate)} ${t.title}`),
      '',
      '来自：任务管家'
    ];
    return lines.join('\n');
  },

  openMailClient(email, subject, body) {
    const to = encodeURIComponent(email || '');
    const sub = encodeURIComponent(subject || '本周任务提醒');
    const b = encodeURIComponent(body || '');
    window.location.href = `mailto:${to}?subject=${sub}&body=${b}`;
  }
};
