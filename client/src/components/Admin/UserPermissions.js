import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Form, 
  Button,
  Badge,
  Alert,
  Modal
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiSettings, FiUser, FiSave, FiX } from 'react-icons/fi';

import { usersAPI } from '../../utils/api';
import Loading from '../Common/Loading';

const UserPermissions = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAllUsers();
      // Sadece salesperson rolündeki kullanıcıları göster
      const salespersonUsers = response.data.filter(user => user.role === 'salesperson');
      setUsers(salespersonUsers);
      setError(null);
    } catch (error) {
      console.error('Users fetch error:', error);
      setError('Kullanıcılar yüklenirken hata oluştu');
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (user) => {
    setSelectedUser(user);
    setPermissions(user.permissions || {
      canViewAllSales: false,
      canViewAllReports: false,
      canViewAllPrims: false,
      canViewDashboard: true,
      canManageOwnSales: true,
      canViewOwnReports: true,
      canViewOwnPrims: true
    });
    setShowModal(true);
  };

  const handlePermissionChange = (permission, value) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: value
    }));
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      await usersAPI.updatePermissions(selectedUser._id, permissions);
      
      // Kullanıcı listesini güncelle
      setUsers(prev => prev.map(user => 
        user._id === selectedUser._id 
          ? { ...user, permissions }
          : user
      ));
      
      toast.success('Kullanıcı yetkileri başarıyla güncellendi');
      setShowModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Save permissions error:', error);
      toast.error('Yetkiler güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionBadge = (hasPermission) => {
    return hasPermission ? (
      <Badge bg="success">İzinli</Badge>
    ) : (
      <Badge bg="secondary">İzinsiz</Badge>
    );
  };

  if (loading) {
    return <Loading text="Kullanıcı yetkileri yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Kullanıcı Yetkileri</h1>
          <p className="text-muted mb-0">
            Satış temsilcilerinin sistem yetkilerini yönetin
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Users Table */}
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiUser className="me-2" />
            <span>Satış Temsilcileri ({users.length})</span>
