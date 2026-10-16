const app = {
  state: { view: 'auth', currentDate: new Date(), selectedDate: null, tasks: [], holidays: {}, filter: {}, sort: 'dueDate', searchKeyword: '' },

  async start() {
    const loggedIn = await auth.init();
    this.state.view = loggedIn ? 'calendar' : 'auth';
    this.render();
    if (loggedIn) {
      await this.safeLoadTemplates();
      this.loadCalendar();
      notifications.checkAndSchedule(auth.currentUser.id);
      setInterval(() => {
        if (auth.currentUser) notifications.checkAndSchedule(auth.currentUser.id);
      }, 60 * 60 * 1000);
    }
  },

  el(id) { return document.getElementById(id); },

  render() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = this.layout();
    this.bindGlobal();
    if (this.state.view === 'auth') this.bindAuth();
    else if (this.state.view === 'calendar') { this.bindCalendar(); this.loadCalendar(); }
    else if (this.state.view === 'list') { this.bindList(); this.loadList(); }
    else if (this.state.view === 'stats') this.loadStats();
    else if (this.state.view === 'profile') this.bindProfile();
  },

  layout() {
    return `<div class="page">${this.header()}${this.content()}</div>`;
  },

  header() {
    if (this.state.view === 'auth') return '';
    return `
      <div class="header">
        <div class="header-title">任务管家</div>
        <div class="header-actions">
          <button class="btn btn-sm btn-secondary" id="btn-report">邮件报告</button>
          <div class="avatar" id="btn-profile" style="cursor:pointer">${this.avatarText()}</div>
        </div>
      </div>
      <div class="tabs" style="top:56px">
        <div class="tab ${this.state.view === 'calendar' ? 'active' : ''}" data-nav="calendar">日历</div>
        <div class="tab ${this.state.view === 'list' ? 'active' : ''}" data-nav="list">列表</div>
        <div class="tab ${this.state.view === 'stats' ? 'active' : ''}" data-nav="stats">统计</div>
        <div class="tab ${this.state.view === 'profile' ? 'active' : ''}" data-nav="profile">我的</div>
      </div>`;
  },

  avatarText() {
    const u = auth.currentUser;
    if (u?.avatar) return `<img src="${utils.escapeHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover">`;
    return utils.escapeHtml((u?.name || 'U').slice(0, 1));
  },

  content() {
    switch (this.state.view) {
      case 'auth': return this.authView();
      case 'calendar': return this.calendarView();
      case 'list': return this.listView();
      case 'stats': return this.statsView();
      case 'profile': return this.profileView();
      default: return '';
    }
  },

  authView() {
    return `
      <div style="padding:40px 24px;text-align:center">
        <div style="width:80px;height:80px;background:var(--primary);border-radius:20px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:700">任</div>
        <h1 style="margin-bottom:8px">任务管家</h1>
        <p style="color:var(--text-secondary);margin-bottom:32px">工作计划 · 进展跟踪 · 邮件提醒</p>
        <div class="tabs" style="position:static;margin-bottom:16px">
          <div class="tab active" data-tab="login">登录</div>
          <div class="tab" data-tab="register">注册</div>
        </div>
        <div id="auth-form"></div>
      </div>`;
  },

  bindAuth() {
    let mode = 'login';
    const renderForm = () => {
      this.el('auth-form').innerHTML = mode === 'login' ? this.loginForm() : this.registerForm();
      this.bindFormActions();
    };
    renderForm();
    document.querySelectorAll('[data-tab]').forEach(t => {
      t.addEventListener('click', () => {
        mode = t.dataset.tab;
        document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === mode));
        renderForm();
      });
    });
  },

  loginForm() {
    return `
      <div class="form-group"><input class="input" id="login-account" placeholder="邮箱或手机号"></div>
      <div class="form-group"><input class="input" type="password" id="login-password" placeholder="密码"></div>
      <div class="form-error" id="login-error"></div>
      <button class="btn btn-block" id="btn-login">登录</button>`;
  },

  registerForm() {
    return `
      <div class="form-group"><input class="input" id="reg-email" placeholder="邮箱"></div>
      <div class="form-group"><input class="input" id="reg-phone" placeholder="手机号"></div>
      <div class="form-group"><input class="input" type="password" id="reg-password" placeholder="密码（至少6位）"></div>
      <div class="form-group"><input class="input" type="password" id="reg-password2" placeholder="再次输入密码"></div>
      <div class="form-error" id="reg-error"></div>
      <button class="btn btn-block" id="btn-register">注册</button>`;
  },

  bindFormActions() {
    const loginBtn = this.el('btn-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        try {
          await auth.login(this.el('login-account').value, this.el('login-password').value);
          this.state.view = 'calendar';
          this.render();
          this.loadCalendar();
        } catch (e) {
          this.el('login-error').textContent = e.message;
        }
      });
    }
    const regBtn = this.el('btn-register');
    if (regBtn) {
      regBtn.addEventListener('click', async () => {
        try {
          await auth.register({
            email: this.el('reg-email').value,
            phone: this.el('reg-phone').value,
            password: this.el('reg-password').value,
            confirmPassword: this.el('reg-password2').value
          });
          this.state.view = 'calendar';
          this.render();
          this.loadCalendar();
        } catch (e) {
          this.el('reg-error').textContent = e.message;
        }
      });
    }
  },

  calendarView() {
    return `
      <div class="calendar-header">
        <button class="btn btn-sm btn-secondary" id="prev-month">上月</button>
        <div id="calendar-title" style="font-weight:700;font-size:16px"></div>
        <button class="btn btn-sm btn-secondary" id="next-month">下月</button>
      </div>
      <div id="calendar-swipe-area" style="touch-action:pan-y">
        <div class="calendar-grid" id="calendar-grid"></div>
      </div>
      <div style="padding:0 16px 12px;display:flex;gap:12px;justify-content:center;font-size:12px;color:var(--text-secondary)">
        <span><span style="display:inline-block;width:8px;height:8px;background:var(--warning);border-radius:50%;margin-right:4px"></span>较少</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:var(--danger);border-radius:50%;margin-right:4px"></span>较多</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:#d1d5db;border-radius:50%;margin-right:4px"></span>节假日</span>
      </div>
      <div style="padding:0 16px">
        <button class="btn btn-block" id="btn-add-task">+ 新增任务</button>
      </div>
      <div style="padding:12px 16px" id="today-overview"></div>
      <div style="padding:0 16px 16px">
        <input class="input" id="global-search" placeholder="搜索任务标题、内容、标签..." value="${utils.escapeHtml(this.state.searchKeyword)}">
      </div>
      <div style="padding:0 16px 16px" id="today-tasks"></div>`;
  },

  async loadCalendar() {
    try {
      const y = this.state.currentDate.getFullYear();
      const m = this.state.currentDate.getMonth() + 1;
      this.el('calendar-title').textContent = `${y}年${m}月`;
      const days = await calendar.build(y, m, auth.currentUser.id);
      const grid = this.el('calendar-grid');
      grid.innerHTML = ['一','二','三','四','五','六','日'].map(d => `<div class="calendar-weekday">${d}</div>`).join('') +
        days.map(d => d.type === 'empty' ? `<div class="calendar-day empty"></div>` : this.dayCell(d)).join('');
      grid.querySelectorAll('.calendar-day[data-date]').forEach(cell => {
        cell.addEventListener('click', () => this.openDayTasks(cell.dataset.date));
      });
      await this.loadTodayOverview();
      await this.loadTodayPreview();
    } catch (e) {
      console.error('loadCalendar error', e);
      this.el('calendar-grid').innerHTML = '<div class="empty-state">加载日历失败，请刷新重试</div>';
    }
  },

  async loadTodayOverview() {
    const today = utils.today();
    const weekRange = utils.getWeekRange(today);
    const all = await tasks.listByUser(auth.currentUser.id);
    const active = all.filter(t => !t.deletedAt);
    const todayTasks = active.filter(t => t.dueDate === today);
    const overdueTasks = active.filter(t => t.status !== 'done' && t.dueDate < today);
    const weekTasks = active.filter(t => t.dueDate >= weekRange.start && t.dueDate <= weekRange.end && t.status !== 'done');
    const last7DaysDone = active.filter(t => t.status === 'done' && t.updatedAt && t.updatedAt >= utils.addDays(today, -7) + 'T00:00:00.000Z').length;

    this.el('today-overview').innerHTML = `
      <div class="overview-card">
        <div class="overview-title">任务总览</div>
        <div class="overview-grid">
          <div class="overview-item"><div class="num">${todayTasks.length}</div><div class="label">今日</div></div>
          <div class="overview-item"><div class="num" style="color:#fecaca">${overdueTasks.length}</div><div class="label">逾期</div></div>
          <div class="overview-item"><div class="num">${weekTasks.length}</div><div class="label">本周</div></div>
          <div class="overview-item"><div class="num">${last7DaysDone}</div><div class="label">近7天完成</div></div>
        </div>
        ${overdueTasks.length ? `<div style="margin-top:12px;font-size:13px;background:rgba(255,255,255,.15);padding:8px 10px;border-radius:8px">⚠️ 有 ${overdueTasks.length} 项任务已逾期，建议优先处理</div>` : ''}
      </div>
      <div class="overview-row">
        <div class="card" style="text-align:center;cursor:pointer" id="ov-today">
          <div style="font-size:13px;color:var(--text-secondary)">今日待办</div>
          <div style="font-size:18px;font-weight:700;color:var(--primary);margin-top:4px">${todayTasks.filter(t => t.status !== 'done').length}</div>
        </div>
        <div class="card" style="text-align:center;cursor:pointer" id="ov-week">
          <div style="font-size:13px;color:var(--text-secondary)">本周重点</div>
          <div style="font-size:18px;font-weight:700;color:var(--warning);margin-top:4px">${weekTasks.filter(t => t.priority === 'high').length}</div>
        </div>
      </div>`;
    this.el('ov-today')?.addEventListener('click', () => this.openDayTasks(today));
    this.el('ov-week')?.addEventListener('click', () => { this.state.view = 'list'; this.render(); });
  },

  dayCell(d) {
    const holidayName = d.isHoliday ? d.isHoliday : '';
    const today = utils.today();
    const isToday = d.date === today;
    return `
      <div class="calendar-day level-${d.level} ${d.isHoliday ? 'holiday' : ''} ${isToday ? 'selected' : ''}" data-date="${d.date}">
        <span>${d.day}</span>
        ${d.level !== 'none' ? '<span class="dot"></span>' : ''}
        ${holidayName ? `<span style="font-size:9px;color:#9ca3af;position:absolute;bottom:2px">${utils.escapeHtml(holidayName)}</span>` : ''}
      </div>`;
  },

  async loadTodayPreview() {
    const today = utils.today();
    const list = await tasks.listByDate(auth.currentUser.id, today);
    const html = list.length ? list.map(t => this.taskItem(t)).join('') : '<div class="empty-state">今日无任务</div>';
    const container = this.el('today-tasks');
    if (!container) return;
    container.innerHTML = `<div class="card"><div style="font-weight:700;margin-bottom:10px">今日任务</div>${html}</div>`;
    this.bindTaskActions(container);
  },

  bindCalendar() {
    this.el('prev-month').addEventListener('click', () => this.prevMonth());
    this.el('next-month').addEventListener('click', () => this.nextMonth());
    this.el('btn-add-task').addEventListener('click', () => this.openTaskEditor());
    const searchInput = this.el('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', utils.debounce(async () => {
          this.state.searchKeyword = searchInput.value;
          const container = this.el('today-tasks');
          if (this.state.searchKeyword.trim()) {
            const results = await tasks.search(auth.currentUser.id, this.state.searchKeyword);
            if (container) {
              container.innerHTML = `<div class="card"><div style="font-weight:700;margin-bottom:10px">搜索结果</div>${results.length ? results.map(t => this.taskItem(t)).join('') : '<div class="empty-state">无匹配任务</div>'}</div>`;
              this.bindTaskActions(container);
            }
          } else if (container) {
            this.loadTodayPreview();
          }
      }, 300));
    }
    this.attachSwipe(document.getElementById('calendar-swipe-area'), {
      left: () => this.nextMonth(),
      right: () => this.prevMonth()
    });
  },

  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.loadCalendar();
  },

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.loadCalendar();
  },

  attachSwipe(el, { left, right, threshold = 50 }) {
    if (!el) return;
    let startX = 0, startY = 0, isDragging = false;
    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!isDragging) return;
      isDragging = false;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) return;
      if (dx > 0) right && right();
      else left && left();
    }, { passive: true });
  },

  taskItem(t) {
    const done = t.status === 'done';
    const tags = (t.tags || '').split(/[,，]/).filter(Boolean).map(tag => `<span class="chip">${utils.escapeHtml(tag)}</span>`).join(' ');
    return `
      <div class="task-item ${done ? 'done' : ''}" data-task-id="${t.id}">
        <div class="task-item-left">
          <div class="task-check ${done ? 'checked' : ''}" data-action="toggle">${done ? '✓' : ''}</div>
          <div style="flex:1;cursor:pointer" data-action="open">
            <div class="task-title">${utils.escapeHtml(t.title)}</div>
            <div class="task-meta">${utils.formatDate(t.dueDate)} · ${this.statusText(t.status)} · ${t.category} ${tags}</div>
          </div>
        </div>
      </div>`;
  },

  statusText(status) {
    const map = { pending: '待办', doing: '进行中', done: '已完成', archived: '已归档' };
    return map[status] || status;
  },

  repeatText(repeat) {
    const map = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' };
    return map[repeat] || repeat;
  },

  bindTaskActions(container) {
    container.querySelectorAll('.task-check').forEach(el => {
      el.addEventListener('click', async e => {
        e.stopPropagation();
        const id = el.closest('.task-item').dataset.taskId;
        const task = await tasks.getById(id);
        await tasks.update(id, { status: task.status === 'done' ? 'pending' : 'done', progress: task.status === 'done' ? 0 : 100 });
        this.loadCalendar();
      });
    });
    container.querySelectorAll('[data-action="open"]').forEach(el => {
      el.addEventListener('click', () => this.openTaskDetail(el.closest('.task-item').dataset.taskId));
    });
  },

  async openDayTasks(dateStr) {
    this.state.selectedDate = dateStr;
    const list = await tasks.listByDate(auth.currentUser.id, dateStr);
    this.showModal(`<div class="modal-title">${utils.formatDate(dateStr)}</div>
      <div id="day-task-list">${list.length ? list.map(t => this.taskItem(t)).join('') : '<div class="empty-state">当天无任务</div>'}</div>
      <button class="btn btn-block" style="margin-top:12px" id="modal-add-task">+ 当天新增任务</button>`, () => {
      if (list.length) this.bindTaskActions(this.el('day-task-list'));
      this.el('modal-add-task').addEventListener('click', () => {
        this.closeModal();
        this.openTaskEditor({ dueDate: dateStr });
      });
    });
  },

  async openTaskEditor(defaults = {}) {
    const task = defaults.id ? defaults : null;
    if (!task && !this.state.templates) await this.safeLoadTemplates();
    this.showModal(`
      <div class="modal-title">${task ? '编辑任务' : '新增任务'}</div>
      <div class="form-group"><label>任务标题</label><input class="input" id="task-title" value="${utils.escapeHtml(task?.title || '')}"></div>
      <div class="form-group"><label>任务内容</label><textarea class="input" id="task-content" rows="3">${utils.escapeHtml(task?.content || '')}</textarea></div>
      <div class="form-group"><label>截止日期</label><input class="input" type="date" id="task-date" value="${task?.dueDate || defaults.dueDate || utils.today()}"></div>
      <div class="form-group"><label>分类</label>
        <select class="input" id="task-category">
          <option ${(task?.category || defaults.category || '工作') === '工作' ? 'selected' : ''}>工作</option>
          <option ${(task?.category) === '学习' ? 'selected' : ''}>学习</option>
          <option ${(task?.category) === '生活' ? 'selected' : ''}>生活</option>
          <option ${(task?.category) === '年度计划' ? 'selected' : ''}>年度计划</option>
        </select>
      </div>
      <div class="form-group"><label>优先级</label>
        <select class="input" id="task-priority">
          <option value="normal" ${(task?.priority || 'normal') === 'normal' ? 'selected' : ''}>普通</option>
          <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>高</option>
          <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>低</option>
        </select>
      </div>
      <div class="form-group"><label>标签（用逗号分隔）</label><input class="input" id="task-tags" value="${utils.escapeHtml(task?.tags || '')}" placeholder="如：重要，客户，会议"></div>
      <div class="form-group" id="quick-tags" style="margin-top:-6px"><label>快速标签</label><div class="quick-tags" id="quick-tags-list"></div></div>
      ${!task ? `<div class="form-group"><label>模板</label><select class="input" id="task-template"><option value="">不使用模板</option>${(this.state.templates || []).map(tpl => `<option value="${tpl.id}">${utils.escapeHtml(tpl.name)}</option>`).join('')}</select></div>` : ''}
      ${!task ? `<div class="form-group"><label>重复周期</label><select class="input" id="task-repeat"><option value="">不重复</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="yearly">每年</option></select></div>` : ''}
      ${task?.repeat ? `<div class="form-group"><label>重复周期</label><div class="chip">${this.repeatText(task.repeat)}</div></div>` : ''}
      ${defaults.parsed ? `<div class="form-group"><label>年度计划解析来源</label><div class="chip">${utils.escapeHtml(defaults.parsed)}</div></div>` : ''}
      <div class="form-error" id="task-error"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-block" id="btn-save-task">保存</button>
        ${task ? '<button class="btn btn-block btn-danger" id="btn-delete-task">删除</button>' : ''}
      </div>
      ${defaults.parsedList ? `<div style="margin-top:12px"><button class="btn btn-block btn-secondary" id="btn-save-all">保存全部 ${defaults.parsedList.length} 项</button></div>` : ''}
    `, () => {
      this.renderQuickTags(task?.tags || '');
      const tagInput = this.el('task-tags');
      this.el('quick-tags-list').addEventListener('click', e => {
        const chip = e.target.closest('[data-tag]');
        if (!chip) return;
        const tag = chip.dataset.tag;
        const current = tagInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        if (current.includes(tag)) {
          tagInput.value = current.filter(t => t !== tag).join('，');
        } else {
          current.push(tag);
          tagInput.value = current.join('，');
        }
        this.renderQuickTags(tagInput.value);
      });
      this.el('btn-save-task').addEventListener('click', async () => {
        try {
          const data = {
            title: this.el('task-title').value,
            content: this.el('task-content').value,
            dueDate: this.el('task-date').value,
            category: this.el('task-category').value,
            priority: this.el('task-priority').value,
            tags: this.el('task-tags').value
          };
          if (task?.id) {
            await tasks.update(task.id, data);
          } else {
            const tplId = this.el('task-template')?.value;
            if (tplId) {
              await tasks.applyTemplate(tplId, data.dueDate);
            } else {
              data.repeat = this.el('task-repeat')?.value || null;
              await tasks.create(data);
            }
          }
          this.closeModal();
          this.loadCalendar();
        } catch (e) {
          this.el('task-error').textContent = e.message;
        }
      });
      if (task?.id) {
        this.el('btn-delete-task').addEventListener('click', async () => {
          if (confirm('确定删除该任务？')) {
            await tasks.delete(task.id);
            this.closeModal();
            this.loadCalendar();
          }
        });
      }
      if (defaults.parsedList) {
        this.el('btn-save-all').addEventListener('click', async () => {
          for (const item of defaults.parsedList) await tasks.create(item);
          this.closeModal();
          this.loadCalendar();
        });
      }
    });
  },

  async openTaskDetail(id) {
    const task = await tasks.getById(id);
    const progressList = await tasks.getProgress(id);
    const attachments = await tasks.getAttachments(id);
    const subtasks = await tasks.getSubtasks(id);
    this.showModal(`
      <div class="modal-title">任务详情</div>
      <div class="card" style="margin-bottom:12px">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">${utils.escapeHtml(task.title)}</div>
        <div style="color:var(--text-secondary);font-size:14px;margin-bottom:8px">${utils.escapeHtml(task.content || '无内容')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="chip">${utils.formatDate(task.dueDate)}</span>
          <span class="chip">${this.statusText(task.status)}</span>
          <span class="chip">${task.category}</span>
          ${task.repeat ? `<span class="chip">${this.repeatText(task.repeat)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <button class="btn btn-block btn-secondary" id="btn-edit-task">编辑任务</button>
        <button class="btn btn-block btn-secondary" id="btn-add-progress">更新进展</button>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px">子任务</div>
        <div id="subtask-list">
          ${subtasks.length ? subtasks.map(s => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)" data-subtask-id="${s.id}">
              <div class="task-check ${s.done ? 'checked' : ''}" style="width:18px;height:18px;font-size:12px" data-action="toggle-sub">${s.done ? '✓' : ''}</div>
              <div style="flex:1;font-size:14px;${s.done ? 'text-decoration:line-through;opacity:.6' : ''}">${utils.escapeHtml(s.title)}</div>
              <span style="font-size:12px;color:var(--text-secondary);cursor:pointer" data-action="del-sub">删除</span>
            </div>`).join('') : '<div class="empty-state">暂无子任务</div>'}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input class="input" id="new-subtask" placeholder="添加子任务..." style="flex:1">
          <button class="btn btn-sm" id="btn-add-subtask">添加</button>
        </div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px">进展记录</div>
        <div class="progress-list">
          ${progressList.length ? progressList.map(p => this.progressItem(p)).join('') : '<div class="empty-state">暂无进展</div>'}
        </div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px">附件 / 图片</div>
        <div class="attachment-list">
          ${attachments.length ? attachments.map(a => this.attachmentItem(a)).join('') : '<div class="empty-state">无附件</div>'}
        </div>
        <div style="margin-top:10px">
          <label class="btn btn-block btn-secondary" style="cursor:pointer">
            上传文件/图片 / 拍照
            <input type="file" id="attach-input" accept="image/*,application/pdf,.doc,.docx" capture="environment" style="display:none" multiple>
          </label>
        </div>
      </div>
      <button class="btn btn-block btn-secondary" id="btn-save-tpl">存为模板</button>
    `, () => {
      this.el('btn-save-tpl')?.addEventListener('click', async () => {
        const name = prompt('模板名称', task.title);
        if (!name) return;
        await tasks.saveTemplate(task.id, name);
        await this.loadTemplates();
        alert('已保存为模板');
      });
      this.el('btn-edit-task').addEventListener('click', () => {
        this.closeModal();
        this.openTaskEditor(task);
      });
      this.el('btn-add-progress').addEventListener('click', () => this.openProgressEditor(task.id));
      this.el('btn-add-subtask').addEventListener('click', async () => {
        const title = this.el('new-subtask').value;
        if (!title.trim()) return;
        await tasks.addSubtask(task.id, title);
        this.closeModal();
        this.openTaskDetail(task.id);
      });
      this.el('subtask-list')?.querySelectorAll('[data-action="toggle-sub"]').forEach(el => {
        el.addEventListener('click', async () => {
          await tasks.toggleSubtask(el.closest('[data-subtask-id]').dataset.subtaskId);
          this.closeModal();
          this.openTaskDetail(task.id);
        });
      });
      this.el('subtask-list')?.querySelectorAll('[data-action="del-sub"]').forEach(el => {
        el.addEventListener('click', async () => {
          await tasks.deleteSubtask(el.closest('[data-subtask-id]').dataset.subtaskId);
          this.closeModal();
          this.openTaskDetail(task.id);
        });
      });
      this.el('attach-input').addEventListener('change', async e => {
        const files = Array.from(e.target.files);
        for (const file of files) await tasks.addAttachment(task.id, file);
        this.closeModal();
        this.openTaskDetail(task.id);
      });
    });
  },

  progressItem(p) {
    return `
      <div class="progress-item">
        <div class="progress-time">${utils.formatDateTime(p.createdAt)}</div>
        <div class="progress-content">${utils.escapeHtml(p.content)}</div>
      </div>`;
  },

  attachmentItem(a) {
    const safeUrl = (a.dataUrl || '').startsWith('data:') ? a.dataUrl : '#';
    if (a.type?.startsWith('image/')) {
      return `<a href="${safeUrl}" target="_blank"><img src="${safeUrl}" class="attachment-thumb"></a>`;
    }
    return `<a href="${safeUrl}" download="${utils.escapeHtml(a.name)}" class="attachment-file">${utils.escapeHtml(a.name)}</a>`;
  },

  openProgressEditor(taskId) {
    this.showModal(`
      <div class="modal-title">更新进展</div>
      <div class="form-group"><textarea class="input" id="progress-content" rows="4" placeholder="记录当前进展..."></textarea></div>
      <button class="btn btn-block" id="btn-save-progress">保存</button>
    `, () => {
      this.el('btn-save-progress').addEventListener('click', async () => {
        await tasks.addProgress(taskId, this.el('progress-content').value);
        this.closeModal();
        this.openTaskDetail(taskId);
      });
    });
  },

  profileView() {
    const u = auth.currentUser;
    return `
      <div style="padding:16px">
        <div class="card" style="text-align:center">
          <label style="cursor:pointer;display:inline-block;position:relative">
            <div class="avatar" style="width:80px;height:80px;font-size:32px;margin:0 auto">${this.avatarText()}</div>
            <input type="file" id="avatar-input" accept="image/*" capture="user" style="display:none">
            <div style="margin-top:8px;color:var(--primary);font-size:14px">点击更换头像</div>
          </label>
          <div style="font-size:20px;font-weight:700;margin-top:12px">${utils.escapeHtml(u.name)}</div>
          <div style="color:var(--text-secondary);font-size:14px">${utils.escapeHtml(u.email)}</div>
        </div>
        <div class="card">
          <div class="form-group"><label>用户名</label><input class="input" id="profile-name" value="${utils.escapeHtml(u.name)}"></div>
          <div class="form-group"><label>邮箱</label><input class="input" id="profile-email" value="${utils.escapeHtml(u.email)}"></div>
          <div class="form-group"><label>手机号</label><input class="input" id="profile-phone" value="${utils.escapeHtml(u.phone)}"></div>
          <button class="btn btn-block" id="btn-save-profile">保存资料</button>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:12px">修改密码</div>
          <div class="form-group"><input class="input" type="password" id="old-pwd" placeholder="原密码"></div>
          <div class="form-group"><input class="input" type="password" id="new-pwd" placeholder="新密码"></div>
          <div class="form-group"><input class="input" type="password" id="new-pwd2" placeholder="确认新密码"></div>
          <div class="form-error" id="pwd-error"></div>
          <button class="btn btn-block btn-secondary" id="btn-change-pwd">修改密码</button>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:12px">通知提醒</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span>启用到期提醒</span>
            <div class="toggle ${(this.state.settings?.notifications !== false) ? 'active' : ''}" id="notify-toggle" style="width:44px;height:24px;background:var(--border);border-radius:12px;position:relative;cursor:pointer;transition:background .2s">
              <div style="width:20px;height:20px;background:#fff;border-radius:50%;position:absolute;top:2px;left:2px;transition:left .2s"></div>
            </div>
          </div>
          <div class="form-group">
            <label>提前提醒天数</label>
            <input class="input" type="number" id="notify-days" value="${this.state.settings?.remindDays || 1}" min="0" max="7">
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">通知状态：<span id="notify-status"></span></div>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:12px">任务模板</div>
          <div id="template-list" style="margin-bottom:10px"></div>
          <button class="btn btn-block btn-secondary" id="btn-manage-templates">管理模板</button>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:12px">数据管理</div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-block btn-secondary" id="btn-export">导出备份</button>
            <label class="btn btn-block btn-secondary" style="cursor:pointer">
              导入备份
              <input type="file" id="import-input" accept="application/json" style="display:none">
            </label>
          </div>
          <button class="btn btn-block btn-secondary" style="margin-top:10px" id="btn-trash">回收站</button>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:12px">年度计划导入</div>
          <textarea class="input" id="annual-plan" rows="4" placeholder="粘贴年度工作计划，自动按月份拆解为任务..."></textarea>
          <button class="btn btn-block" style="margin-top:10px" id="btn-parse-plan">解析计划</button>
        </div>
        <button class="btn btn-block btn-danger" style="margin-top:12px" id="btn-logout">退出登录</button>
      </div>`;
  },

  async loadSettings() {
    this.state.settings = await dbApi.getByKey('settings', auth.currentUser.id) || { userId: auth.currentUser.id, notifications: true, remindDays: 1 };
  },

  async loadTemplates() {
    this.state.templates = await tasks.listTemplates(auth.currentUser.id);
  },

  async safeLoadTemplates() {
    try {
      await this.loadTemplates();
    } catch (e) {
      this.state.templates = [];
    }
  },

  async getQuickTags() {
    const taskList = await tasks.listByUser(auth.currentUser.id);
    const map = {};
    for (const t of taskList) {
      if (!t.tags) continue;
      for (const tag of t.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean)) {
        map[tag] = (map[tag] || 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  },

  async renderQuickTags(currentTags) {
    const container = this.el('quick-tags-list');
    if (!container) return;
    const quick = await this.getQuickTags();
    const preset = ['重要', '紧急', '客户', '会议', '报告', '学习', '生活', '待确认'];
    const all = Array.from(new Set([...quick, ...preset]));
    const current = currentTags.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    container.innerHTML = all.map(tag => `<span class="chip quick-tag ${current.includes(tag) ? 'active' : ''}" data-tag="${utils.escapeHtml(tag)}">${utils.escapeHtml(tag)}</span>`).join('');
  },

  bindProfile() {
    Promise.all([this.loadSettings(), this.loadTemplates()]).then(() => {
      const tplList = this.el('template-list');
      if (tplList) {
        tplList.innerHTML = this.state.templates.length
          ? this.state.templates.slice(0, 3).map(t => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:14px">${utils.escapeHtml(t.name)}</div>`).join('')
          : '<div style="color:var(--text-secondary);font-size:13px">暂无模板</div>';
      }
      const toggle = this.el('notify-toggle');
      const status = this.el('notify-status');
      if (toggle && status) {
        const updateStatus = () => {
          const perm = notifications.getPermission();
          status.textContent = perm === 'granted' ? '已授权' : perm === 'denied' ? '已拒绝' : '未授权';
        };
        updateStatus();
        toggle.addEventListener('click', async () => {
          const settings = await dbApi.getByKey('settings', auth.currentUser.id) || { userId: auth.currentUser.id };
          if (settings.notifications === false) {
            const perm = await notifications.requestPermission();
            if (perm !== 'granted') { alert('需要浏览器通知权限才能开启提醒'); return; }
            settings.notifications = true;
          } else {
            settings.notifications = false;
          }
          settings.remindDays = parseInt(this.el('notify-days').value) || 1;
          await dbApi.put('settings', settings);
          this.state.settings = settings;
          toggle.classList.toggle('active', settings.notifications !== false);
          updateStatus();
          alert(settings.notifications !== false ? '已开启提醒' : '已关闭提醒');
        });
        this.el('notify-days').addEventListener('change', async () => {
          const settings = await dbApi.getByKey('settings', auth.currentUser.id) || { userId: auth.currentUser.id };
          settings.remindDays = parseInt(this.el('notify-days').value) || 1;
          await dbApi.put('settings', settings);
          this.state.settings = settings;
        });
      }
    });
    this.el('avatar-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const MAX_AVATAR = 2 * 1024 * 1024; // 2MB
      if (file.size > MAX_AVATAR) { alert('头像图片不能超过 2MB'); return; }
      const dataUrl = await utils.readFileAsBase64(file);
      await auth.updateProfile({ avatar: dataUrl });
      this.render();
    });
    this.el('btn-save-profile').addEventListener('click', async () => {
      try {
        const email = this.el('profile-email').value;
        const phone = this.el('profile-phone').value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式不正确');
        if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('手机号格式不正确');
        await auth.updateProfile({
          name: this.el('profile-name').value,
          email,
          phone
        });
        alert('资料已保存');
        this.render();
      } catch (e) {
        alert(e.message);
      }
    });
    this.el('btn-change-pwd').addEventListener('click', async () => {
      try {
        await auth.changePassword(this.el('old-pwd').value, this.el('new-pwd').value, this.el('new-pwd2').value);
        this.el('pwd-error').textContent = '';
        alert('密码已修改');
      } catch (e) {
        this.el('pwd-error').textContent = e.message;
      }
    });
    this.el('btn-parse-plan').addEventListener('click', async () => {
      const text = this.el('annual-plan').value;
      if (!text.trim()) return;
      const parsed = await tasks.parseAnnualPlan(text);
      if (!parsed.length) { alert('未能解析出任务，请检查格式'); return; }
      this.closeModal && this.closeModal();
      this.openTaskEditor({ parsedList: parsed, parsed: `年度计划（${parsed.length}项）` });
    });
    this.el('btn-logout').addEventListener('click', () => {
      auth.logout();
      this.state.view = 'auth';
      this.render();
    });
    this.el('btn-export').addEventListener('click', async () => {
      const data = await tasks.exportAll(auth.currentUser.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-manager-backup-${utils.today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    this.el('import-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await tasks.importAll(auth.currentUser.id, data);
        alert('导入成功');
        this.render();
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    });
    this.el('btn-trash').addEventListener('click', () => this.openTrash());
    this.el('btn-manage-templates')?.addEventListener('click', () => this.openTemplateManager());
  },

  async openTemplateManager() {
    const tpls = await tasks.listTemplates(auth.currentUser.id);
    this.showModal(`
      <div class="modal-title">任务模板</div>
      <div id="tpl-list">${tpls.length ? tpls.map(t => `
        <div class="task-item" data-tpl-id="${t.id}">
          <div style="flex:1">
            <div class="task-title">${utils.escapeHtml(t.name)}</div>
            <div class="task-meta">${utils.escapeHtml(t.title)} · ${t.category}</div>
          </div>
          <button class="btn btn-sm btn-danger" data-action="del-tpl">删除</button>
        </div>`).join('') : '<div class="empty-state">暂无模板</div>'}</div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-secondary)">提示：在任务详情页点击「存为模板」可将当前任务保存为模板。</div>
    `, () => {
      this.el('tpl-list')?.querySelectorAll('[data-action="del-tpl"]').forEach(el => {
        el.addEventListener('click', async () => {
          await tasks.deleteTemplate(el.closest('[data-tpl-id]').dataset.tplId);
          this.openTemplateManager();
          this.loadTemplates();
        });
      });
    });
  },

  bindGlobal() {
    const reportBtn = this.el('btn-report');
    if (reportBtn) reportBtn.addEventListener('click', () => this.sendReport());
    const profileBtn = this.el('btn-profile');
    if (profileBtn) profileBtn.addEventListener('click', () => { this.state.view = 'profile'; this.render(); });
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => { this.state.view = el.dataset.nav; this.render(); });
    });
  },

  bindList() {
    ['list-search', 'filter-category', 'filter-status', 'list-sort'].forEach(id => {
      const el = this.el(id);
      if (el) el.addEventListener('input', () => this.loadList());
    });
    this.attachPullRefresh(this.el('pull-refresh'), this.el('pull-indicator'), () => this.loadList());
  },

  attachPullRefresh(container, indicator, callback) {
    if (!container) return;
    let startY = 0, pulling = false, refreshing = false;
    const maxPull = 60;
    container.addEventListener('touchstart', e => {
      if (container.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
      refreshing = false;
    }, { passive: true });
    container.addEventListener('touchmove', e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && container.scrollTop <= 0) {
        const h = Math.min(dy * 0.5, maxPull);
        indicator.style.height = h + 'px';
        indicator.textContent = h >= maxPull * 0.7 ? '↑ 松开刷新' : '↓ 下拉刷新';
      }
    }, { passive: true });
    container.addEventListener('touchend', async () => {
      if (!pulling) return;
      pulling = false;
      const h = parseFloat(indicator.style.height || 0);
      if (h >= maxPull * 0.7 && !refreshing) {
        refreshing = true;
        indicator.textContent = '刷新中...';
        await callback();
      }
      indicator.style.height = '0';
    }, { passive: true });
  },

  async sendReport() {
    const body = await emailReport.generateWeeklyReport(auth.currentUser.id);
    emailReport.openMailClient(auth.currentUser.email, '本周任务提醒', body);
  },

  showModal(html, onRender) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(overlay);
    this._modal = overlay;
    overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(); });
    if (onRender) onRender();
  },

  async openTrash() {
    const list = await tasks.listDeleted(auth.currentUser.id);
    this.showModal(`
      <div class="modal-title">回收站</div>
      <div id="trash-list">${list.length ? list.map(t => `
        <div class="task-item" data-task-id="${t.id}">
          <div style="flex:1">
            <div class="task-title">${utils.escapeHtml(t.title)}</div>
            <div class="task-meta">删除于 ${utils.formatDateTime(t.deletedAt)}</div>
          </div>
          <button class="btn btn-sm btn-secondary" data-action="restore">恢复</button>
          <button class="btn btn-sm btn-danger" data-action="delete">彻底删除</button>
        </div>`).join('') : '<div class="empty-state">回收站为空</div>'}</div>
    `, () => {
      this.el('trash-list').querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.closest('.task-item').dataset.taskId;
          if (el.dataset.action === 'restore') await tasks.restore(id);
          else if (confirm('彻底删除不可恢复，确定？')) await tasks.permanentDelete(id);
          this.openTrash();
          this.loadCalendar();
        });
      });
    });
  },

  listView() {
    return `
      <div id="pull-refresh" style="overflow:hidden;position:relative">
        <div id="pull-indicator" style="height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:13px;transition:height .2s">↓ 下拉刷新</div>
        <div style="padding:12px 16px">
          <input class="input" id="list-search" placeholder="搜索任务..." value="${utils.escapeHtml(this.state.searchKeyword)}">
        </div>
        <div style="padding:0 16px 12px;display:flex;gap:8px;overflow-x:auto">
          <select class="input" id="filter-category" style="min-width:90px;flex:1">
            <option value="">全部分类</option>
            <option value="工作">工作</option>
            <option value="学习">学习</option>
            <option value="生活">生活</option>
            <option value="年度计划">年度计划</option>
          </select>
          <select class="input" id="filter-status" style="min-width:80px;flex:1">
            <option value="">全部状态</option>
            <option value="pending">待办</option>
            <option value="doing">进行中</option>
            <option value="done">已完成</option>
          </select>
          <select class="input" id="list-sort" style="min-width:90px;flex:1">
            <option value="dueDate">按截止日期</option>
            <option value="priority">按优先级</option>
            <option value="createdAt">按创建时间</option>
          </select>
        </div>
        <div style="padding:0 16px" id="list-container"></div>
      </div>`;
  },

  async loadList() {
    const keyword = this.el('list-search').value;
    const category = this.el('filter-category').value;
    const status = this.el('filter-status').value;
    const sort = this.el('list-sort').value;
    let list = await tasks.listByUser(auth.currentUser.id);
    if (category) list = list.filter(t => t.category === category);
    if (status) list = list.filter(t => t.status === status);
    if (keyword.trim()) {
      list = list.filter(t => (t.title + t.content + t.tags + t.category).toLowerCase().includes(keyword.trim().toLowerCase()));
    }
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    list.sort((a, b) => {
      if (sort === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
      if (sort === 'priority') return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
      if (sort === 'createdAt') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return 0;
    });
    this.el('list-container').innerHTML = list.length ? list.map(t => this.taskItem(t)).join('') : '<div class="empty-state">无任务</div>';
    this.bindTaskActions(this.el('list-container'));
  },

  statsView() {
    return `<div style="padding:16px" id="stats-container"></div>`;
  },

  async loadStats() {
    const today = utils.today();
    const year = parseInt(today.slice(0, 4));
    const month = parseInt(today.slice(5, 7));
    const monthStart = today.slice(0, 8) + '01';
    const monthEnd = today.slice(0, 8) + String(new Date(year, month, 0).getDate()).padStart(2, '0');
    const all = await tasks.listByUser(auth.currentUser.id);
    const active = all.filter(t => !t.deletedAt);
    const monthTasks = active.filter(t => t.dueDate >= monthStart && t.dueDate <= monthEnd);
    const weekRange = utils.getWeekRange(today);
    const weekTasks = active.filter(t => t.dueDate >= weekRange.start && t.dueDate <= weekRange.end);
    const done = active.filter(t => t.status === 'done').length;
    const pending = active.filter(t => t.status !== 'done').length;
    const overdue = active.filter(t => t.status !== 'done' && t.dueDate < today).length;

    const categories = {};
    for (const t of active) categories[t.category] = (categories[t.category] || 0) + 1;

    this.el('stats-container').innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:32px;font-weight:700;color:var(--primary)">${active.length}</div>
        <div style="color:var(--text-secondary)">总任务</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
        <div class="card" style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--success)">${done}</div><div style="font-size:13px;color:var(--text-secondary)">已完成</div></div>
        <div class="card" style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--warning)">${pending}</div><div style="font-size:13px;color:var(--text-secondary)">待办</div></div>
        <div class="card" style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--danger)">${overdue}</div><div style="font-size:13px;color:var(--text-secondary)">已逾期</div></div>
        <div class="card" style="text-align:center"><div style="font-size:24px;font-weight:700">${monthTasks.filter(t => t.status === 'done').length}</div><div style="font-size:13px;color:var(--text-secondary)">本月完成</div></div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px">本周任务</div>
        <div style="color:var(--text-secondary);font-size:14px">${weekTasks.length} 项，已完成 ${weekTasks.filter(t => t.status === 'done').length} 项</div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px">分类分布</div>
        ${Object.entries(categories).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${utils.escapeHtml(k)}</span><span>${v}</span></div>`).join('')}
      </div>
    `;
  },

  closeModal() {
    if (this._modal) { this._modal.remove(); this._modal = null; }
  }
};

document.addEventListener('DOMContentLoaded', () => app.start());
