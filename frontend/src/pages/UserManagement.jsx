import { useState } from 'react'
import { DEMO_USERS } from '../data/users'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'

export default function UserManagement() {
  const { showToast } = useApp()
  const [search, setSearch] = useState('')

  const filteredUsers = DEMO_USERS.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h2 className="page-header__title">User Management</h2>
          <p className="page-header__desc">Manage platform users, roles and access permissions.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => showToast('User invitation flow — demo only', 'info')}>
          <Icon name="plus" className="icon-sm" /> Invite User
        </button>
      </header>

      <div className="panel">
        <div className="panel__toolbar">
          <label className="form-field form-field--compact">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="data-table__user">
                      <div className="data-table__avatar">{u.initials}</div>
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td><span className="data-table__mono">{u.email}</span></td>
                  <td><span className="role-badge">{u.role}</span></td>
                  <td>{u.department}</td>
                  <td>
                    <span className={`status-chip status-chip--${u.status === 'Online' ? 'active' : 'inactive'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => showToast(`Editing ${u.name} — demo only`, 'info')}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="data-table__empty">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
