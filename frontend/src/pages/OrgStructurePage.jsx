import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { GET_ORG_STRUCTURE, GET_UNASSIGNED_USERS, UPDATE_ORG_STRUCTURE, CREATE_USER, UPDATE_USER } from '../graphql/queries';

const ROLE_COLORS = {
  OWNER: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', label: 'Owner/CEO', ring: 'ring-amber-400' },
  SENIOR_MANAGER: { bg: 'bg-primary-100', border: 'border-primary-300', text: 'text-primary-800', label: 'Senior Sales Manager', ring: 'ring-primary-400' },
  SALES_EXECUTIVE: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', label: 'Sales Executive', ring: 'ring-green-400' },
};

const ALL_ROLES = [
  { value: 'OWNER', label: 'Owner/CEO' },
  { value: 'SENIOR_MANAGER', label: 'Senior Sales Manager' },
  { value: 'SALES_EXECUTIVE', label: 'Sales Executive' },
];

export default function OrgStructurePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { data, loading, refetch } = useQuery(GET_ORG_STRUCTURE);
  const { data: unassignedData, refetch: refetchUnassigned } = useQuery(GET_UNASSIGNED_USERS);
  const [updateOrg] = useMutation(UPDATE_ORG_STRUCTURE);
  const [createUser] = useMutation(CREATE_USER);
  const [updateUser] = useMutation(UPDATE_USER);
  const [showAddUser, setShowAddUser] = useState(false);
  const [draggedUser, setDraggedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [activeView, setActiveView] = useState('tree');

  const users = data?.orgStructure || [];
  const unassigned = unassignedData?.unassignedUsers || [];

  const owner = users.find((u) => u.role === 'OWNER');
  const managers = users.filter((u) => u.role === 'SENIOR_MANAGER');
  const getExecutives = (managerId) => users.filter((u) => u.role === 'SALES_EXECUTIVE' && u.reportsToId === managerId);

  const handleDrop = async (targetUserId, targetRole) => {
    if (!draggedUser) return;
    try {
      let role = 'SALES_EXECUTIVE';
      if (targetRole === 'owner') role = 'SENIOR_MANAGER';
      else if (targetRole === 'manager') role = 'SALES_EXECUTIVE';
      await updateOrg({ variables: { userId: draggedUser, reportsTo: targetUserId, role } });
      refetch(); refetchUnassigned();
      enqueueSnackbar('User reassigned', { variant: 'success' });
    } catch (err) { enqueueSnackbar(err.message || 'Failed to reassign user', { variant: 'error' }); }
    setDraggedUser(null);
  };

  const handleAddUser = async (userData) => {
    try {
      await createUser({ variables: userData });
      refetch(); refetchUnassigned(); setShowAddUser(false);
      enqueueSnackbar('User added', { variant: 'success' });
    } catch (err) { enqueueSnackbar(err.message || 'Failed to add user', { variant: 'error' }); }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await updateUser({ variables: { id: userId, input: { isActive: !isActive } } });
      refetch();
      enqueueSnackbar(isActive ? 'User deactivated' : 'User activated', { variant: 'success' });
    } catch (err) { enqueueSnackbar(err.message || 'Failed to update user status', { variant: 'error' }); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateOrg({ variables: { userId, role: newRole } });
      refetch();
      enqueueSnackbar('Role updated', { variant: 'success' });
    } catch (err) { enqueueSnackbar(err.message || 'Failed to update role', { variant: 'error' }); }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <button onClick={() => navigate('/settings')} className="hover:text-primary-600">Settings</button>
            <span>/</span>
            <span className="text-gray-900">Organization Structure</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Structure & Roles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team hierarchy, roles & permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setActiveView('tree')} className={`px-3 py-1.5 text-sm rounded-md ${activeView === 'tree' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Org Tree</button>
            <button onClick={() => setActiveView('table')} className={`px-3 py-1.5 text-sm rounded-md ${activeView === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Roles Table</button>
          </div>
          <button onClick={() => setShowAddUser(true)} className="btn-primary text-sm">+ Add User</button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Users</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-amber-600">{users.filter(u => u.role === 'OWNER').length}</p>
          <p className="text-xs text-gray-500 mt-1">Owners</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-primary-600">{managers.length}</p>
          <p className="text-xs text-gray-500 mt-1">Managers</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-green-600">{users.filter(u => u.role === 'SALES_EXECUTIVE').length}</p>
          <p className="text-xs text-gray-500 mt-1">Executives</p>
        </div>
      </div>

      {activeView === 'tree' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Org Tree */}
          <div className="lg:col-span-3">
            <div className="flex flex-col items-center">
              {owner && (
                <div className="mb-8">
                  <OrgNode user={owner} role="OWNER"
                    onDrop={() => handleDrop(owner.id, 'owner')}
                    onDragOver={(e) => e.preventDefault()}
                    onEdit={() => setEditingUser(owner)}
                    onToggleActive={() => handleToggleActive(owner.id, owner.isActive !== false)}
                  />
                </div>
              )}
              {managers.length > 0 && <div className="w-0.5 h-8 bg-gray-300" />}
              <div className="flex gap-12 flex-wrap justify-center relative">
                {managers.length > 1 && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gray-300" />}
                {managers.map((mgr) => {
                  const execs = getExecutives(mgr.id);
                  return (
                    <div key={mgr.id} className="flex flex-col items-center">
                      <OrgNode user={mgr} role="SENIOR_MANAGER"
                        onDrop={() => handleDrop(mgr.id, 'manager')}
                        onDragOver={(e) => e.preventDefault()}
                        onEdit={() => setEditingUser(mgr)}
                        onToggleActive={() => handleToggleActive(mgr.id, mgr.isActive !== false)}
                      />
                      {execs.length > 0 && <div className="w-0.5 h-8 bg-gray-300" />}
                      <div className="flex gap-4 flex-wrap justify-center">
                        {execs.map((exec) => (
                          <OrgNode key={exec.id} user={exec} role="SALES_EXECUTIVE"
                            onEdit={() => setEditingUser(exec)}
                            onToggleActive={() => handleToggleActive(exec.id, exec.isActive !== false)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Unassigned Panel */}
          <div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Unassigned Users</h3>
              <p className="text-xs text-gray-500 mb-4">Drag & Drop to Assign Role</p>
              {unassigned.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">All users assigned</p>
              ) : (
                <div className="space-y-2">
                  {unassigned.map((u) => (
                    <div key={u.id} draggable onDragStart={() => setDraggedUser(u.id)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-grab hover:bg-gray-50 active:cursor-grabbing">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">{u.name[0]}</div>
                      <span className="text-sm font-medium text-gray-900">{u.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Roles Table View */
        <RolesTable users={users} onRoleChange={handleRoleChange} onToggleActive={handleToggleActive} onEdit={setEditingUser} />
      )}

      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} onSubmit={handleAddUser} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={async (id, input) => {
        try {
          if (input.role) await updateOrg({ variables: { userId: id, role: input.role } });
          if (input.isActive !== undefined) await updateUser({ variables: { id, input: { isActive: input.isActive } } });
          refetch(); setEditingUser(null);
          enqueueSnackbar('User updated', { variant: 'success' });
        } catch (err) { enqueueSnackbar(err.message || 'Failed to update user', { variant: 'error' }); }
      }} />}
    </div>
  );
}

/* ─── Roles Table ─── */
function RolesTable({ users, onRoleChange, onToggleActive, onEdit }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">All Team Members</h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3">User</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3">Email</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3">Role</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3">Reports To</th>
            <th className="text-center text-xs font-semibold text-gray-500 uppercase pb-3">Status</th>
            <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const cfg = ROLE_COLORS[u.role] || ROLE_COLORS.SALES_EXECUTIVE;
            const reportsTo = u.reportsToId ? users.find(x => x.id === u.reportsToId) : null;
            const isActive = u.isActive !== false;
            return (
              <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/60' : ''} ${!isActive ? 'opacity-50' : ''}`}>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${cfg.bg} ${cfg.text}`}>{u.name[0]}</div>
                    <span className="text-sm font-medium text-gray-900">{u.name}</span>
                  </div>
                </td>
                <td className="py-3 text-sm text-gray-600">{u.email}</td>
                <td className="py-3">
                  {u.role === 'OWNER' ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  ) : (
                    <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer">
                      <option value="SENIOR_MANAGER">Senior Manager</option>
                      <option value="SALES_EXECUTIVE">Sales Executive</option>
                    </select>
                  )}
                </td>
                <td className="py-3 text-sm text-gray-600">{reportsTo?.name || '—'}</td>
                <td className="py-3 text-center">
                  <button onClick={() => u.role !== 'OWNER' && onToggleActive(u.id, isActive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'} ${u.role === 'OWNER' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="py-3 text-right">
                  <button onClick={() => onEdit(u)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">Edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrgNode({ user, role, onDrop, onDragOver, onEdit, onToggleActive }) {
  const cfg = ROLE_COLORS[role];
  const isActive = user.isActive !== false;
  return (
    <div
      className={`${cfg.bg} ${cfg.border} border-2 rounded-xl px-6 py-4 text-center min-w-[180px] transition-shadow hover:shadow-md relative group ${!isActive ? 'opacity-50' : ''}`}
      onDrop={onDrop} onDragOver={onDragOver} draggable={role !== 'OWNER'}
    >
      <p className={`font-semibold ${cfg.text} text-sm`}>{user.name}</p>
      <p className="text-xs text-gray-500 mt-1">({cfg.label})</p>
      {!isActive && <span className="text-xs text-red-500 font-medium">Inactive</span>}
      {/* Hover actions */}
      <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
        {onEdit && (
          <button onClick={onEdit} className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-primary-600 shadow-sm text-xs" title="Edit">✏️</button>
        )}
        {onToggleActive && role !== 'OWNER' && (
          <button onClick={onToggleActive} className={`w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm text-xs ${isActive ? 'text-red-500' : 'text-green-500'}`} title={isActive ? 'Deactivate' : 'Activate'}>
            {isActive ? '⏸' : '▶'}
          </button>
        )}
      </div>
    </div>
  );
}

function AddUserModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ email: '', name: '', role: 'SALES_EXECUTIVE' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input-field" type="email" value={form.email} onChange={set('email')} placeholder="user@moducraft.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input className="input-field" value={form.name} onChange={set('name')} placeholder="Full Name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input-field" value={form.role} onChange={set('role')}>
              <option value="SENIOR_MANAGER">Senior Sales Manager</option>
              <option value="SALES_EXECUTIVE">Sales Executive</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => form.email && form.name && onSubmit(form)} disabled={!form.email.trim() || !form.name.trim()} className="btn-primary">Add User</button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Edit User</h2>
        <p className="text-sm text-gray-500 mb-6">{user.name} ({user.email})</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            {user.role === 'OWNER' ? (
              <p className="text-sm text-gray-500">Owner role cannot be changed</p>
            ) : (
              <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
                {ALL_ROLES.filter(r => r.value !== 'OWNER').map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Active Status</label>
            {user.role === 'OWNER' ? (
              <p className="text-sm text-gray-500">Always active</p>
            ) : (
              <button onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => onSave(user.id, { role: role !== user.role ? role : undefined, isActive: isActive !== (user.isActive !== false) ? isActive : undefined })} className="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-8 animate-pulse space-y-8">
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}</div>
      <div className="flex flex-col items-center space-y-4">
        <div className="w-40 h-20 bg-gray-200 rounded-xl" />
        <div className="flex gap-8">{[...Array(2)].map((_, i) => <div key={i} className="w-40 h-20 bg-gray-200 rounded-xl" />)}</div>
        <div className="flex gap-4">{[...Array(4)].map((_, i) => <div key={i} className="w-36 h-16 bg-gray-200 rounded-xl" />)}</div>
      </div>
    </div>
  );
}
