const tasks = {
  async create(data) {
    if (!auth.currentUser) throw new Error('请先登录');
    const id = utils.uuid();
    const now = new Date().toISOString();
    const task = {
      id,
      userId: auth.currentUser.id,
      title: data.title?.trim() || '未命名任务',
      content: data.content?.trim() || '',
      dueDate: data.dueDate || utils.today(),
      status: data.status || 'pending',
      priority: data.priority || 'normal',
      category: data.category || '工作',
      tags: (data.tags || '').toString().trim(),
      progress: data.progress || 0,
      repeat: data.repeat || null,
      createdAt: now,
      updatedAt: now
    };
    await dbApi.put('tasks', task);
    if (data.subtasks?.length) {
      for (const st of data.subtasks) {
        await dbApi.put('subtasks', { id: utils.uuid(), taskId: task.id, title: st.title?.trim() || '', done: !!st.done, createdAt: now });
      }
      await this.updateSubtaskProgress(task.id);
    }
    if (task.repeat && !data._skipRepeat) await this.spawnRepeat(task);
    return task;
  },

  async update(id, data) {
    const task = await dbApi.getByKey('tasks', id);
    if (!task) throw new Error('任务不存在');
    if (task.userId !== auth.currentUser?.id) throw new Error('无权修改');
    Object.assign(task, data, { updatedAt: new Date().toISOString() });
    await dbApi.put('tasks', task);
    return task;
  },

  async delete(id) {
    const task = await dbApi.getByKey('tasks', id);
    if (!task) throw new Error('任务不存在');
    if (task.userId !== auth.currentUser?.id) throw new Error('无权删除');
    task.deletedAt = new Date().toISOString();
    await dbApi.put('tasks', task);
  },

  async permanentDelete(id) {
    const task = await dbApi.getByKey('tasks', id);
    if (!task) throw new Error('任务不存在');
    if (task.userId !== auth.currentUser?.id) throw new Error('无权删除');
    await dbApi.delete('tasks', id);
    const progressList = await dbApi.queryByIndex('progress', 'taskId', id);
    for (const p of progressList) await dbApi.delete('progress', p.id);
    const attachments = await dbApi.queryByIndex('attachments', 'taskId', id);
    for (const a of attachments) await dbApi.delete('attachments', a.id);
    const subtasks = await dbApi.queryByIndex('subtasks', 'taskId', id);
    for (const s of subtasks) await dbApi.delete('subtasks', s.id);
    const templates = await dbApi.queryByIndex('templates', 'userId', auth.currentUser.id);
    for (const tpl of templates) {
      if (tpl.sourceTaskId === id) await dbApi.delete('templates', tpl.id);
    }
  },

  async restore(id) {
    const task = await dbApi.getByKey('tasks', id);
    if (!task) throw new Error('任务不存在');
    if (task.userId !== auth.currentUser?.id) throw new Error('无权修改');
    delete task.deletedAt;
    task.updatedAt = new Date().toISOString();
    await dbApi.put('tasks', task);
  },

  async getById(id) {
    return dbApi.getByKey('tasks', id);
  },

  async listByUser(userId, includeDeleted = false) {
    const all = await dbApi.queryByIndex('tasks', 'userId', userId);
    return includeDeleted ? all : all.filter(t => !t.deletedAt);
  },

  async listByDateRange(userId, start, end) {
    const all = await this.listByUser(userId);
    return all.filter(t => t.dueDate >= start && t.dueDate <= end).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },

  async listByDate(userId, dateStr) {
    const all = await this.listByUser(userId);
    return all.filter(t => t.dueDate === dateStr).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  },

  async addProgress(taskId, content, attachments = []) {
    const id = utils.uuid();
    const now = new Date().toISOString();
    const record = { id, taskId, content: content?.trim() || '', attachments, createdAt: now };
    await dbApi.put('progress', record);
    await this.update(taskId, { updatedAt: now });
    return record;
  },

  async getProgress(taskId) {
    const list = await dbApi.queryByIndex('progress', 'taskId', taskId);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addAttachment(taskId, file) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) throw new Error('单个文件大小不能超过 10MB');
    const id = utils.uuid();
    const dataUrl = await utils.readFileAsBase64(file);
    const attachment = {
      id,
      taskId,
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
      createdAt: new Date().toISOString()
    };
    await dbApi.put('attachments', attachment);
    return attachment;
  },

  async getAttachments(taskId) {
    return dbApi.queryByIndex('attachments', 'taskId', taskId);
  },

  async deleteAttachment(id) {
    return dbApi.delete('attachments', id);
  },

  async search(userId, keyword) {
    const all = await this.listByUser(userId);
    const k = keyword.trim().toLowerCase();
    if (!k) return all;
    return all.filter(t =>
      (t.title || '').toLowerCase().includes(k) ||
      (t.content || '').toLowerCase().includes(k) ||
      (t.tags || '').toLowerCase().includes(k) ||
      (t.category || '').toLowerCase().includes(k)
    );
  },

  async filter(userId, { category, tag, status }) {
    let all = await this.listByUser(userId);
    if (category) all = all.filter(t => t.category === category);
    if (tag) all = all.filter(t => (t.tags || '').split(/[,，]/).map(x => x.trim()).includes(tag));
    if (status) all = all.filter(t => t.status === status);
    return all;
  },

  async listDeleted(userId) {
    const all = await dbApi.queryByIndex('tasks', 'userId', userId);
    return all.filter(t => t.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  },

  async exportAll(userId) {
    const user = await dbApi.getByKey('users', userId);
    const taskList = await dbApi.queryByIndex('tasks', 'userId', userId);
    const progressList = [];
    const attachments = [];
    const subtasks = [];
    const templates = await dbApi.queryByIndex('templates', 'userId', userId);
    for (const t of taskList) {
      progressList.push(...(await dbApi.queryByIndex('progress', 'taskId', t.id)));
      attachments.push(...(await dbApi.queryByIndex('attachments', 'taskId', t.id)));
      subtasks.push(...(await dbApi.queryByIndex('subtasks', 'taskId', t.id)));
    }
    return { exportAt: new Date().toISOString(), user: { id: user.id, email: user.email, phone: user.phone, name: user.name }, tasks: taskList, progress: progressList, attachments, subtasks, templates };
  },

  async importAll(userId, data) {
    if (!data || !Array.isArray(data.tasks)) throw new Error('无效备份文件');
    const ownedTaskIds = new Set();
    for (const t of data.tasks) {
      if (!t.id || t.userId !== userId) continue;
      ownedTaskIds.add(t.id);
      t.userId = userId;
      await dbApi.put('tasks', t);
    }
    if (Array.isArray(data.progress)) {
      for (const p of data.progress) {
        if (p.taskId && ownedTaskIds.has(p.taskId)) await dbApi.put('progress', { ...p, id: p.id || utils.uuid() });
      }
    }
    if (Array.isArray(data.attachments)) {
      for (const a of data.attachments) {
        if (a.taskId && ownedTaskIds.has(a.taskId) && (a.dataUrl || '').startsWith('data:')) await dbApi.put('attachments', { ...a, id: a.id || utils.uuid(), userId });
      }
    }
    if (Array.isArray(data.subtasks)) {
      for (const s of data.subtasks) {
        if (s.taskId && ownedTaskIds.has(s.taskId)) await dbApi.put('subtasks', { ...s, id: s.id || utils.uuid() });
      }
    }
    if (Array.isArray(data.templates)) {
      for (const t of data.templates) {
        if (t.userId === userId) await dbApi.put('templates', { ...t, id: t.id || utils.uuid(), userId });
      }
    }
  },

  async getSubtasks(taskId) {
    return dbApi.queryByIndex('subtasks', 'taskId', taskId);
  },

  async addSubtask(taskId, title) {
    const id = utils.uuid();
    const sub = { id, taskId, title: title?.trim() || '', done: false, createdAt: new Date().toISOString() };
    await dbApi.put('subtasks', sub);
    await this.updateSubtaskProgress(taskId);
    return sub;
  },

  async toggleSubtask(id) {
    const sub = await dbApi.getByKey('subtasks', id);
    if (!sub) throw new Error('子任务不存在');
    sub.done = !sub.done;
    sub.updatedAt = new Date().toISOString();
    await dbApi.put('subtasks', sub);
    await this.updateSubtaskProgress(sub.taskId);
    return sub;
  },

  async deleteSubtask(id) {
    const sub = await dbApi.getByKey('subtasks', id);
    if (!sub) return;
    await dbApi.delete('subtasks', id);
    await this.updateSubtaskProgress(sub.taskId);
  },

  async updateSubtaskProgress(taskId) {
    const subs = await this.getSubtasks(taskId);
    if (!subs.length) return;
    const done = subs.filter(s => s.done).length;
    const progress = Math.round((done / subs.length) * 100);
    const status = progress === 100 ? 'done' : progress > 0 ? 'doing' : 'pending';
    await this.update(taskId, { progress, status });
  },

  async spawnRepeat(task) {
    if (!task.repeat) return;
    const base = new Date(task.dueDate + 'T00:00:00');
    let nextDate;
    switch (task.repeat) {
      case 'daily': nextDate = new Date(base.setDate(base.getDate() + 1)); break;
      case 'weekly': nextDate = new Date(base.setDate(base.getDate() + 7)); break;
      case 'monthly': nextDate = new Date(base.setMonth(base.getMonth() + 1)); break;
      case 'yearly': nextDate = new Date(base.setFullYear(base.getFullYear() + 1)); break;
      default: return;
    }
    const dueDate = nextDate.toISOString().slice(0, 10);
    const existing = await dbApi.queryByIndex('tasks', 'userId', task.userId);
    if (existing.some(t => t.title === task.title && t.dueDate === dueDate && t.repeat === task.repeat)) return;
    const { id, createdAt, updatedAt, status, progress, ...rest } = task;
    await this.create({ ...rest, dueDate, status: 'pending', progress: 0, _skipRepeat: true });
  },

  async saveTemplate(taskId, name) {
    const task = await this.getById(taskId);
    if (!task) throw new Error('任务不存在');
    const subs = await this.getSubtasks(taskId);
    const tpl = {
      id: utils.uuid(),
      userId: auth.currentUser.id,
      sourceTaskId: taskId,
      name: name?.trim() || task.title,
      title: task.title,
      content: task.content,
      category: task.category,
      priority: task.priority,
      tags: task.tags,
      subtasks: subs.map(s => ({ title: s.title })),
      createdAt: new Date().toISOString()
    };
    await dbApi.put('templates', tpl);
    return tpl;
  },

  async listTemplates(userId) {
    return dbApi.queryByIndex('templates', 'userId', userId);
  },

  async deleteTemplate(id) {
    return dbApi.delete('templates', id);
  },

  async applyTemplate(tplId, dueDate) {
    const tpl = await dbApi.getByKey('templates', tplId);
    if (!tpl) throw new Error('模板不存在');
    const task = await this.create({
      title: tpl.title,
      content: tpl.content,
      category: tpl.category,
      priority: tpl.priority,
      tags: tpl.tags,
      dueDate: dueDate || utils.today(),
      subtasks: tpl.subtasks || []
    });
    return task;
  },

  parseAnnualPlan(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const result = [];
    const currentYear = new Date().getFullYear();
    const monthMap = {
      '1月':1,'2月':2,'3月':3,'4月':4,'5月':5,'6月':6,
      '7月':7,'8月':8,'9月':9,'10月':10,'11月':11,'12月':12,
      '一月':1,'二月':2,'三月':3,'四月':4,'五月':5,'六月':6,
      '七月':7,'八月':8,'九月':9,'十月':10,'十一月':11,'十二月':12
    };

    for (const line of lines) {
      let month = null;
      for (const [key, val] of Object.entries(monthMap)) {
        if (line.includes(key)) { month = val; break; }
      }
      if (!month && /Q[1-4]/.test(line)) {
        const q = parseInt(line.match(/Q([1-4])/)[1]);
        month = q * 3;
      }
      if (!month && /\d{4}年/.test(line)) {
        const m = line.match(/(\d{1,2})月/);
        if (m) month = parseInt(m[1]);
      }

      const clean = line
        .replace(/^\d+[.．、]/, '')
        .replace(/^[-*•]/, '')
        .replace(/\d{4}年/, '')
        .replace(/(\d{1,2})月/, '')
        .replace(/Q[1-4]/, '')
        .trim();

      if (!clean) continue;

      const dueMonth = month || 12;
      const lastDay = new Date(currentYear, dueMonth, 0).getDate();
      result.push({
        title: clean.slice(0, 60),
        content: clean,
        dueDate: `${currentYear}-${String(dueMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
        category: '年度计划'
      });
    }
    return result;
  }
};
