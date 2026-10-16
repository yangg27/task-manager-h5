const calendar = {
  async build(year, month, userId) {
    const { start, end, lastDay } = utils.getMonthRange(year, month);
    const firstDayWeek = new Date(year, month - 1, 1).getDay() || 7;
    const allTasks = await tasks.listByDateRange(userId, start, end);
    const holidays = await this.getHolidays(year);

    const days = [];
    for (let i = 1; i < firstDayWeek; i++) days.push({ type: 'empty' });
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = allTasks.filter(t => t.dueDate === dateStr);
      const isHoliday = holidays[dateStr];
      const isWeekend = [0, 6].includes(new Date(dateStr + 'T00:00:00').getDay());
      let level = 'none';
      if (dayTasks.length >= 4) level = 'high';
      else if (dayTasks.length >= 1) level = 'medium';
      days.push({ type: 'day', date: dateStr, day: d, tasks: dayTasks, level, isHoliday, isWeekend });
    }
    return days;
  },

  async getHolidays(year) {
    try {
      const cached = await dbApi.getByKey('holidays', 'cache');
      if (cached && cached.year === year) return cached.map;
    } catch (e) { /* ignore cache read error */ }

    const map = {};
    const weekends = new Set();
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const w = d.getDay();
      const s = d.toISOString().slice(0, 10);
      if (w === 0 || w === 6) weekends.add(s);
    }

    const fixed = {
      [`${year}-01-01`]: '元旦',
      [`${year}-05-01`]: '劳动节',
      [`${year}-10-01`]: '国庆节',
      [`${year}-10-02`]: '国庆节',
      [`${year}-10-03`]: '国庆节'
    };

    const lunarBased = this.estimateLunarHolidays(year);
    Object.assign(fixed, lunarBased);

    for (const s of weekends) {
      if (!fixed[s]) fixed[s] = '周末';
    }

    try {
      await dbApi.put('holidays', { date: 'cache', year, map: fixed });
    } catch (e) { /* ignore cache write error */ }
    return fixed;
  },

  estimateLunarHolidays(year) {
    const approx = {
      '春节': [1, 22], '清明节': [4, 4], '端午节': [5, 31],
      '中秋节': [9, 21], '劳动节调休': [5, 1]
    };
    const map = {};
    for (const [name, [m, d]] of Object.entries(approx)) {
      const s = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      map[s] = name;
    }
    return map;
  }
};
