import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Form,
  Modal,
  Spinner,
  Row,
  Col,
  Badge,
  Table
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiUser, 
  FiUserPlus, 
  FiRefreshCw,
  FiArrowRight,
  FiDatabase,
  FiCalendar,
  FiUsers
} from 'react-icons/fi';

import { migrationAPI, usersAPI, salesAPI } from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const LegacyUserManagement = () => {
  const [legacyUser, setLegacyUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    startDate: '',
    endDate: '',
    currentUserId: ''
  });
  const [stats, setStats] = useState({
    totalSales: 0,
    importedSales: 0,
    legacySales: 0
  });

  useEffect(() => {
    fetchLegacyUser();
    fetchUsers();
    fetchStats();
  }, []);

  const fetchLegacyUser = async () => {
    try {
      const response = await usersAPI.getAllUsers();
      const legacy = response.data.find(user => user.email === 'eski.satis@legacy.system');
      setLegacyUser(legacy);
    } catch (error) {
      console.error('Legacy user fetch error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAllUsers();
      const activeUsers = response.data.filter(user => 
        user.role === 'salesperson' && 
        user.isActive && 
        user.email !== 'eski.satis@legacy.system'
      );
      setUsers(activeUsers);
    } catch (error) {
      console.error('Users fetch error:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await salesAPI.getSales({ 
        page: 1, 
        limit: 1,
        includeStats: true 
      });
      
      // İstatistikleri al (varsayılan değerler)
      setStats({
        totalSales: response.data?.totalCount || 0,
        importedSales: 0, // Bu bilgiyi API'den almak gerekebilir
        legacySales: 0    // Bu bilgiyi API'den almak gerekebilir
      });
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  const handleCreateLegacyUser = async () => {
    try {
      setCreateLoading(true);
      const response = await migrationAPI.createLegacyUser();
      
      if (response.data.success) {
        setLegacyUser(response.data.user);
        toast.success(response.data.message);
        
        if (!response.data.isExisting) {
          toast.info('Artık import edilen satışları bu kullanıcıya atayabilirsiniz!');
        }
      }
    } catch (error) {
      console.error('Create legacy user error:', error);
      toast.error(error.response?.data?.message || 'Eski Satış Temsilcisi oluşturulamadı');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAssignSales = async () => {
    try {
      setAssignLoading(true);
      
      const response = await migrationAPI.assignSalesToLegacy(assignData);
      
      if (response.data.success) {
        toast.success(response.data.message);
        setShowAssignModal(false);
        fetchStats(); // Refresh stats
        
        // Reset form
        setAssignData({
          startDate: '',
          endDate: '',
          currentUserId: ''
        });
      }
    } catch (error) {
      console.error('Assign sales error:', error);
      toast.error(error.response?.data?.message || 'Satışlar atanamadı');
    } finally {
      setAssignLoading(false);
    }
  };

  const openAssignModal = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    setAssignData({
      startDate: yesterday.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      currentUserId: ''
    });
    setShowAssignModal(true);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>
          <FiUser className="me-2" />
          Eski Satış Temsilcisi Yönetimi
        </h4>
        <Button variant="outline-secondary" size="sm" onClick={fetchStats}>
          <FiRefreshCw className="me-2" />
          Yenile
        </Button>
      </div>

      {/* Legacy User Status */}
      <Card className="mb-4">
        <Card.Body>
          <h6>
            <FiDatabase className="me-2" />
            Virtual Kullanıcı Durumu
          </h6>
          
          {legacyUser ? (
            <Alert variant="success">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>✅ Eski Satış Temsilcisi Mevcut</strong>
                  <div className="small text-muted mt-1">
                    ID: {legacyUser._id} | Email: {legacyUser.email}
                  </div>
                </div>
                <Badge bg="success">Aktif</Badge>
              </div>
            </Alert>
          ) : (
            <Alert variant="warning">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ Eski Satış Temsilcisi Yok</strong>
                  <div className="small text-muted mt-1">
                    Import edilen satışları yönetmek için virtual kullanıcı oluşturun
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={handleCreateLegacyUser}
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <FiUserPlus className="me-2" />
                      Oluştur
                    </>
                  )}
                </Button>
              </div>
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Statistics */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-primary">{stats.totalSales}</h3>
              <small className="text-muted">Toplam Satış</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-warning">{stats.importedSales}</h3>
              <small className="text-muted">Import Edilen</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-success">{stats.legacySales}</h3>
              <small className="text-muted">Eski Temsilciye Ait</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      {legacyUser && (
        <Card>
          <Card.Body>
            <h6>
              <FiArrowRight className="me-2" />
              Satış Atama İşlemleri
            </h6>
            <p className="text-muted">
              Import ettiğiniz satışları "Eski Satış Temsilcisi"ne atayarak performans analizlerini düzenleyin.
            </p>
            
            <Button 
              variant="primary"
              onClick={openAssignModal}
            >
              <FiUsers className="me-2" />
              Satışları Ata
            </Button>
          </Card.Body>
        </Card>
      )}

      {/* Assign Sales Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiArrowRight className="me-2" />
            Satışları Eski Satış Temsilcisine Ata
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Alert variant="info">
            <strong>📋 Bu işlem:</strong>
            <ul className="mb-0 mt-2">
              <li>Seçilen tarih aralığındaki satışları "Eski Satış Temsilcisi"ne atar</li>
              <li>Performans raporlarında bu satışlar ayrı gösterilir</li>
              <li>Orijinal temsilci bilgisi korunur (geri alınabilir)</li>
            </ul>
          </Alert>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Başlangıç Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={assignData.startDate}
                  onChange={(e) => setAssignData(prev => ({
                    ...prev,
                    startDate: e.target.value
                  }))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Bitiş Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={assignData.endDate}
                  onChange={(e) => setAssignData(prev => ({
                    ...prev,
                    endDate: e.target.value
                  }))}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Mevcut Temsilci (Opsiyonel)</Form.Label>
            <Form.Select
              value={assignData.currentUserId}
              onChange={(e) => setAssignData(prev => ({
                ...prev,
                currentUserId: e.target.value
              }))}
            >
              <option value="">Tüm Temsilciler</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Boş bırakırsanız tüm temsilcilerin satışları atanır
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAssignSales}
            disabled={assignLoading || !assignData.startDate || !assignData.endDate}
          >
            {assignLoading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Atanıyor...
              </>
            ) : (
              <>
                <FiArrowRight className="me-2" />
                Ata
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LegacyUserManagement;
