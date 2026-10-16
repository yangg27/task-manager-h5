const auth = {
  currentUser: null,

  async init() {
    const session = localStorage.getItem('tm_session');
    if (session) {
      try {
        const sess = JSON.parse(session);
        const fresh = await dbApi.getByKey('users', sess.id);
        if (fresh && fresh.sessionToken === sess.token) {
          this.currentUser = fresh;
          return true;
        }
      } catch (e) {}
    }
    return false;
  },

  async register({ email, phone, password, confirmPassword }) {
    if (!email || !phone || !password) throw new Error('请填写完整信息');
    if (password !== confirmPassword) throw new Error('两次密码输入不一致');
    if (password.length < 6) throw new Error('密码至少6位');
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) throw new Error('邮箱格式不正确');
    const phoneRe = /^1[3-9]\d{9}$/;
    if (!phoneRe.test(phone)) throw new Error('手机号格式不正确');

    const users = await dbApi.getAll('users');
    if (users.some(u => u.email === email)) throw new Error('该邮箱已被注册');
    if (users.some(u => u.phone === phone)) throw new Error('该手机号已被注册');

    const id = utils.uuid();
    const passwordHash = await utils.hashPassword(password, email);
    const sessionToken = this.generateToken();
    const user = {
      id,
      email,
      phone,
      passwordHash,
      sessionToken,
      name: email.split('@')[0],
      avatar: null,
      createdAt: new Date().toISOString()
    };
    await dbApi.put('users', user);
    this.currentUser = user;
    this.saveSession();
    return user;
  },

  generateToken() {
    const arr = new Uint8Array(16);
    if (crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async login(account, password) {
    if (!account || !password) throw new Error('请填写账号和密码');
    const users = await dbApi.getAll('users');
    const user = users.find(u => u.email === account || u.phone === account);
    if (!user) throw new Error('账号不存在');
    const inputHash = await utils.hashPassword(password, user.email);
    if (user.passwordHash !== inputHash) throw new Error('密码错误');
    user.sessionToken = this.generateToken();
    await dbApi.put('users', user);
    this.currentUser = user;
    this.saveSession();
    return user;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('tm_session');
  },

  saveSession() {
    localStorage.setItem('tm_session', JSON.stringify({ id: this.currentUser.id, token: this.currentUser.sessionToken }));
  },

  async updateProfile(data) {
    if (!this.currentUser) throw new Error('未登录');
    const user = { ...this.currentUser, ...data, updatedAt: new Date().toISOString() };
    await dbApi.put('users', user);
    this.currentUser = user;
    this.saveSession();
    return user;
  },

  async changePassword(oldPassword, newPassword, confirmPassword) {
    if (!this.currentUser) throw new Error('未登录');
    const oldHash = await utils.hashPassword(oldPassword, this.currentUser.email);
    if (oldHash !== this.currentUser.passwordHash) throw new Error('原密码错误');
    if (newPassword.length < 6) throw new Error('新密码至少6位');
    if (newPassword !== confirmPassword) throw new Error('两次新密码输入不一致');
    this.currentUser.passwordHash = await utils.hashPassword(newPassword, this.currentUser.email);
    this.currentUser.updatedAt = new Date().toISOString();
    await dbApi.put('users', this.currentUser);
  }
};
