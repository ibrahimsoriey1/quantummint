class MailServerDashboard {
    constructor() {
        this.token = localStorage.getItem('mailServerToken');
        this.currentUser = null;
        this.currentTab = 'users';
        
        this.init();
    }

    init() {
        if (this.token) {
            this.showDashboard();
            this.loadDashboardData();
        } else {
            this.showLogin();
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('mailServerToken', this.token);
                
                this.showDashboard();
                this.loadDashboardData();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.classList.remove('hidden');
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('mailServerToken');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        if (this.currentUser) {
            document.getElementById('welcomeUser').textContent = `Welcome, ${this.currentUser.username}`;
        }
    }

    async loadDashboardData() {
        await Promise.all([
            this.loadStats(),
            this.loadCurrentTabData()
        ]);
    }

    async loadStats() {
        try {
            const response = await this.apiCall('/api/dashboard/stats');
            if (response.ok) {
                const stats = await response.json();
                
                document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
                document.getElementById('totalEmails').textContent = stats.totalEmails || 0;
                document.getElementById('emailsToday').textContent = stats.emailsToday || 0;
                document.getElementById('queueSize').textContent = 
                    (stats.queueStats?.waiting || 0) + (stats.queueStats?.active || 0);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;
        this.loadCurrentTabData();
    }

    async loadCurrentTabData() {
        switch (this.currentTab) {
            case 'users':
                await this.loadUsers();
                break;
            case 'emails':
                await this.loadEmails();
                break;
            case 'queue':
                await this.loadQueue();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    async loadUsers() {
        const loadingDiv = document.getElementById('usersLoading');
        const contentDiv = document.getElementById('usersContent');
        const tableBody = document.getElementById('usersTableBody');

        loadingDiv.classList.remove('hidden');
        contentDiv.classList.add('hidden');

        try {
            const response = await this.apiCall('/api/users');
            if (response.ok) {
                const data = await response.json();
                
                tableBody.innerHTML = '';
                data.users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>
                            <span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">
                                ${user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                        <td>
                            <button onclick="dashboard.editUser('${user._id}')" class="btn-sm">Edit</button>
                            <button onclick="dashboard.deleteUser('${user._id}')" class="btn-sm btn-danger">Delete</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });

                loadingDiv.classList.add('hidden');
                contentDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            loadingDiv.innerHTML = '<p>Error loading users</p>';
        }
    }

    async loadEmails() {
        const loadingDiv = document.getElementById('emailsLoading');
        const contentDiv = document.getElementById('emailsContent');
        const tableBody = document.getElementById('emailsTableBody');

        loadingDiv.classList.remove('hidden');
        contentDiv.classList.add('hidden');

        try {
            const response = await this.apiCall('/api/emails');
            if (response.ok) {
                const data = await response.json();
                
                tableBody.innerHTML = '';
                data.emails.forEach(email => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${email.subject || '(No Subject)'}</td>
                        <td>${this.formatAddress(email.from)}</td>
                        <td>${email.to?.map(addr => this.formatAddress(addr)).join(', ') || ''}</td>
                        <td>${new Date(email.date).toLocaleString()}</td>
                        <td>${this.formatBytes(email.size)}</td>
                        <td>
                            <span class="badge ${this.getEmailStatusBadge(email)}">
                                ${this.getEmailStatus(email)}
                            </span>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });

                loadingDiv.classList.add('hidden');
                contentDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading emails:', error);
            loadingDiv.innerHTML = '<p>Error loading emails</p>';
        }
    }

    async loadQueue() {
        const loadingDiv = document.getElementById('queueLoading');
        const contentDiv = document.getElementById('queueContent');
        const tableBody = document.getElementById('queueTableBody');

        loadingDiv.classList.remove('hidden');
        contentDiv.classList.add('hidden');

        try {
            const response = await this.apiCall('/api/queue/jobs');
            if (response.ok) {
                const jobs = await response.json();
                
                tableBody.innerHTML = '';
                jobs.forEach(job => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${job.id}</td>
                        <td>${job.name}</td>
                        <td>
                            <span class="badge ${this.getJobStatusBadge(job)}">
                                ${this.getJobStatus(job)}
                            </span>
                        </td>
                        <td>${job.progress || 0}%</td>
                        <td>${job.processedOn ? new Date(job.processedOn).toLocaleString() : 'Pending'}</td>
                        <td>
                            ${job.failedReason ? 
                                `<button onclick="dashboard.retryJob('${job.id}')" class="btn-sm">Retry</button>` : 
                                ''
                            }
                            <button onclick="dashboard.removeJob('${job.id}')" class="btn-sm btn-danger">Remove</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });

                loadingDiv.classList.add('hidden');
                contentDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading queue:', error);
            loadingDiv.innerHTML = '<p>Error loading queue</p>';
        }
    }

    async loadAnalytics() {
        const loadingDiv = document.getElementById('analyticsLoading');
        const contentDiv = document.getElementById('analyticsContent');

        loadingDiv.classList.remove('hidden');
        contentDiv.classList.add('hidden');

        try {
            // Simulate loading analytics data
            setTimeout(() => {
                loadingDiv.classList.add('hidden');
                contentDiv.classList.remove('hidden');
            }, 1000);
        } catch (error) {
            console.error('Error loading analytics:', error);
            loadingDiv.innerHTML = '<p>Error loading analytics</p>';
        }
    }

    async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            // Token expired, redirect to login
            this.handleLogout();
            return null;
        }

        return response;
    }

    formatAddress(address) {
        if (!address) return '';
        if (typeof address === 'string') return address;
        if (address.name) {
            return `${address.name} <${address.address}>`;
        }
        return address.address || address;
    }

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getEmailStatus(email) {
        if (email.flags?.includes('deleted')) return 'Deleted';
        if (email.flags?.includes('seen')) return 'Read';
        if (email.spamScore > 5) return 'Spam';
        if (email.virusStatus === 'infected') return 'Virus';
        return 'Normal';
    }

    getEmailStatusBadge(email) {
        const status = this.getEmailStatus(email);
        switch (status) {
            case 'Deleted': return 'badge-danger';
            case 'Spam': return 'badge-warning';
            case 'Virus': return 'badge-danger';
            case 'Read': return 'badge-success';
            default: return 'badge-success';
        }
    }

    getJobStatus(job) {
        if (job.failedReason) return 'Failed';
        if (job.finishedOn) return 'Completed';
        if (job.processedOn) return 'Processing';
        return 'Waiting';
    }

    getJobStatusBadge(job) {
        const status = this.getJobStatus(job);
        switch (status) {
            case 'Failed': return 'badge-danger';
            case 'Completed': return 'badge-success';
            case 'Processing': return 'badge-warning';
            default: return 'badge-warning';
        }
    }

    async editUser(userId) {
        // Placeholder for user editing functionality
        alert('User editing functionality coming soon');
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await this.apiCall(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('User deleted successfully');
                this.loadUsers();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error deleting user');
        }
    }

    async retryJob(jobId) {
        try {
            const response = await this.apiCall(`/api/queue/retry/${jobId}`, {
                method: 'POST'
            });

            if (response.ok) {
                alert('Job retried successfully');
                this.loadQueue();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error retrying job');
        }
    }

    async removeJob(jobId) {
        if (!confirm('Are you sure you want to remove this job?')) return;

        try {
            const response = await this.apiCall(`/api/queue/jobs/${jobId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Job removed successfully');
                this.loadQueue();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error removing job');
        }
    }
}

// Initialize dashboard when page loads
const dashboard = new MailServerDashboard();
