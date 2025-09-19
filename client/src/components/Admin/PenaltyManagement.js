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
  Modal,
  InputGroup,
  Spinner,
  Tab,
  Nav,
  ProgressBar
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiAlertTriangle,
  FiUsers,
  FiSettings,
  FiCalendar,
  FiClock,
  FiX,
  FiSave,
  FiRefreshCw,
  FiEye,
  FiTrash2,
  FiPlus,
  FiFilter,
  FiDownload
} from 'react-icons/fi';

import API, { penaltiesAPI, usersAPI } from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const PenaltyManagement = () => {
  const [activeTab, setActiveTab] = useState('penalties');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [penalties, setPenalties] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({
    dailyPenaltyPoints: 1,
    maxPenaltyPoints: 10,
    autoDeactivateEnabled: true,
    penaltyResetDays: 30
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    status: 'all' // all, active, resolved
  });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newPenalty, setNewPenalty] = useState({
    userId: '',
    points: 1,
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPenalties();
  }, [filters, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPenalties(),
        fetchUsers(),
        fetchSettings()
      ]);
    } catch (error) {
      console.error('Fetch data error:', error);
      setError('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchPenalties = async () => {
    try {
      console.log('🔍 Fetching penalties with filters:', filters);
      const response = await penaltiesAPI.getPenalties(filters);
      console.log('📋 Penalties API response:', response);
      
      // Backend response.data.penalties döndürüyor
      const dataArray = Array.isArray(response.data?.penalties) ? response.data.penalties : 
                       Array.isArray(response.data) ? response.data : [];
      
      console.log('✅ Processed penalties data:', {
        count: dataArray.length,
        penalties: dataArray
      });
      
      setPenalties(dataArray);
    } catch (error) {
      console.error('❌ Penalties fetch error:', error);
      console.error('Error response:', error.response?.data);
      setPenalties(prevPenalties => Array.isArray(prevPenalties) ? prevPenalties : []);
      toast.error(error.response?.data?.message || 'Ceza kayıtları yüklenirken hata oluştu');
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('👥 Fetching users for penalty management...');
      const response = await API.get('/users');
      console.log('📋 Users API response:', response);
      console.log('📋 Raw response.data:', response.data);
      console.log('📋 Response.data type:', typeof response.data);
      console.log('📋 Is response.data array?', Array.isArray(response.data));
      
      // Muaf olmayan aktif kullanıcıları filtrele
      const responseData = Array.isArray(response.data) ? response.data : [];
      const eligibleUsers = responseData.filter(user => 
        user.role?.name !== 'admin'
      );
      
      console.log('🔍 Detailed user filtering:', {
        totalUsers: responseData.length,
        adminUsers: responseData.filter(u => u.role?.name === 'admin').length,
        nonAdminUsers: responseData.filter(u => u.role?.name !== 'admin').length,
        approvedUsers: responseData.filter(u => u.isApproved).length,
        requiresCommunicationUsers: responseData.filter(u => u.requiresCommunicationEntry).length,
        eligibleUsers: eligibleUsers.length
      });
      
      console.log('✅ Processed users data:', {
        totalUsers: responseData.length,
        eligibleUsers: eligibleUsers.length,
        users: eligibleUsers.map(u => ({ 
          name: u.name, 
          email: u.email,
          isApproved: u.isApproved,
          requiresCommunicationEntry: u.requiresCommunicationEntry,
          role: u.role?.name
        }))
      });
      
      console.log('🔍 All users from API:', responseData.map(u => ({
        name: u.name,
        isActive: u.isActive,
        isApproved: u.isApproved,
        requiresCommunicationEntry: u.requiresCommunicationEntry,
        role: u.role?.name
      })));
      
      console.log('🔍 Frontend filtering debug:');
      responseData.forEach(user => {
        const nonAdmin = user.role?.name !== 'admin';
        const eligible = user.isApproved && 
                        user.requiresCommunicationEntry && 
                        user.role?.name !== 'admin';
        console.log(`User: ${user.name}`, {
          isActive: user.isActive,
          isApproved: user.isApproved,
          requiresCommunicationEntry: user.requiresCommunicationEntry,
          role: user.role?.name,
          nonAdmin: nonAdmin,
          eligible: eligible
        });
      });
      
      console.log('🔍 Setting users state:', eligibleUsers);
      console.log('🔍 Users length:', eligibleUsers.length);
      setUsers(eligibleUsers);
    } catch (error) {
      console.error('❌ Users fetch error:', error);
      console.error('Error response:', error.response?.data);
      setUsers(prevUsers => Array.isArray(prevUsers) ? prevUsers : []);
      toast.error(error.response?.data?.message || 'Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await penaltiesAPI.getSettings();
      setSettings(response.data || settings);
    } catch (error) {
      console.error('Settings fetch error:', error);
    }
  };

  const handleAddPenalty = async () => {
    try {
      setSaving(true);

      if (!newPenalty.userId || !newPenalty.reason) {
        toast.error('Kullanıcı ve sebep alanları zorunludur');
        return;
      }

      await penaltiesAPI.addPenalty(newPenalty);
      toast.success('Ceza puanı başarıyla eklendi');
      
      setShowAddModal(false);
      setNewPenalty({
        userId: '',
        points: 1,
        reason: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      fetchPenalties();
      fetchUsers(); // Kullanıcı puanlarını güncelle
      
    } catch (error) {
      console.error('Add penalty error:', error);
      toast.error(error.response?.data?.message || 'Ceza puanı eklenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPenalty = async (penaltyId, reason) => {
    if (!reason) {
      toast.error('İptal sebebi belirtilmelidir');
      return;
    }

    try {
      await penaltiesAPI.cancelPenalty(penaltyId, reason);
      toast.success('Ceza puanı başarıyla iptal edildi');
      fetchPenalties();
      fetchUsers();
    } catch (error) {
      console.error('Cancel penalty error:', error);
      toast.error(error.response?.data?.message || 'Ceza puanı iptal edilirken hata oluştu');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await penaltiesAPI.updateSettings(settings);
      toast.success('Ceza ayarları başarıyla güncellendi');
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('Ayarlar kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCheck = async () => {
    try {
      setLoading(true);
      const response = await penaltiesAPI.checkMissedEntries();
      toast.success(`${response.data.newPenalties} yeni ceza puanı eklendi`);
      fetchPenalties();
      fetchUsers();
    } catch (error) {
      console.error('Bulk check error:', error);
      toast.error('Toplu kontrol sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getPenaltyStatusBadge = (penalty) => {
    if (penalty.isCancelled) {
      return <Badge bg="secondary">İptal Edildi</Badge>;
    }
    if (penalty.isResolved) {
      return <Badge bg="success">Çözüldü</Badge>;
    }
    return <Badge bg="danger">Aktif</Badge>;
  };

  const getUserPenaltyStats = (user) => {
    console.log('🔍 Getting penalty stats for user:', {
      userId: user._id,
      userName: user.name,
      totalPenalties: penalties?.length || 0,
      penaltiesArray: Array.isArray(penalties)
    });
    
    if (!Array.isArray(penalties)) {
      console.log('⚠️ Penalties is not an array:', penalties);
      return { totalPoints: 0, activePoints: 0, count: 0 };
    }
    
    // Debug: Check penalty structure
    console.log('🔍 Sample penalty structure:', penalties[0]);
    
    const userPenalties = penalties.filter(p => {
      const matches = p.user && p.user._id && p.user._id.toString() === user._id.toString() && !p.isCancelled;
      console.log('🔍 Penalty check:', {
        penaltyId: p._id,
        penaltyUserId: p.user?._id,
        targetUserId: user._id,
        matches: matches,
        isCancelled: p.isCancelled
      });
      return matches;
    });
    
    console.log('📊 User penalty stats:', {
      userName: user.name,
      userPenalties: userPenalties.length,
      penalties: userPenalties.map(p => ({ id: p._id, points: p.points, isResolved: p.isResolved }))
    });
    
    const totalPoints = userPenalties.reduce((sum, p) => sum + p.points, 0);
    const activePoints = userPenalties.filter(p => !p.isResolved).reduce((sum, p) => sum + p.points, 0);
    
    return { totalPoints, activePoints, count: userPenalties.length };
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" />
        <p className="mt-2">Ceza yönetimi verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiAlertTriangle className="me-2" />
            Ceza Puanı Yönetimi
          </h4>
          <p className="text-muted mb-0">
            İletişim kayıt ceza puanlarını yönetin
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-primary" 
            onClick={fetchData}
            disabled={loading}
          >
            <FiRefreshCw className="me-2" />
            Yenile
          </Button>
          <Button 
            variant="warning" 
            onClick={handleBulkCheck}
            disabled={loading}
          >
            <FiClock className="me-2" />
            Eksik Kayıtları Kontrol Et
          </Button>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowSettingsModal(true)}
          >
            <FiSettings className="me-2" />
            Ayarlar
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <Card.Body className="p-0">
            <Tab.Container 
              activeKey={activeTab} 
              onSelect={(key) => {
                console.log('🔥 TAB CHANGE!', { from: activeTab, to: key });
                setActiveTab(key);
                setForceUpdate(prev => prev + 1); // Force re-render
                // State güncellemesini kontrol et
                setTimeout(() => {
                  console.log('🔥 STATE AFTER SET:', { activeTab, expectedTab: key });
                }, 100);
              }}
            >
            <Nav variant="tabs" className="border-bottom">
              {(() => {
                console.log('🔥 TABS RENDERED!', { activeTab, penaltiesLength: penalties.length, usersLength: users.length });
                return null;
              })()}
              <Nav.Item>
                <Nav.Link eventKey="penalties">
                  <FiAlertTriangle className="me-2" />
                  Ceza Kayıtları ({penalties.length})
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  eventKey="users"
                  onClick={() => console.log('🔥 USERS TAB CLICKED!')}
                >
                  <FiUsers className="me-2" />
                  Kullanıcı Durumları ({users.length})
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <div className="p-4">
              <Tab.Content>
                {/* Penalties Tab */}
                <Tab.Pane eventKey="penalties">
                  {/* Filters */}
                  <Card className="mb-4">
                    <Card.Body>
                      <Row>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Başlangıç Tarihi</Form.Label>
                            <Form.Control
                              type="date"
                              value={filters.startDate}
                              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Bitiş Tarihi</Form.Label>
                            <Form.Control
                              type="date"
                              value={filters.endDate}
                              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Kullanıcı</Form.Label>
                            <Form.Select
                              value={filters.userId}
                              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                            >
                              <option value="">Tüm Kullanıcılar</option>
                              {(() => {
                                console.log('🔍 Rendering users dropdown:', {
                                  isArray: Array.isArray(users),
                                  length: users?.length || 0,
                                  users: users?.map(u => ({ name: u.name, id: u._id })) || []
                                });
                                return Array.isArray(users) && users.map(user => (
                                  <option key={user._id} value={user._id}>
                                    {user.name}
                                  </option>
                                ));
                              })()}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Durum</Form.Label>
                            <Form.Select
                              value={filters.status}
                              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            >
                              <option value="all">Tümü</option>
                              <option value="active">Aktif</option>
                              <option value="resolved">Çözüldü</option>
                              <option value="cancelled">İptal Edildi</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="mt-3">
                        <Col>
                          <Button 
                            variant="primary" 
                            onClick={() => setShowAddModal(true)}
                          >
                            <FiPlus className="me-2" />
                            Manuel Ceza Ekle
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>

                  {/* Penalties Table */}
                  <Table responsive striped hover>
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Kullanıcı</th>
                        <th>Sebep</th>
                        <th>Puan</th>
                        <th>Durum</th>
                        <th>İşlem Yapan</th>
                        <th>İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!Array.isArray(penalties) || penalties.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center text-muted">
                            {!Array.isArray(penalties) ? 'Veriler yükleniyor...' : 'Ceza kaydı bulunamadı'}
                          </td>
                        </tr>
                      ) : (
                        penalties.map(penalty => (
                          <tr key={penalty._id}>
                            <td>{formatDate(penalty.date)}</td>
                            <td>
                              <div>
                                <strong>{penalty.user.name}</strong>
                                <br />
                                <small className="text-muted">{penalty.user.email}</small>
                              </div>
                            </td>
                            <td>{penalty.reason}</td>
                            <td>
                              <Badge bg="danger">
                                {penalty.points} puan
                              </Badge>
                            </td>
                            <td>{getPenaltyStatusBadge(penalty)}</td>
                            <td>{penalty.createdBy?.name || 'Sistem'}</td>
                            <td>
                              {!penalty.isCancelled && !penalty.isResolved && (
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  onClick={() => {
                                    const reason = prompt('İptal sebebini belirtin (en az 5 karakter):');
                                    if (reason && reason.trim().length >= 5) {
                                      handleCancelPenalty(penalty._id, reason.trim());
                                    } else if (reason) {
                                      toast.error('İptal sebebi en az 5 karakter olmalıdır');
                                    }
                                  }}
                                >
                                  <FiX />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </Tab.Pane>

                {/* Users Tab */}
                <Tab.Pane eventKey="users">
                  {(() => {
                    console.log('🔥 USERS TAB RENDERED!', {
                      activeTab,
                      usersLength: users?.length || 0,
                      penaltiesLength: penalties?.length || 0,
                      usersArray: Array.isArray(users),
                      users: users?.slice(0, 3).map(u => u.name) || []
                    });
                    return null;
                  })()}
                  <Row className="mb-3">
                    <Col>
                      <h5>Kullanıcı Ceza Durumları</h5>
                      <p className="text-muted">
                        Toplam {users?.length || 0} kullanıcı, {penalties?.length || 0} ceza kaydı
                      </p>
                    </Col>
                  </Row>
                  {(() => {
                    console.log('🔥 BEFORE TABLE RENDER!', {
                      usersLength: users?.length,
                      penaltiesLength: penalties?.length,
                      loading,
                      error
                    });
                    return null;
                  })()}
                  <Table responsive striped hover>
                    <thead>
                      <tr>
                        <th>Kullanıcı</th>
                        <th>Toplam Ceza</th>
                        <th>Aktif Ceza</th>
                        <th>Durum</th>
                        <th>Son Ceza</th>
                        <th>İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        console.log('🔥 TBODY START!');
                        return (
                          <tr>
                            <td colSpan="6" className="text-center py-4">
                              <div className="text-muted">
                                <p>TEST: {users?.length || 0} kullanıcı bulundu</p>
                                <small>Debug: {Array.isArray(users) ? 'Array' : 'Not Array'}</small>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </Table>
                </Tab.Pane>
              </Tab.Content>
            </div>
          </Tab.Container>
        </Card.Body>
      </Card>

      {/* Add Penalty Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FiPlus className="me-2" />
            Manuel Ceza Puanı Ekle
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Kullanıcı *</Form.Label>
            <Form.Select
              value={newPenalty.userId}
              onChange={(e) => setNewPenalty(prev => ({ ...prev, userId: e.target.value }))}
              required
            >
              <option value="">Kullanıcı seçiniz...</option>
              {Array.isArray(users) && users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Puan *</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  max="10"
                  value={newPenalty.points}
                  onChange={(e) => setNewPenalty(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tarih *</Form.Label>
                <Form.Control
                  type="date"
                  value={newPenalty.date}
                  onChange={(e) => setNewPenalty(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Sebep *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={newPenalty.reason}
              onChange={(e) => setNewPenalty(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Ceza puanı verme sebebini belirtin..."
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            <FiX className="me-2" />
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddPenalty}
            disabled={saving}
          >
            {saving ? (
              <Spinner size="sm" animation="border" className="me-2" />
            ) : (
              <FiSave className="me-2" />
            )}
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Settings Modal */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FiSettings className="me-2" />
            Ceza Puanı Ayarları
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Günlük Ceza Puanı</Form.Label>
            <Form.Control
              type="number"
              min="1"
              max="10"
              value={settings.dailyPenaltyPoints}
              onChange={(e) => setSettings(prev => ({ ...prev, dailyPenaltyPoints: parseInt(e.target.value) }))}
            />
            <Form.Text className="text-muted">
              İletişim kaydı girilmediğinde verilecek günlük puan
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Maksimum Ceza Puanı</Form.Label>
            <Form.Control
              type="number"
              min="5"
              max="50"
              value={settings.maxPenaltyPoints}
              onChange={(e) => setSettings(prev => ({ ...prev, maxPenaltyPoints: parseInt(e.target.value) }))}
            />
            <Form.Text className="text-muted">
              Bu puana ulaşan kullanıcılar otomatik pasifleştirilebilir
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="autoDeactivate"
              label="Otomatik Pasifleştirme"
              checked={settings.autoDeactivateEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, autoDeactivateEnabled: e.target.checked }))}
            />
            <Form.Text className="text-muted">
              Maksimum puana ulaşan kullanıcıları otomatik pasifleştir
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Puan Sıfırlama Süresi (Gün)</Form.Label>
            <Form.Control
              type="number"
              min="7"
              max="365"
              value={settings.penaltyResetDays}
              onChange={(e) => setSettings(prev => ({ ...prev, penaltyResetDays: parseInt(e.target.value) }))}
            />
            <Form.Text className="text-muted">
              Bu süre sonunda eski ceza puanları otomatik sıfırlanır
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>
            <FiX className="me-2" />
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <Spinner size="sm" animation="border" className="me-2" />
            ) : (
              <FiSave className="me-2" />
            )}
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PenaltyManagement;
